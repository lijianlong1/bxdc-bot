# Debug Session: agent-core 容器挂了

> Session ID: `agent-core-container-hang`
> Status: **[OPEN]**
> Created: 2026-06-08
> Methodology: TRAE-debugger（科学调试：假设 → 插桩 → 复现 → 分析 → 修复 → 验证）

---

## 一、症状描述

- **报告人**：用户
- **环境**：内网生产 agent-core 容器（NestJS / Node.js 后端）
- **症状**：容器挂了（具体表现待用户确认——重启？卡死？OOM？重启循环？）
- **本地复现**：当前 terminal 1 跑着 `npm run start:dev`（PID 44953）作为对照参考

---

## 二、5 大可证伪假设（agent-core 容器挂了的常见根因）

| # | 假设 | 验证手段 | 关键证据 |
|---|------|---------|---------|
| **H1** | **OOM（内存溢出）** | `docker inspect` 看 `OOMKilled=true`；`dmesg \| grep -i oom`；`journalctl -u docker` | ExitCode=137；cgroup memory.limit 触顶 |
| **H2** | **Event loop 阻塞**（同步死循环 / CPU 100%）| `docker stats` 看 CPU%；`top` / `ps` 找 pid 后 `kill -3 <pid>` 拿 thread dump；`clinic.js` flame | CPU 100% 且不响应请求；thread dump 全堆在某个同步调用 |
| **H3** | **未捕获异常 / 致命错误** | `docker logs --tail 500`；`nest start` 输出 | 启动失败 / process exited；`Error: ENOENT` / `ECONNREFUSED` 等致命错 |
| **H4** | **外部依赖挂死**（LLM API / MySQL / skill-gateway）| `nest` 输出里 `AGENT_REQUEST` / `AGENT_RESPONSE` 时间差；`lsof -p <pid>` 看连接数 | 请求发出去几十分钟没响应；socket 累计不释放 |
| **H5** | **连接池/文件描述符耗尽** | `cat /proc/<pid>/limits` 看 `open files`；`lsof -p <pid> \| wc -l` | `Too many open files`；DB pool 满 |

**针对 bxdc-bot 项目特有的诱因**（基于本项目架构）：
- **H6 异步任务积压**（项目刚改的 Fire-and-Forget）：长任务完成事件没被消费，内存里的 NotificationQueue 撑爆
- **H7 LangGraph Checkpoint 泄漏**：长期跑没 GC，导致 heap 增长
- **H8 记忆（mem0 /memory/add）背压**：用户连续发消息，记忆写入速度跟不上

---

## 三、排查 Cheatsheet（按时间从 5s 到 30min 渐进）

### 第一步：5 秒内定位——是哪种"挂"

```bash
# A. 容器是否在运行？
docker ps -a --filter "name=agent-core" --format "{{.Names}} {{.Status}} {{.State}}"

# B. 如果 State = exited，看 ExitCode
#    0 = 正常退出
#    1 = 应用错误
#    137 = OOM Killer (128 + SIGKILL=9)
#    139 = SIGSEGV (段错误)
#    143 = SIGTERM (被 docker stop)
docker inspect agent-core --format='{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}} {{.State.Error}}'

# C. 如果 State = restarting，看重启次数
docker inspect agent-core --format='{{.RestartCount}} {{.State.StartedAt}}'
```

### 第二步：30 秒内拿到最近日志

```bash
# 看最后 200 行日志（找 panic / error / stack trace）
docker logs --tail 200 agent-core 2>&1 | grep -iE "error|panic|fatal|killed|exit|disconnected" | head -50

# 看启动期日志（如果容器在重启）
docker logs --tail 200 agent-core 2>&1 | head -100

# 跟时间范围筛
docker logs --since 10m agent-core 2>&1
```

### 第三步：2 分钟内看资源

```bash
# CPU 和内存
docker stats agent-core --no-stream

# 容器内进程资源
docker top agent-core
# 输出 axww（ps 参数）：PID PPID USER STAT COMMAND
# STAT 里 'D' = 不可中断睡眠（IO 等待），'R' = 运行，'Z' = 僵尸

# 文件描述符
docker exec agent-core sh -c "cat /proc/1/limits | grep 'open files'"
docker exec agent-core sh -c "ls /proc/1/fd \| wc -l"
```

### 第四步：5 分钟内深挖——如果是 OOM

```bash
# 看 cgroup 内存峰值
docker exec agent-core sh -c "cat /sys/fs/cgroup/memory.max_usage_in_bytes" 2>/dev/null
docker exec agent-core sh -c "cat /sys/fs/cgroup/memory.current" 2>/dev/null

# 看 Node 进程内存
docker exec agent-core sh -c "ps aux \| grep node"  # RSS 列
docker exec agent-core sh -c "cat /proc/1/status | grep -E 'VmRSS\|VmPeak'"

# 拿 heap snapshot（需要 Node 启用 --inspect 或远程调试）
docker exec agent-core sh -c "kill -USR2 1"  # 触发 node heapdump（如果应用配了）

# 看 GC 日志（启动时需要 --trace-gc）
docker logs --tail 500 agent-core 2>&1 | grep -E "GC\|heap"
```

### 第五步：10 分钟深挖——如果是 Event Loop 阻塞

```bash
# 进入容器拿实时数据
docker exec -it agent-core sh

# 找 node 进程 PID
ps aux | grep node
# 进 /proc/<pid>
cat /proc/<pid>/stack    # 内核调用栈（如果是 sys 调用阻塞）
ls /proc/<pid>/task/      # 各线程
# 给每个 thread 打印 stack
for t in /proc/<pid>/task/*; do echo "=== Thread $(basename $t) ==="; cat $t/stack; done

# 应用层：拿 v8 isolate dump
kill -3 <pid>   # 等同于 SIGQUIT，打印 thread dump 到 stderr
docker logs --tail 100 agent-core

# 如果有 chrome devtools protocol：
# docker exec agent-core node --inspect=0.0.0.0:9229
# 然后从宿主 chrome://inspect 连进去看 heap profile
```

### 第六步：20 分钟深挖——如果是外部依赖

```bash
# 在容器内测试连通性
docker exec agent-core sh -c "nc -zv skill-gateway 18080"  # gateway 通不通
docker exec agent-core sh -c "nc -zv mysql 3306"            # DB 通不通
docker exec agent-core sh -c "curl -m 5 https://api.openai.com/v1/models"  # LLM 通不通

# 看 socket 状态
docker exec agent-core sh -c "ss -tan | head -30"

# 找 ESTABLISHED 但不活动的连接（卡死征兆）
docker exec agent-core sh -c "ss -tan state established | wc -l"
docker exec agent-core sh -c "netstat -anp 2>/dev/null | grep node | grep -v LISTEN | head -20"
```

---

## 四、本地对照（PID 44953 当前状态）

- Local agent-core 在跑（terminal 1），`npm run start:dev` 模式
- 实时日志：看 terminal 1
- 健康检查：`curl http://localhost:3000/api/chat/health`（如果有 health 端点）

**如果内网容器和本地是同一份代码**，本地能跑通说明代码本身没问题——是**部署环境**问题（配置 / 网络 / 资源）。

---

## 五、修复 Cheatsheet（按假设）

| 假设 | 修复 |
|------|------|
| H1 OOM | 调大 memory limit `docker run -m 2g`；找内存泄漏（heapdump → chrome devtools）|
| H2 Event loop 阻塞 | 找阻塞点 `clinic doctor`；把同步代码改 async；加超时 |
| H3 未捕获异常 | 加 `process.on('unhandledRejection', ...)`；用 nest 的 `Logger` |
| H4 外部依赖挂死 | 加 AbortController 超时；用 `Promise.race`；circuit breaker |
| H5 FD 耗尽 | `ulimit -n 65535`；检查连接是否泄漏；连接池用 `withConnection` |
| H6 异步任务积压 | 限流 + 队列 + 主动清理已完成 task |
| H7 LangGraph 泄漏 | 定期 GC；缩短 checkpoint 保留时间 |
| H8 记忆背压 | 加 rate limiter；写消息异步队列化 |

---

## 六、当前状态

[OPEN] — 等待用户报告：
- 容器 State 是什么？（exited / restarting / running 但卡死）
- ExitCode 是几？
- `docker logs` 看到什么？
- 出问题前做了什么操作？（发新版本 / 流量高峰 / 改配置）

下一步需要用户的具体信息才能进入"假设 → 插桩 → 验证"循环。

# agent-core 离线打包与新服务器部署

本文说明在**无法访问 npm registry** 的目标机上如何部署：在能联网的环境完成 `npm install` 与构建，将产物整包拷贝到服务器运行。

## 前提

- 目标机需要能运行 **Node.js**（建议 ≥ 18，与开发环境一致更佳）。离线包通常**不包含** Node 二进制，需单独安装或使用自带 Node 的容器。
- **`node_modules` 与操作系统/CPU 架构相关**：若在 macOS 上安装依赖，不能直接拷到 Linux 使用。应在**与生产相同的 Linux 架构**（如 `linux x64`）上执行 `npm ci`，或在 Docker `linux/amd64` 中构建后再打 tar。

## 一、在有网络的环境打包

在 `backend/agent-core` 目录执行：

```bash
npm ci
npm run build
```

确认生成 `dist/` 目录（Nest 编译输出）。

在项目上级目录或本目录内打压缩包，至少包含：

- `dist/`
- `node_modules/`
- `package.json`
- `package-lock.json`
- `SKILLs/`（运行时若从磁盘加载技能，需一并带上）

示例（在 `backend` 目录下，且已包含 `agent-core` 子目录时）：

```bash
cd backend
tar czvf agent-core-deploy.tar.gz \
  agent-core/dist \
  agent-core/node_modules \
  agent-core/package.json \
  agent-core/package-lock.json \
  agent-core/SKILLs
```

将 `agent-core-deploy.tar.gz` 拷贝到服务器（U 盘、`scp`、内网制品库等）。

## 二、服务器上安装 Node（若尚未安装）

- 若有官方 Linux x64 离线包：解压到例如 `/opt/node`，将 `/opt/node/bin` 加入 `PATH`。
- 若可用系统包管理器：`apt` / `dnf` 等安装 `nodejs`（注意版本）。

验证：

```bash
node -v
```

## 三、解压部署目录

```bash
mkdir -p /opt/agent-core
cd /opt/agent-core
tar xzvf /path/to/agent-core-deploy.tar.gz
```

根据你打包时的路径，实际可能是 `agent-core/` 子目录；请 `cd` 到**同时包含 `package.json`、`dist/`、`node_modules/`** 的那一层。

## 四、环境变量

在应用根目录放置 `.env`（与 `package.json` 同级），或导出为环境变量。Nest 使用 `ConfigModule` 时会读取 `.env`（工作目录应为应用根目录）。

常见项（以项目实际为准）：

- `OPENAI_API_KEY`、`OPENAI_MODEL_NAME`、`OPENAI_API_BASE`（若使用）
- `JAVA_GATEWAY_URL`、`JAVA_GATEWAY_TOKEN`
- 记忆服务、日志等其它在代码或 `.env.example` 中定义的变量

## 五、启动

在应用根目录执行（**工作目录必须正确**，否则相对路径可能失败）：

```bash
cd /opt/agent-core   # 按实际解压路径调整
export NODE_ENV=production
node dist/main.js
```

也可使用：

```bash
npm run start
```

若生产环境未安装 `@nestjs/cli`，优先使用 `node dist/main.js`，不依赖 `nest` 命令。

默认监听端口为 **3000**（见 `src/main.ts`）。本机自检：

```bash
curl -sS http://127.0.0.1:3000/
```

（具体路径以项目路由为准。）

## 六、网络与防火墙

- 云主机安全组需放行对应端口（默认 **3000**），或通过 Nginx/Caddy 反代到 80/443。
- 若仅内网访问，绑定内网 IP 或仅本机 + 反代。

## 七、长期运行（可选）

### systemd

示例单元文件要点：

- `WorkingDirectory=/opt/agent-core`（与 `package.json` 同级）
- `ExecStart=/usr/bin/node /opt/agent-core/dist/main.js`
- `EnvironmentFile=/opt/agent-core/.env`（可选）

### pm2

```bash
cd /opt/agent-core
pm2 start dist/main.js --name agent-core
```

## 八、常见问题

| 现象 | 可能原因 |
|------|----------|
| `Cannot find module` | 当前目录不对，或 `node_modules` 未完整解压 |
| 原生模块报错（如 `.node` load failed） | 在 macOS/Windows 打的 `node_modules` 用于 Linux；应在 Linux 上重新 `npm ci` 并打包 |
| 读不到配置 | `.env` 不在工作目录，或启动时未 `cd` 到应用根目录 |
| 端口不通 | 防火墙/安全组未放行，或只监听了 localhost |

---

更新服务时：在有网环境重新 `npm ci && npm run build`，打新 tar，服务器停进程 → 覆盖 `dist` 与 `node_modules`（或整目录替换）→ 重启。

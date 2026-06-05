## 1. agent-core — 新增 VERSION 文件

- [ ] 1.1 在 `backend/agent-core/` 根目录创建 `VERSION` 文件，初始内容为 `0.1.0`
- [ ] 1.2 确认 `nest-cli.json` 或 `tsconfig` 中 `assets` 配置将 `VERSION` 文件拷贝到 `dist/` 目录（若 `dist/` 下已拷贝则可直接读 `dist/VERSION`）

## 2. agent-core — 修改 HealthController

- [ ] 2.1 在 `health.controller.ts` 中新增 `private readonly version: string` 字段
- [ ] 2.2 在构造函数中通过 `fs.readFileSync` 读取 `VERSION` 文件，赋值到 `this.version`
- [ ] 2.3 若文件读取失败（`ENOENT`），将 `this.version` 设为 `"unknown"`
- [ ] 2.4 将内容做 `.toString().trim()` 处理，去掉末尾换行符
- [ ] 2.5 在 `getHealth()` 返回对象中新增 `version: this.version` 字段

## 3. skill-gateway — 新增 VERSION 文件

- [ ] 3.1 在 `backend/skill-gateway/src/main/resources/` 下创建 `VERSION` 文件，初始内容为 `0.1.0`
- [ ] 3.2 确认 `pom.xml` 中 `<resources>` 配置会将 `VERSION` 打包进 JAR（默认 `src/main/resources/*` 即会）

## 4. skill-gateway — 修改 HealthController

- [ ] 4.1 在 `HealthController.java` 中新增 `private String version` 字段
- [ ] 4.2 添加 `@PostConstruct` 方法 `loadVersion()`：
  - 使用 `org.springframework.core.io.ClassPathResource("VERSION")` 读取
  - 用 `StreamUtils.copyToString(is, StandardCharsets.UTF_8)` 转为字符串
  - 做 `.trim()` 处理
  - catch 异常时设置 `this.version = "unknown"`
- [ ] 4.3 在 `health()` 方法的返回 Map 中新增 `result.put("version", version)`

## 5. 验证

- [ ] 5.1 启动 agent-core，浏览器访问 `http://localhost:3000/health`，确认返回 JSON 包含 `"version": "0.1.0"`
- [ ] 5.2 启动 skill-gateway，浏览器访问 `http://localhost:18080/api/health`，确认返回 JSON 包含 `"version": "0.1.0"`
- [ ] 5.3 修改 VERSION 文件内容为 `1.0.0-test`，重启服务，确认 health 接口返回新版本号
- [ ] 5.4 临时删除 VERSION 文件，重启服务，确认 health 接口返回 `"version": "unknown"` 且状态码仍为 200
- [ ] 5.5 运行 `mvn package -DskipTests` 和 `npm run build`，确认 VERSION 文件随构建产物正确打包

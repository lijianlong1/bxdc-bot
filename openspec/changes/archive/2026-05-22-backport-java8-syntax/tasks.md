## 1. 新增 StringUtils 工具类

- [ ] 1.1 在 `com.lobsterai.skillgateway.util` 包下创建 `StringUtils.java`
  - 提供 `public static boolean isBlank(String s)` 方法
  - 实现：`return s == null || s.trim().isEmpty();`
  - 构造函数设为 `private`

## 2. 替换 String.isBlank() → StringUtils.isBlank()（75 处 / 22 文件）

- [ ] 2.1 `JsonPathUtils.java` (1 处)
- [ ] 2.2 `UserService.java` (1 处)
- [ ] 2.3 `AsyncTaskPollingService.java` (3 处)
- [ ] 2.4 `AsyncTaskPollingScheduler.java` (5 处)
- [ ] 2.5 `UserController.java` (2 处)
- [ ] 2.6 `SkillController.java` (9 处)
- [ ] 2.7 `SecurityConfig.java` (1 处)
- [ ] 2.8 `BuiltinToolExecutionService.java` (3 处)
- [ ] 2.9 `Skill.java` (entity, 1 处)
- [ ] 2.10 `GatewayOutboundAuditMvcTest.java` (1 处，test)
- [ ] 2.11 `SkillService.java` (10 处)
- [ ] 2.12 `ServerLedgerService.java` (12 处)
- [ ] 2.13 `IngressSnapshotReader.java` (1 处)
- [ ] 2.14 `GatewayOutboundAuditService.java` (3 处)
- [ ] 2.15 `LlmHttpAuditService.java` (1 处)
- [ ] 2.16 `SkillIngressCaptureFilter.java` (3 处)
- [ ] 2.17 `AuditHeaderJsonBuilder.java` (3 处)
- [ ] 2.18 `AuditPrincipalResolver.java` (4 处)
- [ ] 2.19 `ServerLedgerController.java` (2 处)
- [ ] 2.20 `LinuxScriptExecutionService.java` (7 处)
- [ ] 2.21 `OutboundUrlNormalizer.java` (1 处)
- [ ] 2.22 `SystemSkillController.java` (1 处)
- [ ] 2.23 所有受影响的文件添加 `import static com.lobsterai.skillgateway.util.StringUtils.isBlank;` 或 `import com.lobsterai.skillgateway.util.StringUtils;`

## 3. 替换 Map.of() → Collections.singletonMap() / HashMap（61 处 / 12 文件）

- [ ] 3.1 `UserService.java` (3 处)：单键值对 → `Collections.singletonMap(k, v)`
- [ ] 3.2 `AsyncTaskPollingScheduler.java` (1 处)：单键值对 → `Collections.singletonMap(k, v)`
- [ ] 3.3 `UserController.java` (11 处)：单键值对 → `Collections.singletonMap(k, v)`
- [ ] 3.4 `SkillController.java` (25 处)：单键值对/多键值对分别处理
- [ ] 3.5 `PollingAuditController.java` (2 处)：双键值对 → `new HashMap<>()` + `put()`
- [ ] 3.6 `BuiltinToolExecutionService.java` (2 处)：单键值对 → `Collections.singletonMap(k, v)`
- [ ] 3.7 `SystemSkillService.java` (1 处)：空 Map → `Collections.emptyMap()` 或 `new HashMap<>()`
- [ ] 3.8 `ApiProxyServiceHeadersTest.java` (3 处，test)：单键值对
- [ ] 3.9 `ServerLedgerController.java` (4 处)：单键值对
- [ ] 3.10 `SystemSkillController.java` (3 处)：单键值对
- [ ] 3.11 `AuthController.java` (5 处)：单键值对
- [ ] 3.12 `HealthController.java` (1 处)：单键值对或改用已有模式

## 4. 替换 List.of() → Arrays.asList()（6 处 / 5 文件）

- [ ] 4.1 `ApiProxyService.java:102`：`List.of(contentTypeInterceptor, auditInterceptor)` → `Arrays.asList(contentTypeInterceptor, auditInterceptor)`
- [ ] 4.2 `SkillGatewayHttpClientConfig.java:33`：同上模式
- [ ] 4.3 `ServerLedgerService.java:124`：`List.of()` → `Collections.emptyList()`
- [ ] 4.4 `ApiProxyServiceHeadersTest.java:25,32` (2 处)：`List.of(...)` → `Arrays.asList(...)`
- [ ] 4.5 `ServerLedgerControllerTest.java:39` (1 处)：同上

## 5. 替换 Set.of() → HashSet + Arrays.asList（2 处 / 2 文件）

- [ ] 5.1 `JsonAuditSanitizer.java:14`：`Set.of(...)` → `new HashSet<>(Arrays.asList(...))`，改用 `static` 代码块初始化或构造时传参
- [ ] 5.2 `AuditHeaderJsonBuilder.java:12`：同上模式

## 6. 替换 Stream.toList() → collect(Collectors.toList())（4 处 / 4 文件）

- [ ] 6.1 `SecurityConfig.java:74`：`.toList()` → `.collect(Collectors.toList())`
- [ ] 6.2 `ContentTypeNormalizingInterceptor.java:86`：同上
- [ ] 6.3 `IngressSnapshotReader.java:41`：同上
- [ ] 6.4 `GatewayOutboundAuditService.java:58`：同上

## 7. 验证与清理

- [ ] 7.1 在 JDK 1.8 环境下执行 `mvn compile -o`，确认 BUILD SUCCESS
- [ ] 7.2 在 JDK 1.8 环境下执行 `mvn test-compile -o`，确认测试源码编译通过
- [ ] 7.3 删除 `.mvn/jvm.config`（含 `--add-opens` 参数，JDK 8 不支持）
- [ ] 7.4 在 macOS（JDK 17）环境下运行全量测试 `mvn test`，确认无回归
- [ ] 7.5 代码审查：确认无遗留的 JDK 9+ API 调用

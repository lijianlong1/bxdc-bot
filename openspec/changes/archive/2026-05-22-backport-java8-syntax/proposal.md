## Why

skill-gateway 的 `pom.xml` 声明 `<java.version>1.8</java.version>` 且编译目标为 `source/target=1.8`，但实际代码中**大量使用了 JDK 9/11/16 才引入的 API**。在 JDK 1.8 的 Windows 内网开发环境上，`mvn compile` 会直接失败。即使 `mvn clean package -DskipTests` 在 macOS（JDK 17）下 BUILD SUCCESS，将 JAR 部署到 JDK 1.8 运行时也会抛出 `NoSuchMethodError`（如 `String.isBlank()`）。

本变更将 **所有不兼容 Java 1.8 的 API 调用/语法** 替换为等价的 Java 8 兼容写法，确保 `mvn compile` 在 JDK 1.8 下零错误通过，且**不改变任何业务行为、不引入新依赖**。

## What Changes

- **BREAKING（编译层）**：以下 JDK 9+ API 调用全部替换为 Java 8 兼容等价写法：
  - `String.isBlank()`（JDK 11）→ 新增 `StringUtils` 工具类提供 `isBlank(String)` 静态方法
  - `Map.of(k, v)` / `Map.of(k1, v1, k2, v2)`（JDK 9）→ `Collections.singletonMap()` / `new HashMap<>()` + `put()`
  - `List.of(a, b)`（JDK 9）→ `Arrays.asList(a, b)`
  - `Set.of(a, b, ...)`（JDK 9）→ `new HashSet<>(Arrays.asList(a, b, ...))`
  - `Stream.toList()`（JDK 16）→ `.collect(Collectors.toList())`

- **不变量**：
  - 所有 Controller / Service / Mapper / Entity / Audit 的业务逻辑 **SHALL NOT** 变更
  - 对外 REST API 契约 **SHALL NOT** 变更
  - 数据库表结构与持久化行为 **SHALL NOT** 变更
  - 不新增任何 Maven 依赖（无需引入 Guava / Apache Commons 等）

## Capabilities

### New Capabilities

- `java8-compatibility`：新增能力规格，约束 skill-gateway 所有 Java 源码必须兼容 JDK 1.8 语法与标准 API；`mvn compile` 在 JDK 1.8 下零错误。

### Modified Capabilities

（无；所有已存在的 capabilities 在功能层面保持不变，仅替换实现方式。）

## Impact

| 影响范围 | 数量 | 说明 |
|----------|------|------|
| `String.isBlank()` | 75 处 / 22 文件 | 全部替换为 `StringUtils.isBlank(s)` |
| `Map.of(...)` | 61 处 / 12 文件 | 按参数个数分别替换 |
| `List.of(...)` | 6 处 / 5 文件 | 替换为 `Arrays.asList(...)` |
| `Set.of(...)` | 2 处 / 2 文件 | 替换为 `new HashSet<>(Arrays.asList(...))` |
| `Stream.toList()` | 4 处 / 4 文件 | 替换为 `.collect(Collectors.toList())` |
| **新增工具类** | 1 个 | `util/StringUtils.java` 提供 `isBlank(String)` |
| **累计涉及文件** | ~35 个 | 含 main 和 test |

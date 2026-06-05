# java8-compatibility Specification

## Purpose

约定 skill-gateway 项目中所有 Java 源码（含 `main` 与 `test`）必须兼容 JDK 1.8 语法与标准 API，确保 `mvn compile` + `mvn test-compile` 在 JDK 1.8 环境下零错误通过。

## Requirements

### Requirement: 禁止使用 JDK 9+ 集合工厂方法

项目 SHALL NOT 使用 `List.of()`、`Set.of()`、`Map.of()`、`Map.ofEntries()` 等 JDK 9 引入的不可变集合静态工厂方法。

#### Scenario: Map.of(k, v) 单键值对

- **WHEN** 需要创建仅包含一个键值对的不可变 Map
- **THEN** SHALL 使用 `java.util.Collections.singletonMap(k, v)`

#### Scenario: List.of(e1, e2, ...) 固定元素

- **WHEN** 需要创建包含固定数量元素的不可变 List
- **THEN** SHALL 使用 `java.util.Arrays.asList(e1, e2, ...)`

#### Scenario: Set.of(e1, e2, ...) 固定元素

- **WHEN** 需要创建包含固定数量元素的不可变 Set
- **THEN** SHALL 使用 `new java.util.HashSet<>(java.util.Arrays.asList(e1, e2, ...))`

### Requirement: 禁止使用 String.isBlank()

项目 SHALL NOT 使用 JDK 11 引入的 `String.isBlank()` 方法。

#### Scenario: 字符串非空且非空白

- **WHEN** 判断一个字符串是否为空或仅包含空白字符
- **THEN** SHALL 使用统一的 `com.lobsterai.skillgateway.util.StringUtils.isBlank(String)` 工具方法
- **AND** 该方法内部实现 SHALL 为 `s == null || s.trim().isEmpty()`

#### Scenario: 工具类位置与命名

- **WHEN** 引入字符串工具方法
- **THEN** SHALL 放在 `com.lobsterai.skillgateway.util.StringUtils` 类中
- **AND** 该类 SHALL 只包含 `isBlank` 一个公开静态方法
- **AND** 类的构造函数 SHALL 为 `private` 以防止实例化

### Requirement: 禁止使用 Stream.toList()

项目 SHALL NOT 使用 JDK 16 引入的 `java.util.stream.Stream.toList()` 终端操作。

#### Scenario: Stream 收集为 List

- **WHEN** 需要将 Stream 的终端结果收集为 List
- **THEN** SHALL 使用 `.collect(java.util.stream.Collectors.toList())`

### Requirement: JDK 1.8 编译兼容性

使用 JDK 1.8 执行 `mvn compile -o` MUST 返回 BUILD SUCCESS，不得出现任何编译错误（不含 warning）。

#### Scenario: 全量编译通过

- **WHEN** 在配置了正确 `JAVA_HOME`（指向 JDK 1.8）的环境中执行 `mvn compile -o`
- **THEN** 编译 MUST 成功，exit code 为 0
- **AND** 不得出现 `cannot find symbol`、`method not found` 等编译错误

#### Scenario: 测试编译通过

- **WHEN** 执行 `mvn test-compile -o`
- **THEN** 测试源码编译 MUST 成功

### Requirement: 不得引入新依赖

改造过程 SHALL NOT 在 `pom.xml` 中新增任何第三方依赖（如 Guava、Apache Commons Lang 等）。

#### Scenario: pom.xml 依赖数量不变

- **WHEN** 对比改造前后 `pom.xml` 的 `<dependencies>` 块
- **THEN** 依赖项数量 SHALL 保持不变
- **AND** 不得新增任何 `<dependency>` 声明

### Requirement: 不得改变业务行为

替换 SHALL 仅影响 API 调用方式，不得改变任何业务逻辑、数据流或输出结果。

#### Scenario: 功能等价性

- **WHEN** 使用相同输入调用任何公开 Service 方法或 Controller 端点
- **THEN** 输出 SHALL 与改造前完全一致
- **AND** 异常抛出的类型与消息 SHALL 保持一致

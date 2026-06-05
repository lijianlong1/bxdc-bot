## ADDED Requirements

### Requirement: Chromium 86 最低基线

本仓库前端产品 SHALL 在 **Chromium 86 及以上**（含同名内核的 WebView / 嵌入式浏览器）环境下，保证主要功能**可用**；低于该版本的浏览器 MAY 显示能力提示或不保证布局。

#### Scenario: 基线在文档或构建中可查

- **WHEN** 维护者查看前端 `browserslist` / Vite 构建说明
- **THEN** 声明的最低 Chromium 目标 **不低于** 86 或与「86 兼容」等价表述一致

### Requirement: 核心页面布局与可点击性

在 Chromium 86 中，用户 MUST 能够完成：**登录、注册（若开放）、进入聊天主界面、使用主要操作按钮**（发送、侧栏入口等），且控件 MUST 无**不可见的重叠导致无法点击**、无**整页空白**等阻断性错误。

#### Scenario: 主路径可交互

- **WHEN** 用户在 Chromium 86 中打开应用并完成一次典型会话（进入聊天并尝试发送消息或等价主操作）
- **THEN** 主要按钮与输入区域 **可见且可点击**
- **AND** 不出现因样式解析失败导致的 **大面积控件错位**（以产品可接受范围内的轻微差异为限）

### Requirement: 构建产物与现代 CSS 风险控制

前端构建流程 SHALL 通过 **显式浏览器目标**（如 `browserslist`、`build.target`、必要时 PostCSS/CSS 编译目标）降低输出 **Chromium 86 无法解析** 的 CSS 语法导致的整段样式失效；若某依赖无法降级，SHALL 通过替代样式或局部覆盖保证关键元素仍可使用。

#### Scenario: 发布构建可追溯

- **WHEN** 执行生产构建脚本（如 `npm run build`）
- **THEN** 配置足以让维护者说明「已针对 Chromium 86 基线做转译/降级策略」
- **AND** 关键界面的破坏性样式回退 **有记录或代码注释**（便于回归）

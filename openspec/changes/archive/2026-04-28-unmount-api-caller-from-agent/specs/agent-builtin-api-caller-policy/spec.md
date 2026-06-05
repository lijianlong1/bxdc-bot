## ADDED Requirements

### Requirement: 默认不挂载 `api_caller`（`JavaApiTool`）且可保留实现

在**默认的** Agent 创建与工具装配路径中，系统 SHALL **不** 向 LLM 注册名称为 `api_caller` 的 built-in 工具（`JavaApiTool`），以便唯一主路径为 **扩展 API Skill** 等受控配置。

`JavaApiTool` 的类定义与其中调用 Skill Gateway 的代码 **MAY** 继续保留在代码库中；若保留，实现 SHALL 在**类**或**原注册点**附中文注释，说明该 built-in **暂时不默认挂载**、保留目的（如后续配置恢复、调试）及与扩展 API 路径的关系，避免被误删或误用。

#### Scenario: 默认 Agent 工具列表不含 `api_caller`

- **WHEN** 通过标准工厂方法创建本仓库所定义的生产用 Agent 且未显式增加额外工具  
- **THEN** 绑定到该 Agent 的 LangChain/StructuredTool 列表中 MUST NOT 包含 `name` 为 `api_caller` 的条目

#### Scenario: 保留代码时的可发现性

- **WHEN** 贡献者阅读 `JavaApiTool` 或原挂载位置  
- **THEN** 其 MUST 能从注释理解：当前**预期**为不默认注册；与扩展 API Skill 的出站路径**不是**「扩展调用本工具实现」

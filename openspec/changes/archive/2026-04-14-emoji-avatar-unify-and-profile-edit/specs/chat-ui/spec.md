## ADDED Requirements

### Requirement: 聊天界面用户头像与统一 emoji 策略一致

聊天消息列表中展示 **当前用户** 头像时，SHALL 使用与 `emoji-display-unification` 一致的渲染方式，避免侧栏/设置与消息区**同一用户头像观感不一致**。

#### Scenario: 消息区与资料区一致

- **WHEN** 用户已设置头像并在聊天中发送消息
- **THEN** 消息列表中该用户头像的展示与统一 emoji 策略 **一致**（同一组件或同一渲染链路）

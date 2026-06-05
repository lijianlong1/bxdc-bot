/**
 * 系统提示词类型定义
 * 
 * 模块职责：
 * 1. 定义多语言提示词的统一接口
 * 2. 确保中英文提示词结构一致
 * 3. 提供类型安全的多语言支持
 * 
 * @module PromptsTypes
 * @author Agent Core Team
 * @since 1.0.0
 */

/**
 * 任务状态映射表类型
 * 从 agent/tasks-state.ts 导入以避免循环依赖
 */
export type TaskStatusValue =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface TaskState {
  label: string;
  status: TaskStatusValue;
  updatedAt: string;
}

export type TasksStatusMap = Record<string, TaskState>;

/**
 * 系统提示词接口
 * 
 * 定义所有需要国际化的系统提示词结构
 * 中英文版本必须实现此接口，确保结构一致
 */
export interface SystemPrompts {
  /**
   * 角色与职责：说明 Agent 的平台定位、工作方式与能力边界
   * （与 `skillGeneratorPolicy` 等静态策略一起由 `runTask` 注入为 `role: system`）
   */
  agentRolePrompt: string;

  /**
   * 策略提示词：技能生成策略
   * 
   * 限制 skill_generator 工具的使用条件，避免重复创建技能
   */
  skillGeneratorPolicy: string;

  /**
   * 策略提示词：任务跟踪策略
   * 
   * 指导 Agent 在多任务场景下跟踪和管理子任务状态
   */
  taskTrackingPolicy: string;

  /**
   * 策略提示词：确认 UI 策略
   * 
   * 明确告知 Agent 高风险操作需通过 UI 按钮确认
   */
  confirmationUIPolicy: string;

  /**
   * 策略提示词：扩展技能路由策略
   * 
   * 优先使用扩展技能而非内置工具，规范参数传递方式
   */
  extendedSkillRoutingPolicy: string;

  /**
   * 构建任务状态摘要
   * 
   * 根据任务状态映射表生成用于注入到 LLM 提示词中的摘要文本
   * 
   * @param tasks - 任务状态映射表
   * @returns 格式化的任务状态摘要
   */
  buildTasksSummary: (tasks: TasksStatusMap) => string;
}

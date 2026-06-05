/**
 * Agent 状态管理模块
 * 
 * 模块职责：
 * 1. 定义 Agent 状态的数据结构（State Annotation）
 * 2. 实现任务状态的跟踪和管理（pending/in_progress/completed/cancelled）
 * 3. 提供 preModelHook 在每次 LLM 调用前注入任务状态摘要
 * 4. 支持从消息历史中重建任务状态
 * 
 * 核心概念：
 * - AgentAnnotation: LangGraph 状态注解，定义状态结构和归约逻辑
 * - TasksStatusMap: 任务状态映射表，记录每个任务的当前状态
 * - preModelHook: 在 LLM 调用前执行的钩子函数，用于状态注入
 * 
 * 设计说明：
 * - 确认流程（CONFIRMATION_REQUIRED）已从本层移除，改由控制器层处理
 * - 通过 SSE 事件 + REST 端点实现技能确认（参见 agent.controller.ts）
 * 
 * @module TasksState
 * @author Agent Core Team
 * @since 1.0.0
 */

import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";
import { Prompts } from "../prompts";

// 注意：CONFIRMATION_REQUIRED 检测辅助函数已移除
// 确认流程现在由控制器层通过 SSE 事件 + REST 端点处理
// 详见 agent.controller.ts

/* ==================== 任务状态类型定义 ==================== */

/**
 * 任务状态枚举值
 * 
 * - pending: 任务待处理，尚未开始执行
 * - in_progress: 任务正在执行中
 * - completed: 任务已完成
 * - cancelled: 任务已取消（用户拒绝或出错）
 */
export type TaskStatusValue =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

/**
 * 单个任务的状态对象
 * 
 * @property label - 任务描述标签
 * @property status - 当前状态
 * @property updatedAt - 最后更新时间（ISO 8601 格式）
 */
export interface TaskState {
  label: string;
  status: TaskStatusValue;
  updatedAt: string;
}

/**
 * 任务状态映射表
 * 
 * 键：任务唯一标识符（如 "check-disk", "restart-nginx"）
 * 值：任务状态对象
 */
export type TasksStatusMap = Record<string, TaskState>;

/* ==================== Agent 状态注解定义 ==================== */

/**
 * 扩展的 Agent 状态注解
 * 
 * 继承 MessagesAnnotation 的消息管理能力
 * 添加 tasks_status 字段用于任务状态跟踪
 * 
 * 归约逻辑（reducer）：
 * - 合并当前状态和更新状态，更新状态优先
 * - 支持增量更新，无需传递完整状态
 */
export const AgentAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  tasks_status: Annotation<TasksStatusMap>({
    reducer: (current: TasksStatusMap, update: TasksStatusMap) => ({
      ...current,
      ...update,
    }),
    default: () => ({}) as TasksStatusMap,
  }),
});

/**
 * Agent 状态类型
 * 
 * 从 AgentAnnotation 推导出的 TypeScript 类型
 */
export type AgentState = typeof AgentAnnotation.State;

/* ==================== 辅助函数 ==================== */

/** manage_tasks 工具的名称常量 */
const MANAGE_TASKS_TOOL_NAME = "manage_tasks";

/**
 * 从消息历史中重建任务状态
 * 
 * 算法：
 * 1. 遍历所有消息，筛选出包含工具调用的 AI 消息
 * 2. 查找 manage_tasks 工具调用
 * 3. 按时间顺序应用任务更新（幂等操作）
 * 4. 返回最终的任务状态映射表
 * 
 * @param messages - 消息历史数组
 * @returns 重建的任务状态映射表
 */
export function rebuildTasksStatusFromMessages(
  messages: BaseMessage[],
): TasksStatusMap {
  const result: TasksStatusMap = {};

  for (const msg of messages) {
    if (!isAIMessageWithToolCalls(msg)) continue;

    const toolCalls: any[] = (msg as any).tool_calls ?? [];
    for (const tc of toolCalls) {
      if (tc.name !== MANAGE_TASKS_TOOL_NAME) continue;

      const updates: any[] = tc.args?.updates;
      if (!Array.isArray(updates)) continue;

      for (const u of updates) {
        if (typeof u.id !== "string" || typeof u.status !== "string") continue;
        result[u.id] = {
          label: u.label ?? result[u.id]?.label ?? "",
          status: u.status,
          updatedAt: u.updatedAt ?? new Date().toISOString(),
        };
      }
    }
  }

  return result;
}

/**
 * 判断消息是否为包含工具调用的 AI 消息
 * 
 * 支持多种消息类型格式（考虑不同 LangChain 版本的兼容性）
 * 
 * @param msg - 消息对象
 * @returns 是否为包含工具调用的 AI 消息
 */
function isAIMessageWithToolCalls(msg: BaseMessage): boolean {
  const type =
    (msg as any).getType?.() ??
    (msg as any)._getType?.() ??
    (msg as any).type ??
    "";
  return (
    (type === "ai" || type === "AIMessageChunk") &&
    Array.isArray((msg as any).tool_calls) &&
    (msg as any).tool_calls.length > 0
  );
}

/**
 * 构建任务状态摘要文本
 * 
 * 委托给 Prompts 模块的对应实现，支持多语言
 * 
 * 格式示例（英文）：
 * ```
 * [Current Task Status] (1/2 completed)
 * - [completed] check-disk: Check disk space
 * - [in_progress] restart-nginx: Restart Nginx
 * 
 * Focus on pending/in_progress tasks...
 * ```
 * 
 * 格式示例（中文）：
 * ```
 * [当前任务状态] (1/2 已完成)
 * - [已完成] check-disk: 检查磁盘空间
 * - [进行中] restart-nginx: 重启 Nginx
 * 
 * 专注于待处理/进行中的任务...
 * ```
 * 
 * @param tasks - 任务状态映射表
 * @returns 格式化的任务状态摘要（根据 AGENT_PROMPTS_LANGUAGE 环境变量选择语言）
 */
export function buildTasksSummary(tasks: TasksStatusMap): string {
  return Prompts.buildTasksSummary(tasks);
}

/**
 * preModelHook - LLM 调用前钩子函数
 * 
 * 执行流程：
 * 1. 从消息历史中重建任务状态（幂等）
 * 2. 合并当前状态和重建状态
 * 3. 生成任务状态摘要
 * 4. 将摘要作为系统消息注入到 LLM 输入消息列表顶部
 * 
 * 目的：让 LLM 在执行前了解当前任务进度，避免重复工作
 * 
 * @param state - 当前 Agent 状态，可能包含 llmInputMessages
 * @returns 更新后的状态和 LLM 输入消息
 */
export function preModelHook(
  state: AgentState & { llmInputMessages?: BaseMessage[] },
) {
  // 从消息历史重建最新任务状态
  const freshStatus = rebuildTasksStatusFromMessages(state.messages ?? []);

  // 合并状态（重建状态优先）
  const merged: TasksStatusMap = { ...state.tasks_status, ...freshStatus };

  // 生成任务摘要
  const summary = buildTasksSummary(merged);

  // 获取基础消息列表
  // llmInputMessages 可能在第一次调用时为 undefined，此时回退到 state.messages
  const base = Array.isArray(state.llmInputMessages)
    ? state.llmInputMessages
    : (state.messages ?? []);
  const llmInputMessages: BaseMessage[] = [...base];

  // 如果有任务摘要，作为系统消息插入到最前面
  if (summary) {
    llmInputMessages.unshift(new SystemMessage(summary));
  }

  return {
    tasks_status: merged,
    llmInputMessages,
  };
}

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ThinkingNode } from '../composables/useThinkingMode'

export type { ThinkingNode }

const props = defineProps<{
  nodes: ThinkingNode[]
  isActive: boolean
}>()

// 整个模块的折叠状态
const isExpanded = ref(false)

// 追踪单个节点的折叠状态
const expandedNodes = ref<Set<string>>(new Set())

const activeNode = computed(() => {
  return props.nodes.find(n => n.status === 'active')
})

const completedNodes = computed(() => {
  return props.nodes.filter(n => n.status === 'completed')
})

// 获取当前步骤的显示文本（更详细的状态描述）
const currentStepText = computed(() => {
  if (!activeNode.value) {
    return completedNodes.value.length > 0 ? '已完成' : '准备中'
  }
  
  const node = activeNode.value
  switch (node.type) {
    case 'thinking':
      return '准备调用...'
    case 'tool_call':
      return `调用工具: ${node.title.replace('调用工具: ', '')}`
    case 'tool_result':
      return '获取工具结果...'
    case 'llm_call':
      return '模型推理中...'
    case 'processing':
      return '生成回复...'
    default:
      return '处理中...'
  }
})

// 获取步骤计数显示
const stepCountText = computed(() => {
  const completed = completedNodes.value.length
  const total = props.nodes.length
  
  if (props.isActive) {
    // 正在进行中，分母用 ... 表示
    return `${completed + 1}/...`
  } else {
    // 已完成，显示实际步数
    return `${completed}/${total}`
  }
})

const getNodeIcon = (type: ThinkingNode['type']) => {
  switch (type) {
    case 'thinking': return '🤔'
    case 'tool_call': return '🔧'
    case 'tool_result': return '📊'
    case 'llm_call': return '🧠'
    case 'processing': return '⚙️'
    default: return '💭'
  }
}

const getNodeLabel = (type: ThinkingNode['type']) => {
  switch (type) {
    case 'thinking': return '调用准备'
    case 'tool_call': return '调用工具'
    case 'tool_result': return '工具返回'
    case 'llm_call': return '模型推理'
    case 'processing': return '处理中'
    default: return '调用'
  }
}

const formatTime = (timestamp: number) => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

const canCollapse = (node: ThinkingNode): boolean => {
  if (node.type === 'llm_call') return false
  return !!node.content || !!node.metadata
}

const isNodeExpanded = (nodeId: string): boolean => {
  return expandedNodes.value.has(nodeId)
}

const toggleNodeExpand = (nodeId: string) => {
  if (expandedNodes.value.has(nodeId)) {
    expandedNodes.value.delete(nodeId)
  } else {
    expandedNodes.value.add(nodeId)
  }
}

const getDisplayContent = (node: ThinkingNode): string | undefined => {
  if (node.type === 'llm_call') {
    return '正在推理...'
  }
  return node.content
}
</script>

<template>
  <div class="thinking-mode-container" :class="{ 'is-active': isActive, 'is-expanded': isExpanded }">
    <!-- 紧凑模式：实时显示当前状态 -->
    <div class="thinking-header" @click="isExpanded = !isExpanded">
      <span class="thinking-icon">{{ isActive ? '🧠' : '✅' }}</span>
      <span class="thinking-title">调用过程</span>
      <span v-if="isActive" class="thinking-pulse-dot" />
      <div class="header-right">
        <span class="current-step" :class="{ 'is-active': isActive }">
          {{ currentStepText }}
        </span>
        <span class="step-count">
          {{ stepCountText }}
        </span>
        <button class="expand-toggle-btn" :title="isExpanded ? '折叠' : '展开'">
          <span :class="{ 'rotated': isExpanded }">▼</span>
        </button>
      </div>
    </div>
    
    <!-- 展开模式：显示所有节点 -->
    <transition name="expand">
      <div v-show="isExpanded" class="thinking-nodes">
        <div
          v-for="(node, index) in nodes"
          :key="node.id"
          class="thinking-node"
          :class="[
            `status-${node.status}`,
            `type-${node.type}`,
            { 'is-last': index === nodes.length - 1 }
          ]"
        >
          <!-- 连接线 -->
          <div v-if="index > 0" class="node-connector">
            <div class="connector-line" :class="{ 'is-active': node.status === 'active' || node.status === 'completed' }" />
          </div>
          
          <!-- 节点内容 -->
          <div class="node-content">
            <!-- 节点图标 -->
            <div class="node-icon-wrapper" :class="{ 'is-pulsing': node.status === 'active' }">
              <span class="node-icon">{{ getNodeIcon(node.type) }}</span>
              <div v-if="node.status === 'active'" class="node-ring" />
            </div>
            
            <!-- 节点信息 -->
            <div class="node-info">
              <div class="node-header">
                <span class="node-label">{{ getNodeLabel(node.type) }}</span>
                <div class="node-header-right">
                  <button
                    v-if="canCollapse(node)"
                    class="collapse-btn"
                    @click.stop="toggleNodeExpand(node.id)"
                    :title="isNodeExpanded(node.id) ? '折叠' : '展开'"
                  >
                    <span :class="{ 'rotated': isNodeExpanded(node.id) }">▼</span>
                  </button>
                  <span class="node-time">{{ formatTime(node.timestamp) }}</span>
                </div>
              </div>
              
              <transition name="collapse">
                <div v-if="(isNodeExpanded(node.id) || !canCollapse(node)) && getDisplayContent(node)" class="node-text">
                  {{ getDisplayContent(node) }}
                </div>
              </transition>
              
              <transition name="collapse">
                <div v-if="isNodeExpanded(node.id) && node.metadata && node.type !== 'llm_call'" class="node-metadata">
                  <span v-for="(value, key) in node.metadata" :key="key" class="metadata-tag">
                    {{ key }}: {{ typeof value === 'object' ? JSON.stringify(value).slice(0, 30) + (JSON.stringify(value).length > 30 ? '...' : '') : value }}
                  </span>
                </div>
              </transition>
            </div>
            
            <!-- 状态指示器 -->
            <div class="node-status">
              <span v-if="node.status === 'pending'" class="status-icon pending">⏳</span>
              <span v-else-if="node.status === 'active'" class="status-icon active">
                <span class="spinner" />
              </span>
              <span v-else-if="node.status === 'completed'" class="status-icon completed">✓</span>
              <span v-else-if="node.status === 'error'" class="status-icon error">✗</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.thinking-mode-container {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
  margin: 8px 0;
  transition: all 0.3s ease;
  overflow: hidden;
}

.thinking-mode-container.is-active {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.thinking-header:hover {
  background: rgba(99, 102, 241, 0.05);
}

.thinking-icon {
  font-size: 16px;
}

.thinking-title {
  font-size: 13px;
  font-weight: 600;
  color: #4c1d95;
  letter-spacing: 0.02em;
}

.thinking-pulse-dot {
  width: 6px;
  height: 6px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border-radius: 50%;
  animation: pulseDot 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulseDot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-step {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
  transition: all 0.3s ease;
}

.current-step.is-active {
  color: #7c3aed;
  animation: stepBlink 1s ease-in-out infinite;
}

@keyframes stepBlink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.step-count {
  font-size: 11px;
  color: #9ca3af;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  min-width: 36px;
  text-align: center;
}

.expand-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  font-size: 10px;
  color: #9ca3af;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.expand-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #6366f1;
}

.expand-toggle-btn span {
  display: inline-block;
  transition: transform 0.2s ease;
  line-height: 1;
}

.expand-toggle-btn span.rotated {
  transform: rotate(180deg);
}

.thinking-nodes {
  padding: 0 14px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.thinking-node {
  position: relative;
  padding: 6px 0;
}

.node-connector {
  position: absolute;
  left: 18px;
  top: -8px;
  height: 14px;
  width: 2px;
}

.connector-line {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #e5e7eb 0%, #e5e7eb 100%);
  transition: background 0.3s ease;
}

.connector-line.is-active {
  background: linear-gradient(180deg, #6366f1 0%, #a855f7 100%);
}

.node-content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.node-icon-wrapper {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.node-icon-wrapper.is-pulsing {
  border-color: #6366f1;
  animation: iconPulse 2s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(99, 102, 241, 0);
  }
}

.node-ring {
  position: absolute;
  inset: -3px;
  border: 2px solid transparent;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: ringRotate 1s linear infinite;
}

@keyframes ringRotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.node-icon {
  font-size: 14px;
  line-height: 1;
}

.status-active .node-icon-wrapper {
  border-color: #6366f1;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
}

.status-completed .node-icon-wrapper {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.status-error .node-icon-wrapper {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 2px;
}

.node-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.node-time {
  font-size: 10px;
  color: #9ca3af;
}

.collapse-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 1px;
  font-size: 8px;
  color: #9ca3af;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

.collapse-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #6366f1;
}

.collapse-btn span {
  display: inline-block;
  transition: transform 0.2s ease;
  line-height: 1;
}

.collapse-btn span.rotated {
  transform: rotate(-90deg);
}

.node-text {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.4;
  margin-bottom: 2px;
  word-break: break-word;
}

.node-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding-top: 3px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.metadata-tag {
  font-size: 9px;
  padding: 1px 6px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  border-radius: 3px;
  font-weight: 500;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-status {
  flex-shrink: 0;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 12px;
}

.status-icon.pending {
  opacity: 0.5;
}

.status-icon.active .spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spinnerRotate 0.8s linear infinite;
}

@keyframes spinnerRotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-icon.completed {
  color: #10b981;
  font-weight: bold;
}

.status-icon.error {
  color: #ef4444;
  font-weight: bold;
}

.type-thinking .node-label {
  color: #7c3aed;
}

.type-tool_call .node-label {
  color: #059669;
}

.type-tool_result .node-label {
  color: #0284c7;
}

.type-llm_call .node-label {
  color: #dc2626;
}

.type-processing .node-label {
  color: #ea580c;
}

.thinking-node {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 150px;
}

@media (max-width: 640px) {
  .thinking-mode-container {
    margin: 6px 0;
  }
  
  .thinking-header {
    padding: 8px 12px;
  }
  
  .thinking-icon {
    font-size: 14px;
  }
  
  .thinking-title {
    font-size: 12px;
  }
  
  .node-icon-wrapper {
    width: 28px;
    height: 28px;
  }
  
  .node-icon {
    font-size: 12px;
  }
}
</style>

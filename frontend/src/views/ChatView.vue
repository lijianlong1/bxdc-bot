<script setup lang="ts">
import { onMounted, onErrorCaptured, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { provideChat } from '../composables/useChat'
import Layout from '../components/Layout.vue'
import MessageList from '../components/MessageList.vue'
import MessageInput from '../components/MessageInput.vue'

const { error, fetchGreeting } = provideChat()
const route = useRoute()

onMounted(() => {
  fetchGreeting()
  const taskId = route.query.taskId
  if (typeof taskId === 'string' && taskId) {
    try {
      sessionStorage.setItem('pendingTaskId', taskId)
    } catch {
      // ignore
    }
  }
  // 调试：抓 TCard 内部结构
  nextTick(() => {
    setTimeout(() => {
      const shell = document.querySelector('.chat-shell')
      if (shell) {
        console.log('=== .chat-shell 子节点 ===')
        Array.from(shell.children).forEach((c, i) => {
          const r = c.getBoundingClientRect()
          const cs = getComputedStyle(c)
          console.log(`  child[${i}]: <${c.tagName.toLowerCase()}> class="${c.className}" ${r.width.toFixed(0)}x${r.height.toFixed(0)} display=${cs.display}`)
          Array.from(c.children).forEach((cc, j) => {
            const rr = cc.getBoundingClientRect()
            const ccs = getComputedStyle(cc)
            console.log(`    grandchild[${j}]: <${cc.tagName.toLowerCase()}> class="${cc.className}" ${rr.width.toFixed(0)}x${rr.height.toFixed(0)} display=${ccs.display}`)
          })
        })
      }
      // 查 TCard 全部 children
      const tc = document.querySelector('.t-card')
      if (tc) {
        console.log('=== .t-card 内部（不通过 .chat-shell .t-card 链） ===')
        Array.from(tc.children).forEach((c, i) => {
          const r = c.getBoundingClientRect()
          console.log(`  tcc[${i}]: <${c.tagName.toLowerCase()}> class="${c.className}" ${r.width.toFixed(0)}x${r.height.toFixed(0)}`)
        })
      } else {
        console.log('=== .t-card not found, 直接查 chat-shell 内层 ===')
      }
      // 打印 .t-card__body 上一层（直接父级）
      const body = document.querySelector('.chat-shell .t-card__body')
      if (body && body.parentElement) {
        const pe = body.parentElement
        const r = pe.getBoundingClientRect()
        console.log(`t-card__body parent: <${pe.tagName.toLowerCase()}> class="${pe.className}" ${r.width.toFixed(0)}x${r.height.toFixed(0)}`)
      }
    }, 1000)
  })
})

onErrorCaptured((err) => {
  console.error('[ChatView captured error]:', err)
  return false
})
</script>

<template>
  <Layout>
    <div class="chat-wrapper">
      <div class="chat-shell">
        <div class="chat-container">
          <div class="chat-main">
            <MessageList />
          </div>
          <t-alert
            v-if="error"
            class="chat-error"
            theme="error"
            :message="error"
          />
        </div>
      </div>

      <div class="input-box">
        <MessageInput />
      </div>
    </div>
  </Layout>
</template>

<style scoped>
.chat-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  padding: 12px;
  gap: 16px;
}

@media (min-width: 768px) {
  .chat-wrapper {
    padding: 16px;
    gap: 20px;
  }
}

.chat-shell {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--td-bg-color-container);
  overflow: hidden;
  box-shadow: var(--td-shadow-1);
  border: 1px solid var(--td-component-border);
}

.input-box {
  flex: 0 0 auto;
  padding: 12px 16px 16px;
  border-radius: 16px;
  background: var(--td-bg-color-container);
}

@media (min-width: 768px) {
  .input-box {
    padding: 16px 20px 20px;
  }
}

.chat-container {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  gap: 12px;
}

.chat-main {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-error {
  flex: 0 0 auto;
  margin: 0 12px;
}

@media (min-width: 768px) {
  .chat-error {
    margin: 0 24px;
  }
}
</style>

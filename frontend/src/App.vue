<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { provideFileUpload } from './composables/useFileUpload'

const globalConfig = {
  locale: {
    empty: { titleText: { empty: '' } },
    autoComplete: { empty: '' },
    cascader: { empty: '' },
    transfer: { empty: '' },
    table: { empty: '' },
    select: { empty: '' },
    tree: { empty: '' },
    treeSelect: { empty: '' },
  },
}

// 在 App 层级 provide，跨路由切换（ChatView 卸载/重建）时状态保持
const fileUpload = provideFileUpload()

/** 关闭/刷新浏览器窗口时清空文件状态（图片 previewUrl 释放） */
function clearOnWindowUnload() {
  fileUpload.clearFiles()
}

onMounted(() => {
  window.addEventListener('beforeunload', clearOnWindowUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', clearOnWindowUnload)
})
</script>

<template>
  <t-config-provider :global-config="globalConfig">
    <router-view />
  </t-config-provider>
</template>

<style>
html, body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

#app {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#app > * {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>

import { createApp } from 'vue'
import TDesign from 'tdesign-vue-next'
import TDesignChat from '@tdesign-vue-next/chat'
import 'tdesign-vue-next/es/style/index.css'
import '@tdesign-vue-next/chat/es/style/index.css'
import './style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(TDesign)
app.use(TDesignChat)
app.use(router)
app.mount('#app')

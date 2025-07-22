import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor'

const app = createApp(App)

//app.use(createPinia())
app.use(router)

app.mount('#app')


app.use(VueMonacoEditorPlugin, {
  paths: {
    // You can change the CDN config to load other versions
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'
  },
})




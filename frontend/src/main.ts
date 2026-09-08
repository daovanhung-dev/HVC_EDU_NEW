import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './styles.css'
import App from './App.vue'
import router from './app/router'

createApp(App).use(createPinia()).use(router).mount('#app')

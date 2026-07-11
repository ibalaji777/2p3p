import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { errorTracker } from './core/errorTracker.js'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Initialize the global error tracking service
errorTracker.init({ environment: process.env.NODE_ENV || 'development' });

// Global Error Handler for Production Readiness
app.config.errorHandler = (err, instance, info) => {
    errorTracker.captureException(err, { vueInfo: info, component: instance?.$options?.name });
};

app.mount('#app')
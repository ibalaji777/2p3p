import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Global Error Handler for Production Readiness
app.config.errorHandler = (err, instance, info) => {
    // In the future, this is where we would report to Sentry or another crash reporting tool
    console.error('[Global Error Boundary Caught Error]:', err);
    console.error('Vue Instance:', instance);
    console.error('Error Info:', info);
};

app.mount('#app')
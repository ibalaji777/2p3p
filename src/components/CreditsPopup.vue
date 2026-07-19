<template>
    <div class="popup-overlay" v-if="isVisible" @click.self="close">
        <div class="popup-content credits-content">
            <div class="popup-header">
                <h3>About & Credits</h3>
                <button class="close-btn" @click="close">✕</button>
            </div>
            <div class="popup-body">
                <p>This application uses high-quality 3D models licensed under Creative Commons.</p>
                <div class="credits-list">
                    <div v-for="item in credits" :key="item.id" class="credit-item">
                        <strong>{{ item.label }}</strong>
                        <span class="author">by {{ item.author }}</span>
                        <span class="license">{{ item.license }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { FURNITURE_REGISTRY } from '../features/furniture/furniture.registry.js';

const isVisible = ref(false);

const open = () => {
    isVisible.value = true;
};

const close = () => {
    isVisible.value = false;
};

const credits = computed(() => {
    const list = [];
    Object.values(FURNITURE_REGISTRY).forEach(item => {
        if (item.author || item.license) {
            list.push({
                id: item.id,
                label: item.label || item.name,
                author: item.author || 'Unknown',
                license: item.license || 'Unknown'
            });
        }
    });
    return list;
});

defineExpose({ open, close });
</script>

<style scoped>
.popup-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
.popup-content {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
.popup-header {
    padding: 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.popup-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #1e293b;
    font-weight: 600;
}
.close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #64748b;
}
.popup-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
}
.popup-body p {
    color: #475569;
    margin-bottom: 20px;
    font-size: 0.9rem;
}
.credits-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.credit-item {
    background: #f8fafc;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.credit-item strong {
    color: #1e293b;
    font-size: 0.95rem;
}
.credit-item .author, .credit-item .license {
    color: #64748b;
    font-size: 0.75rem;
    line-height: 1.2;
}
</style>

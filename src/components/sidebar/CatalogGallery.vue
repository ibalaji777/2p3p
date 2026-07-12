<template>
    <div class="catalog-gallery">
        <div class="catalog-header">
            <h3>{{ type === 'door' ? 'Door Catalog' : 'Window Catalog' }}</h3>
            <div class="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" v-model="searchQuery" placeholder="Search models..." />
            </div>
        </div>

        <div class="catalog-grid">
            <div class="catalog-item" 
                 v-for="item in filteredItems" 
                 :key="item.id" 
                 :class="{ active: modelValue === item.id }"
                 @click="$emit('update:modelValue', item.id); $emit('select', item)">
                <div class="thumbnail-wrapper">
                    <img :src="item.image" :alt="item.name" @error="handleImageError" />
                    <div class="active-badge" v-if="modelValue === item.id">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                </div>
                <span class="item-name">{{ item.name }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
    type: { type: String, required: true },
    modelValue: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'select']);

const searchQuery = ref('');

const doorCatalog = [
    { id: 'single', name: 'Single Hinged Door', image: '/assets/catalog/single_hinged_door.png', params: { doorType: 'single', doorStyle: 'flat', width: 40 } },
    { id: 'french', name: 'Double French Door', image: '/assets/catalog/double_french_door.png', params: { doorType: 'french', doorStyle: 'glass_grid', width: 80 } },
    { id: 'sliding', name: 'Sliding Glass Door', image: '/assets/catalog/sliding_glass_door.png', params: { doorType: 'sliding', doorStyle: 'glass_bottom_panel', width: 80 } },
    { id: 'pocket', name: 'Pocket Door', image: '/assets/catalog/pocket_door.png', params: { doorType: 'pocket', doorStyle: 'flat', width: 40 } },
    { id: 'classic_4', name: 'Classic 4-Panel', image: '/assets/catalog/single_hinged_door.png', params: { doorType: 'single', doorStyle: 'classic_4_panel', width: 40 } },
];

const windowCatalog = [
    { id: 'sliding_std', name: 'Standard Sliding', image: '/assets/catalog/standard_sliding_window.png', params: { windowType: 'sliding_std', width: 60 } },
    { id: 'casement_std', name: 'Casement Window', image: '/assets/catalog/casement_window.png', params: { windowType: 'casement_std', width: 40 } },
    { id: 'fixed_elevation', name: 'Fixed Picture Window', image: '/assets/catalog/fixed_glass_window.png', params: { windowType: 'fixed_elevation', width: 80 } },
    { id: 'bay_box', name: 'Bay Window', image: '/assets/catalog/bay_box_window.png', params: { windowType: 'bay_box', width: 80 } },
    { id: 'panoramic_slider', name: 'Panoramic Slider', image: '/assets/catalog/standard_sliding_window.png', params: { windowType: 'panoramic_slider', width: 120 } },
];

const items = computed(() => props.type === 'door' ? doorCatalog : windowCatalog);

const filteredItems = computed(() => {
    if (!searchQuery.value) return items.value;
    const q = searchQuery.value.toLowerCase();
    return items.value.filter(i => i.name.toLowerCase().includes(q));
});

const handleImageError = (e) => {
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23d1d5db' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
};
</script>

<style scoped>
.catalog-gallery {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f8fafc;
    border-radius: 8px;
    overflow: hidden;
}

.catalog-header {
    padding: 12px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
}

.catalog-header h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #1e293b;
    font-weight: 600;
}

.search-box {
    position: relative;
    display: flex;
    align-items: center;
}

.search-icon {
    position: absolute;
    left: 8px;
    width: 14px;
    height: 14px;
    color: #94a3b8;
}

.search-box input {
    width: 100%;
    padding: 8px 8px 8px 28px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
}

.search-box input:focus {
    border-color: #3b82f6;
}

.catalog-grid {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    align-content: start;
}

.catalog-item {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.2s;
}

.catalog-item:hover .thumbnail-wrapper {
    border-color: #93c5fd;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.thumbnail-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    border: 2px solid transparent;
    background: white;
    overflow: hidden;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
}

.thumbnail-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.catalog-item.active .thumbnail-wrapper {
    border-color: #3b82f6;
}

.active-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    background: #3b82f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.active-badge svg {
    width: 12px;
    height: 12px;
}

.item-name {
    font-size: 11px;
    color: #475569;
    text-align: center;
    line-height: 1.2;
    font-weight: 500;
}
</style>

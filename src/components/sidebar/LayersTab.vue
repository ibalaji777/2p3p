<template>
  <div class="layers-content">
    <div class="layers-list">
        <div v-for="item in layerItems" :key="item.id" 
             class="layer-row layer-item" 
             :class="{active: selectedEntity === item.entity, subitem: item.isSubItem}" 
             @click="$emit('select-layer-item', item)">
            
            <div class="layer-col-eye">
                <button class="layer-eye-btn" @click.stop="$emit('toggle-layer-visibility', item)">
                    <svg v-if="!item.entity.isHidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
            </div>
            
            <div class="layer-col-icon" v-html="item.type === 'preset_group' ? getLayerSvg('folder') : getLayerSvg(item.type, item.name)"></div>
            
            <div class="layer-col-name">{{ item.name }}</div>
            
            <div class="layer-col-actions" style="position: relative;">
                <button class="layer-dots-btn" @click.stop="activeLayerDropdown = activeLayerDropdown === item.id ? null : item.id">⋮</button>
                
                <!-- Dropdown Menu -->
                <div v-if="activeLayerDropdown === item.id" class="layer-dropdown" @click.stop>
                    <input type="text" v-model="item.entity.description" @input="$emit('debounced-save-history')" placeholder="Add description..." class="layer-dropdown-input" />
                    <button class="layer-dropdown-del" @click.stop="$emit('remove-layer-item', item); activeLayerDropdown = null;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        Delete
                    </button>
                </div>
            </div>
        </div>
        <div v-if="layerItems.length === 0" class="props-empty">No objects in the current floor.</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
    layerItems: { type: Array, required: true },
    selectedEntity: { type: Object, default: null }
});

defineEmits(['select-layer-item', 'toggle-layer-visibility', 'debounced-save-history', 'remove-layer-item']);

const activeLayerDropdown = ref(null);

const getLayerSvg = (type, name = '') => {
    let resolvedType = type;
    const n = name.toLowerCase();
    if (type === 'widget' || type === 'advance_openings') {
        if (n.includes('window')) resolvedType = 'window';
        else resolvedType = 'door';
    }

    const defaultSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
    const svgs = {
        'folder': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
        'wall': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16v-4H8V4z"></path></svg>`,
        'arc': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 A 16 16 0 0 1 20 4 v 4 A 12 12 0 0 0 8 20 H 4 z"></path></svg>`,
        'railing': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12 M20 6v12 M4 10h16 M4 14h16"></path></svg>`,
        'roof': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l10-9 10 9 M4 10v10h16V10"></path></svg>`,
        'door': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><path d="M14 12v.01"></path></svg>`,
        'window': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 12h18 M12 3v18"></path></svg>`,
        'room': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18 M9 21V9"></path></svg>`,
        'floor': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18 M9 21V9"></path></svg>`,
        'shape': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
        'stair': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4v-4h4v-4h4v-4h4"></path></svg>`
    };
    return svgs[resolvedType] || defaultSvg;
};
</script>

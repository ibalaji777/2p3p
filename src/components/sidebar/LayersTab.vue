<template>
  <div class="layers-content">
    <!-- Header with Search & Layer Count -->
    <div class="layers-header">
      <div class="layers-search-wrapper">
        <svg class="layers-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search 2D layers..." 
          class="layers-search-input" 
        />
        <button v-if="searchQuery" class="layers-search-clear" @click="searchQuery = ''" title="Clear search">✕</button>
      </div>
      <div class="layers-count-badge" v-if="layerItems.length > 0">
        {{ filteredLayerItems.length }} / {{ layerItems.length }}
      </div>
    </div>

    <!-- Layers List -->
    <div class="layers-list">
      <div 
        v-for="item in filteredLayerItems" 
        :key="item.id" 
        class="layer-item-wrapper"
        :class="{ active: selectedEntity === item.entity, subitem: item.isSubItem }"
      >
        <div 
          class="layer-row layer-item" 
          :class="{ active: selectedEntity === item.entity }" 
          @click="$emit('select-layer-item', item)"
        >
          <!-- Eye Visibility Toggle Button -->
          <div class="layer-col-eye">
            <button 
              class="layer-eye-btn" 
              :title="item.entity && item.entity.isHidden ? 'Show layer' : 'Hide layer'" 
              @click.stop="$emit('toggle-layer-visibility', item)"
            >
              <svg v-if="item.entity && !item.entity.isHidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            </button>
          </div>

          <!-- Type Icon -->
          <div class="layer-col-icon" v-html="item.type === 'preset_group' ? getLayerSvg('folder') : getLayerSvg(item.type, item.name)"></div>

          <!-- Name & Description info -->
          <div class="layer-col-info">
            <div class="layer-col-name" :title="item.name">{{ item.name }}</div>
            <div 
              v-if="item.entity && item.entity.description && editingDescItemId !== item.id" 
              class="layer-col-desc" 
              :title="'Description: ' + item.entity.description + ' (Click to edit)'"
              @click.stop="startEditDescription(item)"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>{{ item.entity.description }}</span>
            </div>
          </div>

          <!-- Action Buttons: Description & Delete -->
          <div class="layer-col-actions">
            <!-- Edit / Add Description Button -->
            <button 
              class="layer-action-btn layer-desc-btn" 
              :class="{ 'has-desc': item.entity && !!item.entity.description, 'is-editing': editingDescItemId === item.id }" 
              :title="item.entity && item.entity.description ? 'Edit description: &quot;' + item.entity.description + '&quot;' : 'Add description'" 
              @click.stop="toggleEditDescription(item)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>

            <!-- Delete Button -->
            <button 
              class="layer-action-btn layer-del-btn" 
              title="Delete layer item" 
              @click.stop="$emit('remove-layer-item', item)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Inline Description Input Editor -->
        <div v-if="editingDescItemId === item.id" class="layer-desc-editor" @click.stop>
          <input 
            type="text" 
            v-model="editDescValue" 
            placeholder="Add description (e.g. Master Bedroom Wall)..." 
            class="layer-desc-input" 
            @keydown.enter="saveDescription(item)" 
            @keydown.esc="cancelDescription"
            ref="descInputRef"
          />
          <div class="layer-desc-editor-actions">
            <button class="layer-desc-save-btn" title="Save description (Enter)" @click.stop="saveDescription(item)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
            <button class="layer-desc-cancel-btn" title="Cancel (Esc)" @click.stop="cancelDescription">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredLayerItems.length === 0" class="props-empty">
        <span v-if="searchQuery">No matching layers found for "{{ searchQuery }}".</span>
        <span v-else>No objects in the current floor.</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';

const props = defineProps({
    layerItems: { type: Array, required: true },
    selectedEntity: { type: Object, default: null }
});

const emit = defineEmits(['select-layer-item', 'toggle-layer-visibility', 'debounced-save-history', 'remove-layer-item']);

const searchQuery = ref('');
const editingDescItemId = ref(null);
const editDescValue = ref('');
const descInputRef = ref(null);

const filteredLayerItems = computed(() => {
    if (!searchQuery.value.trim()) return props.layerItems;
    const q = searchQuery.value.toLowerCase().trim();
    return props.layerItems.filter(item => {
        const nameMatch = item.name && item.name.toLowerCase().includes(q);
        const descMatch = item.entity && item.entity.description && item.entity.description.toLowerCase().includes(q);
        const typeMatch = item.type && item.type.toLowerCase().includes(q);
        return nameMatch || descMatch || typeMatch;
    });
});

const startEditDescription = (item) => {
    editingDescItemId.value = item.id;
    editDescValue.value = item.entity && item.entity.description ? item.entity.description : '';
    nextTick(() => {
        if (descInputRef.value) {
            const el = Array.isArray(descInputRef.value) ? descInputRef.value[0] : descInputRef.value;
            if (el && typeof el.focus === 'function') el.focus();
        }
    });
};

const toggleEditDescription = (item) => {
    if (editingDescItemId.value === item.id) {
        saveDescription(item);
    } else {
        startEditDescription(item);
    }
};

const saveDescription = (item) => {
    if (item && item.entity) {
        const trimmed = editDescValue.value.trim();
        item.entity.description = trimmed || undefined;
        emit('debounced-save-history');
    }
    editingDescItemId.value = null;
    editDescValue.value = '';
};

const cancelDescription = () => {
    editingDescItemId.value = null;
    editDescValue.value = '';
};

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
        'stair': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4v-4h4v-4h4v-4h4"></path></svg>`,
        'furniture': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5"></path><path d="M2 11h20v6H2z"></path><path d="M4 17v3M20 17v3"></path></svg>`
    };
    return svgs[resolvedType] || defaultSvg;
};
</script>

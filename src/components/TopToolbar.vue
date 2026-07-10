<template>
    <header class="top-toolbar">
       <div class="left-tools">
           <button class="tool-btn" :class="{active: viewMode==='2d'}" @click="$emit('switch-2d')">
               <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                   <path d="M15 5l4 4"></path>
                   <path d="M3 21h6v-6"></path>
               </svg>
               <span class="tool-label">2D Plan</span>
           </button>

           <button class="tool-btn" :class="{active: viewMode==='3d'}" @click="$emit('switch-3d')">
               <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                   <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                   <line x1="12" y1="22.08" x2="12" y2="12"></line>
               </svg>
               <span class="tool-label">3D Build</span>
           </button>
       </div>
       
       <div class="center-tools" v-if="viewMode==='2d'">
       </div>

       <div class="right-tools">
           <button class="tool-btn" @click="$emit('undo')" :disabled="historyIndex <= 0" title="Undo (Ctrl+Z)">
               <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
               <span class="tool-label">Undo</span>
           </button>
           <button class="tool-btn" @click="$emit('redo')" :disabled="historyIndex >= historyLength - 1" title="Redo (Ctrl+Y)">
               <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path></svg>
               <span class="tool-label">Redo</span>
           </button>
       </div>
    </header>
</template>

<script setup>
const props = defineProps({
  viewMode: String,
  viewMode3D: String,
  historyIndex: Number,
  historyLength: Number
});

const emit = defineEmits(['switch-2d', 'switch-3d', 'toggle-preview', 'undo', 'redo']);
</script>
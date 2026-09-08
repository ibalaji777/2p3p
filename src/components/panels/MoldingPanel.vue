<template>
    <MoldingProperties 
        :selected-entity="selectedEntity" 
        @sync-engine="$emit('sync-engine')" 
        @delete-entity="$emit('delete-entity')" 
    />
</template>

<script setup>
import { MoldingProperties } from '../../features/molding/index.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);
</script>

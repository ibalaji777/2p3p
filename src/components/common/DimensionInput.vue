<template>
  <input
    type="number"
    :value="displayValue"
    @input="onInput"
    @change="onChange"
    @blur="onBlur"
    v-bind="$attrs"
  />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useDimension } from '../../core/units/useDimension.js';

const props = defineProps({
  modelValue: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const { currentUnit, toDisplay, toInternal } = useDimension();

const displayValue = ref(0);

// Sync internal model to display value (e.g., when loaded or unit changed)
const syncToDisplay = () => {
    displayValue.value = toDisplay(props.modelValue);
};

watch(() => props.modelValue, syncToDisplay);
watch(currentUnit, syncToDisplay);

onMounted(syncToDisplay);

const onInput = (e) => {
    // We let the user type numbers. We don't convert until they are done typing or we could do it on input.
    // However, continuous conversion on @input can cause precision jumping. 
    // It's safer to store the raw string they type into a local ref, and only emit on @change or @input if valid.
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
        displayValue.value = val;
        const internal = toInternal(val);
        emit('update:modelValue', internal);
    }
};

const onChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
        displayValue.value = val;
        const internal = toInternal(val);
        emit('update:modelValue', internal);
        emit('change', internal);
    }
};

const onBlur = () => {
    // Re-format to clean up precision formatting
    syncToDisplay();
};
</script>

<script>
export default {
    inheritAttrs: false
}
</script>

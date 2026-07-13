// src/core/units/useDimension.js
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/useSettingsStore.js';
import { UnitConverter } from './UnitConverter.js';
import { UNITS } from './unit.constants.js';

export function useDimension() {
    const settingsStore = useSettingsStore();

    // The current global unit setting
    const currentUnit = computed(() => settingsStore.floorPlanSettings?.measurementUnit || UNITS.MILLIMETERS);

    // Converts an internal inch value to the current display format
    const toDisplay = (inches) => {
        return UnitConverter.inchesToDisplay(inches, currentUnit.value);
    };

    // Converts a user input value back to internal inches
    const toInternal = (displayValue) => {
        return UnitConverter.displayToInches(displayValue, currentUnit.value);
    };

    // Formats with suffix string
    const formatLabel = (inches) => {
        return UnitConverter.formatLabel(inches, currentUnit.value);
    };

    // Computes the unit suffix string (e.g. for CSS variables or input hints)
    const unitSuffix = computed(() => {
        const u = currentUnit.value;
        if (u === UNITS.FEET_INCHES) return UNITS.INCHES;
        return u;
    });

    return {
        currentUnit,
        unitSuffix,
        toDisplay,
        toInternal,
        formatLabel
    };
}

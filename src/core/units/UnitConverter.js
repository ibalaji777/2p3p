// src/core/units/UnitConverter.js
import { UNITS, CONVERSION_RATIOS } from './unit.constants.js';

export class UnitConverter {
    /**
     * Converts an internal value (inches) to the target display unit.
     * @param {number} inches - The internal value in inches.
     * @param {string} targetUnit - The selected unit (e.g., 'mm', 'cm', 'm', 'ft', 'feet_inches', 'in')
     * @returns {number} The value in the target unit.
     */
    static inchesToDisplay(inches, targetUnit) {
        if (inches === undefined || inches === null || isNaN(inches)) return 0;
        
        // Treat feet_inches as purely inches for numerical inputs to avoid string parsing issues in standard number fields.
        const unit = targetUnit === UNITS.FEET_INCHES ? UNITS.INCHES : targetUnit;
        
        const ratio = CONVERSION_RATIOS[unit] || 1;
        const result = inches * ratio;
        
        // Round based on unit precision
        return this.applyPrecision(result, unit);
    }

    /**
     * Converts a user-entered display value back to the internal unit (inches).
     * @param {number} displayValue - The numeric value from the input field.
     * @param {string} currentUnit - The currently selected display unit.
     * @returns {number} The value in internal inches.
     */
    static displayToInches(displayValue, currentUnit) {
        if (displayValue === undefined || displayValue === null || isNaN(displayValue)) return 0;
        
        const unit = currentUnit === UNITS.FEET_INCHES ? UNITS.INCHES : currentUnit;
        const ratio = CONVERSION_RATIOS[unit] || 1;
        
        // Prevent division by zero
        if (ratio === 0) return 0;
        
        const inches = displayValue / ratio;
        
        // Standardize internal inch precision to 4 decimal places
        return Math.round(inches * 10000) / 10000;
    }

    /**
     * Applies standard precision rounding based on the unit.
     * @param {number} value 
     * @param {string} unit 
     */
    static applyPrecision(value, unit) {
        switch (unit) {
            case UNITS.MILLIMETERS:
                return Math.round(value); // Whole mm
            case UNITS.CENTIMETERS:
            case UNITS.INCHES:
            case UNITS.FEET_INCHES:
                return Math.round(value * 10) / 10; // 1 decimal place (e.g. 101.6)
            case UNITS.METERS:
            case UNITS.FEET:
                return Math.round(value * 100) / 100; // 2 decimal places (e.g. 1.02)
            default:
                return value;
        }
    }
    
    /**
     * Formats an internal inch value into a readable string with suffix.
     * Useful for labels and 2D canvas texts.
     * @param {number} inches 
     * @param {string} targetUnit 
     */
    static formatLabel(inches, targetUnit) {
        if (targetUnit === UNITS.FEET_INCHES) {
            const totalInches = Math.round(inches);
            const feet = Math.floor(totalInches / 12);
            const remainingInches = totalInches % 12;
            if (remainingInches > 0) return `${feet}' ${remainingInches}"`;
            return `${feet}'`;
        }
        
        const val = this.inchesToDisplay(inches, targetUnit);
        
        switch (targetUnit) {
            case UNITS.FEET: return `${val} ft`;
            case UNITS.MILLIMETERS: return `${val} mm`;
            case UNITS.CENTIMETERS: return `${val} cm`;
            case UNITS.METERS: return `${val} m`;
            case UNITS.INCHES:
            default: return `${val}"`;
        }
    }
}

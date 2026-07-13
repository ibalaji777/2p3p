// src/core/units/unit.constants.js

export const UNITS = {
    INCHES: 'in',
    FEET: 'ft',
    MILLIMETERS: 'mm',
    CENTIMETERS: 'cm',
    METERS: 'm',
    FEET_INCHES: 'feet_inches'
};

// Conversion multipliers from Inches to Target Unit
export const CONVERSION_RATIOS = {
    [UNITS.INCHES]: 1,
    [UNITS.FEET]: 1 / 12,
    [UNITS.MILLIMETERS]: 25.4,
    [UNITS.CENTIMETERS]: 2.54,
    [UNITS.METERS]: 0.0254
};

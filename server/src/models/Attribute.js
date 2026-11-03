const { Schema, model } = require('mongoose');

// Thuoc tinh tinh / it thay doi cua thiet bi.
const attributeSchema = new Schema(
  {
    deviceId: { type: String, ref: 'Device' },
    firmware_version: String,
    // setting temperature warning threshold (10 - 40 °C)
    safe_min_temperature: { type: Number, default: 18, min: 10, max: 40 },
    safe_max_temperature: { type: Number, default: 35, min: 10, max: 40 },
    // setting air humidity warning threshold (25 - 85 %)
    safe_min_humidity: { type: Number, default: 40, min: 25, max: 85 },
    safe_max_humidity: { type: Number, default: 75, min: 25, max: 85 },
    // setting soil moisture (25 - 85 %)
    safe_min_soil_humidity: { type: Number, default: 30, min: 25, max: 85 },
    safe_max_soil_humidity: { type: Number, default: 70, min: 25, max: 85 },
    // setting water level (10 - 100 %)
    safe_min_water_level: { type: Number, default: 20, min: 10, max: 100 },
    safe_max_water_level: { type: Number, default: 95, min: 10, max: 100 },

    flow_rate_lpm: Number,
  },
  { timestamps: true }
);

module.exports = model('Attribute', attributeSchema);

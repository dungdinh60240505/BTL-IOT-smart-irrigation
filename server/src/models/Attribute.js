const { Schema, model } = require('mongoose');

// Thuoc tinh tinh / it thay doi cua thiet bi.
const attributeSchema = new Schema(
  {
    deviceId: { type: String, ref: 'Device' },
    firmware_version: String,
    //setting soil moisture
    safe_min_soil_humidity: { type: Number, default: 30 },
    safe_max_soil_humidity: { type: Number, default: 70 },
    //setting water level
    safe_min_water_level: { type: Number, default: 20 },
    safe_max_water_level: { type: Number, default: 95 },

    flow_rate_lpm: Number,
  },
  { timestamps: true }
);

module.exports = model('Attribute', attributeSchema);

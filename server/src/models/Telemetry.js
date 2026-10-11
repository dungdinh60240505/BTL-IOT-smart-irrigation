const { Schema, model } = require('mongoose');

// Time-Series Collection (MongoDB 5.0+).
const telemetrySchema = new Schema(
  {
    deviceId: { type: String },
    timestamp: { type: Date },
    temperature: Number,
    humidity: Number,
    soil_humidity: Number,
    water_level: Number
  },
  {
    versionKey: false,
    timeseries: { timeField: 'timestamp', metaField: 'deviceId', granularity: 'seconds' },
  }
);

module.exports = model('Telemetry', telemetrySchema);

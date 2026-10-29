const { Schema, model } = require('mongoose');

const notificationSchema = new Schema(
  {
    deviceId: { type: String, required: true, index: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
    type: {
      type: String,
      required: true,
      enum: ['SOIL_LOW', 'SOIL_HIGH', 'WATER_LOW', 'WATER_HIGH'],
    },
    severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
    message: { type: String, required: true },
    value: { type: Number, default: null },
    threshold: { type: Number, default: null },
    active: { type: Boolean, default: true, index: true },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    lastTriggeredAt: { type: Date, default: null },
    source: { type: String, default: 'telemetry' },
  },
  { timestamps: true }
);

// Moi device/type chi co toi da mot canh bao dang hieu luc.
notificationSchema.index(
  { deviceId: 1, type: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

module.exports = model('Notification', notificationSchema);

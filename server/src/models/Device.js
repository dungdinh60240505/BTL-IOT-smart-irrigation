const { Schema, model } = require('mongoose');
const { offlineAfterSec } = require('../config');

// _id chinh la device_id dung trong MQTT topic (vd: "esp32_01").
const deviceSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    type: { type: String, default: 'esp32' },
    // Relation "Asset contains Device"
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null, index: true },
    lastSeenAt: { type: Date, default: null },
    pumpState: { type: String, enum: ['ON', 'OFF'], default: 'OFF' },
    lastAutoOffAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

deviceSchema.virtual('online').get(function () {
  return !!this.lastSeenAt && Date.now() - this.lastSeenAt.getTime() < offlineAfterSec * 1000;
});

module.exports = model('Device', deviceSchema);

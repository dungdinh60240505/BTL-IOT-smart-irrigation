const { Schema, model } = require('mongoose');

// Moi lan bom bat -> tat la mot ban ghi lich su tuoi.
const wateringEventSchema = new Schema({
  deviceId: { type: String, ref: 'Device'},
  assetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null},
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
  durationSec: { type: Number, default: null },
  liters: { type: Number, default: null },
});

module.exports = model('WateringEvent', wateringEventSchema);

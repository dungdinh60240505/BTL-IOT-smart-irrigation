const Device = require('../models/Device');
const Attribute = require('../models/Attribute');
const WateringEvent = require('../models/WateringEvent');
const { broadcast } = require('../ws');
const { defaultFlowRateLpm } = require('../config');

// Lich su tuoi duoc ghi theo trang thai do THIET BI xac nhan, khong theo lenh da gui.
async function onPumpState(deviceId, state) {
  const device = await Device.findById(deviceId);
  if (!device || device.pumpState === state) return;

  const now = new Date();
  device.pumpState = state;
  await device.save();

  if (state === 'ON') {
    await WateringEvent.create({ deviceId, assetId: device.assetId, startedAt: now });
  } else {
    const event = await WateringEvent.findOne({ deviceId, endedAt: null }).sort({ startedAt: -1 });
    if (event) {
      const attrs = await Attribute.findOne({ deviceId });
      const flow = attrs?.flow_rate_lpm ?? defaultFlowRateLpm;
      event.endedAt = now;
      event.durationSec = Math.round((now - event.startedAt) / 1000);
      event.liters = Number(((flow * event.durationSec) / 60).toFixed(3));
      await event.save();
    }
  }
  broadcast(deviceId, 'PUMP_STATE', { state, timestamp: now });
}

module.exports = { onPumpState };

const Device = require('../models/Device');
const Attribute = require('../models/Attribute');
const WateringEvent = require('../models/WateringEvent');
const Telemetry = require('../models/Telemetry');
const { broadcast } = require('../ws');
const { defaultFlowRateLpm } = require('../config');

const DEFAULT_MIN_WATER_LEVEL = 20;

// Kiem tra muc nuoc be chua co du de bat bom hay khong.
// Neu chua co du lieu water_level thi cho phep (khong chan).
async function checkWaterLevelForPump(deviceId, currentWaterLevel) {
  const attrs = await Attribute.findOne({ deviceId });
  const minWater = typeof attrs?.safe_min_water_level === 'number'
    ? attrs.safe_min_water_level
    : DEFAULT_MIN_WATER_LEVEL;

  let waterLevel = currentWaterLevel;
  if (typeof waterLevel !== 'number') {
    const latest = await Telemetry.findOne({ deviceId, water_level: { $ne: null } }).sort({ timestamp: -1 });
    waterLevel = latest?.water_level;
  }

  if (typeof waterLevel !== 'number' || !Number.isFinite(waterLevel)) {
    return { allowed: true, waterLevel: null, minWater };
  }
  return { allowed: waterLevel >= minWater, waterLevel, minWater };
}

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

module.exports = { onPumpState, checkWaterLevelForPump };

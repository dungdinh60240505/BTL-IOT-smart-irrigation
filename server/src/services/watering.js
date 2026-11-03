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

// Lich su tuoi duoc ghi theo trang thai may bom va luu thoi diem bat dau (tuong ung voi cay duoc tuoi).
async function onPumpState(deviceId, state) {
  const device = await Device.findById(deviceId);
  if (!device) return null;
  if (device.pumpState === state) {
    if (state === 'ON' && !device.pumpStartedAt) {
      const openEvent = await WateringEvent.findOne({ deviceId, endedAt: null }).sort({ startedAt: -1 });
      device.pumpStartedAt = openEvent?.startedAt || new Date();
      await device.save();
      if (!openEvent) {
        await WateringEvent.create({
          deviceId,
          assetId: device.assetId,
          startedAt: device.pumpStartedAt,
        });
      }
    } else if (state === 'OFF' && device.pumpStartedAt) {
      device.pumpStartedAt = null;
      await device.save();
    }
    return {
      pumpState: device.pumpState,
      pumpStartedAt: device.pumpStartedAt,
      assetId: device.assetId,
    };
  }

  const now = new Date();
  device.pumpState = state;
  device.pumpStartedAt = state === 'ON' ? now : null;
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
  broadcast(deviceId, 'PUMP_STATE', {
    state,
    timestamp: now,
    pumpStartedAt: device.pumpStartedAt,
    assetId: device.assetId ? String(device.assetId) : null,
  });
  return {
    pumpState: device.pumpState,
    pumpStartedAt: device.pumpStartedAt,
    assetId: device.assetId,
  };
}

async function backfillPumpStartedAt() {
  const devices = await Device.find({
    pumpState: 'ON',
    $or: [{ pumpStartedAt: null }, { pumpStartedAt: { $exists: false } }],
  }).select('_id assetId');

  for (const device of devices) {
    let event = await WateringEvent.findOne({
      deviceId: device._id,
      endedAt: null,
    }).sort({ startedAt: -1 });
    if (!event) {
      event = await WateringEvent.create({
        deviceId: device._id,
        assetId: device.assetId || null,
        startedAt: new Date(),
      });
    }
    if (event?.startedAt) {
      await Device.updateOne(
        { _id: device._id },
        { $set: { pumpStartedAt: event.startedAt } }
      );
    }
  }
}

module.exports = { onPumpState, checkWaterLevelForPump, backfillPumpStartedAt };

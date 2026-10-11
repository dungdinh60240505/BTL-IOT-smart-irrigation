const Device = require('../models/Device');
const Attribute = require('../models/Attribute');
const Telemetry = require('../models/Telemetry');
const { broadcast } = require('../ws');
const { onPumpState } = require('./watering');

const RANGES = {
  temperature: [-10, 60],
  humidity: [0, 100],
  soil_humidity: [0, 100],
};

function normalizeTelemetryPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const normalized = { ...payload };
  if (normalized.soil !== undefined && normalized.soil_humidity === undefined) {
    normalized.soil_humidity = normalized.soil;
  }

  return normalized;
}

// Tra ve object da loc, hoac null neu co truong khong hop le.
function validateTelemetry(payload) {
  const normalized = normalizeTelemetryPayload(payload);
  if (!normalized) return null;

  const out = {};
  for (const [field, [min, max]] of Object.entries(RANGES)) {
    const v = normalized[field];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return null;
    out[field] = v;
  }
  return out;
}

// Thiet bi la gui du lieu lan dau se duoc tu dang ky (chua gan Asset).
function touchDevice(deviceId, now) {
  return Device.findByIdAndUpdate(
    deviceId,
    { $set: { lastSeenAt: now }, $setOnInsert: { name: deviceId } },
    { upsert: true, new: true }
  );
}

async function handleTelemetry(deviceId, payload) {
  console.log(`[telemetry] nhan telemetry tu ${deviceId}:`, payload);

  const values = validateTelemetry(payload);
  if (!values) {
    console.warn(`[telemetry] bo qua du lieu khong hop le tu ${deviceId}:`, JSON.stringify(payload));
    return;
  }

  const now = new Date();
  await touchDevice(deviceId, now);
  const doc = await Telemetry.create({ deviceId, timestamp: now, ...values });
  console.log(`[telemetry] da luu vao MongoDB cho ${deviceId}:`, { deviceId, timestamp: doc.timestamp, ...values });
  broadcast(deviceId, 'TELEMETRY', { timestamp: doc.timestamp, ...values });
}

const ATTRIBUTE_FIELDS = [
  'firmware_version',
  'safe_min_soil_humidity',
  'safe_max_soil_humidity',
  'safe_min_water_level',
  'safe_max_water_level',
  'flow_rate_lpm',
];

async function handleAttributes(deviceId, payload) {
  if (!payload || typeof payload !== 'object') return;
  await touchDevice(deviceId, new Date());

  const set = {};
  for (const f of ATTRIBUTE_FIELDS) if (payload[f] !== undefined) set[f] = payload[f];
  if (Object.keys(set).length) {
    await Attribute.findOneAndUpdate({ deviceId }, { $set: set }, { upsert: true, runValidators: true });
  }

  // Thiet bi bao trang thai bom thuc te sau khi thuc thi lenh.
  if (payload.pump_state === 'ON' || payload.pump_state === 'OFF') {
    await onPumpState(deviceId, payload.pump_state);
  }
  if (payload.led_state === 'ON' || payload.led_state === 'OFF') {
    broadcast(deviceId, 'LED_STATE', { state: payload.led_state });
  }
}

module.exports = { handleTelemetry, handleAttributes, validateTelemetry };

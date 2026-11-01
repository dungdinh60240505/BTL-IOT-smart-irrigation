const Device = require('../models/Device');
const { offlineAfterSec } = require('../config');
const { broadcastAll } = require('../ws');

const CHECK_INTERVAL_MS = 3000;

// deviceId -> thoi diem nhan du lieu gan nhat (chi giu cac thiet bi dang online).
const onlineDevices = new Map();
let timer = null;

function emitStatus(deviceId, online, lastSeenAt) {
  broadcastAll('DEVICE_STATUS', { deviceId, data: { online, lastSeenAt } });
}

// Goi moi khi nhan telemetry/attributes tu thiet bi.
function markDeviceSeen(deviceId, lastSeenAt = new Date()) {
  const wasOnline = onlineDevices.has(deviceId);
  onlineDevices.set(deviceId, lastSeenAt);
  if (!wasOnline) console.log(`[presence] ${deviceId} online`);
  emitStatus(deviceId, true, lastSeenAt);
}

function checkOffline() {
  const now = Date.now();
  for (const [deviceId, lastSeenAt] of onlineDevices) {
    if (now - lastSeenAt.getTime() >= offlineAfterSec * 1000) {
      onlineDevices.delete(deviceId);
      console.log(`[presence] ${deviceId} offline (khong nhan du lieu ${offlineAfterSec}s)`);
      emitStatus(deviceId, false, lastSeenAt);
    }
  }
}

async function initDevicePresence() {
  const since = new Date(Date.now() - offlineAfterSec * 1000);
  const devices = await Device.find({ lastSeenAt: { $gte: since } }).select('_id lastSeenAt');
  for (const device of devices) onlineDevices.set(String(device._id), device.lastSeenAt);
  if (timer) clearInterval(timer);
  timer = setInterval(checkOffline, CHECK_INTERVAL_MS);
  timer.unref?.();
}

module.exports = { initDevicePresence, markDeviceSeen };

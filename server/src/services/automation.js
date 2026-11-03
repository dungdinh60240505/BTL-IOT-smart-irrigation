const Device = require('../models/Device');
const Attribute = require('../models/Attribute');
const Notification = require('../models/Notification');
const { sendWaterCommand } = require('./mqttPublisher');
const { onPumpState } = require('./watering');

const DEFAULT_THRESHOLDS = {
  tempMin: 18,
  tempMax: 35,
  humidityMin: 40,
  humidityMax: 75,
  soilMin: 30,
  soilMax: 70,
  waterMin: 20,
  waterMax: 95,
};

const AUTO_OFF_COOLDOWN_MS = 60 * 1000;

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getThresholds(attributes) {
  return {
    tempMin: numberOr(attributes?.safe_min_temperature, DEFAULT_THRESHOLDS.tempMin),
    tempMax: numberOr(attributes?.safe_max_temperature, DEFAULT_THRESHOLDS.tempMax),
    humidityMin: numberOr(attributes?.safe_min_humidity, DEFAULT_THRESHOLDS.humidityMin),
    humidityMax: numberOr(attributes?.safe_max_humidity, DEFAULT_THRESHOLDS.humidityMax),
    soilMin: numberOr(attributes?.safe_min_soil_humidity, DEFAULT_THRESHOLDS.soilMin),
    soilMax: numberOr(attributes?.safe_max_soil_humidity, DEFAULT_THRESHOLDS.soilMax),
    waterMin: numberOr(attributes?.safe_min_water_level, DEFAULT_THRESHOLDS.waterMin),
    waterMax: numberOr(attributes?.safe_max_water_level, DEFAULT_THRESHOLDS.waterMax),
  };
}

async function upsertNotification(device, type, value, threshold, message) {
  const now = new Date();
  const filter = { deviceId: String(device._id), type, active: true };
  const update = {
    $set: {
      value,
      threshold,
      message,
      lastTriggeredAt: now,
    },
    $setOnInsert: {
      deviceId: String(device._id),
      assetId: device.assetId || null,
      type,
      severity: 'warning',
      active: true,
      read: false,
      source: 'telemetry',
    },
  };

  try {
    return await Notification.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  } catch (error) {
    // Hai message telemetry co the den cung luc; doc lai ban ghi da duoc tao.
    if (error.code === 11000) return Notification.findOne(filter);
    throw error;
  }
}

async function resolveNotifications(deviceId, types) {
  if (!types.length) return;
  await Notification.updateMany(
    { deviceId: String(deviceId), type: { $in: types }, active: true },
    { $set: { active: false, resolvedAt: new Date() } }
  );
}

async function shouldAutoOff(device) {
  if (!device.online) return false;
  if (device.pumpState !== 'OFF') return true;
  const last = device.lastAutoOffAt ? new Date(device.lastAutoOffAt).getTime() : 0;
  return Date.now() - last >= AUTO_OFF_COOLDOWN_MS;
}

async function evaluateTelemetry(deviceId, values) {
  const [device, attributes] = await Promise.all([
    Device.findById(deviceId),
    Attribute.findOne({ deviceId }),
  ]);
  if (!device) return { autoOffSent: false, notifications: [] };

  const thresholds = getThresholds(attributes);
  const temp = values.temperature;
  const humidity = values.humidity;
  const soil = values.soil_humidity;
  const water = values.water_level;
  const notifications = [];

  if (typeof temp === 'number' && Number.isFinite(temp)) {
    if (temp < thresholds.tempMin) {
      notifications.push(await upsertNotification(
        device,
        'TEMP_LOW',
        temp,
        thresholds.tempMin,
        `Nhiệt độ ${temp}°C thấp hơn ngưỡng cảnh báo tối thiểu ${thresholds.tempMin}°C`
      ));
    } else {
      await resolveNotifications(device._id, ['TEMP_LOW']);
    }

    if (temp > thresholds.tempMax) {
      notifications.push(await upsertNotification(
        device,
        'TEMP_HIGH',
        temp,
        thresholds.tempMax,
        `Nhiệt độ ${temp}°C cao hơn ngưỡng cảnh báo tối đa ${thresholds.tempMax}°C`
      ));
    } else {
      await resolveNotifications(device._id, ['TEMP_HIGH']);
    }
  }

  if (typeof humidity === 'number' && Number.isFinite(humidity)) {
    if (humidity < thresholds.humidityMin) {
      notifications.push(await upsertNotification(
        device,
        'HUMIDITY_LOW',
        humidity,
        thresholds.humidityMin,
        `Độ ẩm không khí ${humidity}% thấp hơn ngưỡng cảnh báo tối thiểu ${thresholds.humidityMin}%`
      ));
    } else {
      await resolveNotifications(device._id, ['HUMIDITY_LOW']);
    }

    if (humidity > thresholds.humidityMax) {
      notifications.push(await upsertNotification(
        device,
        'HUMIDITY_HIGH',
        humidity,
        thresholds.humidityMax,
        `Độ ẩm không khí ${humidity}% cao hơn ngưỡng cảnh báo tối đa ${thresholds.humidityMax}%`
      ));
    } else {
      await resolveNotifications(device._id, ['HUMIDITY_HIGH']);
    }
  }

  if (typeof soil === 'number' && Number.isFinite(soil)) {
    if (soil < thresholds.soilMin) {
      notifications.push(await upsertNotification(
        device,
        'SOIL_LOW',
        soil,
        thresholds.soilMin,
        `Độ ẩm đất ${soil}% thấp hơn ngưỡng tối thiểu ${thresholds.soilMin}%`
      ));
    } else {
      await resolveNotifications(device._id, ['SOIL_LOW']);
    }

    if (soil > thresholds.soilMax) {
      notifications.push(await upsertNotification(
        device,
        'SOIL_HIGH',
        soil,
        thresholds.soilMax,
        `Độ ẩm đất ${soil}% cao hơn ngưỡng tối đa ${thresholds.soilMax}%`
      ));
    } else {
      await resolveNotifications(device._id, ['SOIL_HIGH']);
    }
  }

  if (typeof water === 'number' && Number.isFinite(water)) {
    if (water < thresholds.waterMin) {
      notifications.push(await upsertNotification(
        device,
        'WATER_LOW',
        water,
        thresholds.waterMin,
        `Mực nước ${water}% thấp hơn ngưỡng tối thiểu ${thresholds.waterMin}%`
      ));
    } else {
      await resolveNotifications(device._id, ['WATER_LOW']);
    }

    if (water > thresholds.waterMax) {
      notifications.push(await upsertNotification(
        device,
        'WATER_HIGH',
        water,
        thresholds.waterMax,
        `Mực nước ${water}% cao hơn ngưỡng tối đa ${thresholds.waterMax}%`
      ));
    } else {
      await resolveNotifications(device._id, ['WATER_HIGH']);
    }
  }

  let autoOffSent = false;
  const soilTooWet = typeof soil === 'number' && Number.isFinite(soil) && soil > thresholds.soilMax;
  // Muc nuoc be duoi nguong min: tat bom de tranh chay kho
  const waterTooLow = typeof water === 'number' && Number.isFinite(water) && water < thresholds.waterMin;
  if ((soilTooWet || waterTooLow) && await shouldAutoOff(device)) {
    if (waterTooLow) console.warn(`[automation] muc nuoc ${water}% < ${thresholds.waterMin}%, tat bom ${device._id}`);
    try {
      await sendWaterCommand(device._id, 'OFF');
      await onPumpState(device._id, 'OFF');
      await Device.updateOne(
        { _id: device._id },
        { $set: { lastAutoOffAt: new Date() } }
      );
      autoOffSent = true;
    } catch (error) {
      console.error(`[automation] khong gui duoc lenh tat bom cho ${device._id}:`, error.message);
    }
  }

  return {
    autoOffSent,
    notifications: notifications.filter(Boolean),
  };
}

module.exports = { evaluateTelemetry, getThresholds, DEFAULT_THRESHOLDS };

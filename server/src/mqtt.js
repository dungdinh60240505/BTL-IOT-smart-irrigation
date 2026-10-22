const mqtt = require('mqtt');
const { mqttUrl } = require('./config');
const { handleTelemetry, handleAttributes } = require('./services/telemetry');

let client;

function initMqtt() {
  client = mqtt.connect(mqttUrl, { reconnectPeriod: 2000 });

  client.on('connect', () => {
    console.log(`[mqtt] da ket noi ${mqttUrl}`);
    client.subscribe(['dt/telemetry/+', 'dt/attributes/+'], { qos: 1 });
  });
  client.on('error', (err) => console.error('[mqtt] loi:', err.message));

  client.on('message', async (topic, buf) => {
    const raw = buf.toString();
    const [kind, deviceId] = topic.split('/');
    if (!deviceId) return;

    console.log(`[mqtt] nhan du lieu tren ${topic}: ${raw}`);

    let payload;
    try {
      payload = JSON.parse(raw);
      console.log(`[mqtt] parsed payload ${topic}:`, payload);
    } catch {
      console.warn(`[mqtt] payload khong phai JSON tren ${topic}: ${raw}`);
      return;
    }
    try {
      if (kind === 'telemetry') await handleTelemetry(deviceId, payload);
      else if (kind === 'attributes') await handleAttributes(deviceId, payload);
    } catch (err) {
      console.error(`[mqtt] loi xu ly ${topic}:`, err.message);
    }
  });

  return client;
}

// Luong dieu khien: Web/App -> Backend -> dt/command/{device_id} -> ESP32
function sendDeviceCommand(deviceId, action, state) {
  return new Promise((resolve, reject) => {
    if (!client?.connected) {
      console.warn(`[mqtt] khong gui duoc lenh ${action} cho ${deviceId}: broker chua ket noi`);
      return reject(new Error('Chua ket noi MQTT broker'));
    }
    const topic = `dt/command/${deviceId}`;
    const payload = JSON.stringify({ action, state });
    console.log(`[mqtt] gui lenh den ${topic}: ${payload}`);
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[mqtt] loi gui lenh den ${topic}:`, err.message);
        return reject(err);
      }
      console.log(`[mqtt] da publish lenh den ${topic}`);
      resolve();
    });
  });
}

function sendWaterCommand(deviceId, state) {
  return sendDeviceCommand(deviceId, 'WATER', state);
}

module.exports = { initMqtt, sendDeviceCommand, sendWaterCommand };

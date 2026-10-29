const mqtt = require('mqtt');
const { mqttUrl, mqttUsername, mqttPassword } = require('./config');
const { handleTelemetry, handleAttributes } = require('./services/telemetry');
const { setMqttClient, sendDeviceCommand, sendWaterCommand } = require('./services/mqttPublisher');

let client;

function initMqtt() {
  client = mqtt.connect(mqttUrl, {
    reconnectPeriod: 2000,
    username: mqttUsername,
    password: mqttPassword,
    clientId: `iot-backend-${process.pid}`,
  });
  setMqttClient(client);

  client.on('connect', () => {
    console.log(`[mqtt] da ket noi ${mqttUrl}`);
    client.subscribe(['dt/telemetry/+', 'dt/attributes/+'], { qos: 1 });
  });
  client.on('error', (err) => console.error('[mqtt] loi:', err.message));

  client.on('message', async (topic, buf) => {
    const raw = buf.toString();
    const [, kind, deviceId] = topic.split('/');
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

module.exports = { initMqtt, sendDeviceCommand, sendWaterCommand };

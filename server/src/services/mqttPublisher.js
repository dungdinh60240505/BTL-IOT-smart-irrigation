let client;

function setMqttClient(nextClient) {
  client = nextClient;
}

function sendDeviceCommand(deviceId, action, state) {
  return new Promise((resolve, reject) => {
    if (!client?.connected) {
      reject(new Error('Chua ket noi MQTT broker'));
      return;
    }

    const topic = `dt/command/${deviceId}`;
    const payload = JSON.stringify({ action, state });
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) return reject(err);
      console.log(`[mqtt] da publish lenh den ${topic}: ${payload}`);
      resolve();
    });
  });
}

function sendWaterCommand(deviceId, state) {
  return sendDeviceCommand(deviceId, 'WATER', state);
}

module.exports = { setMqttClient, sendDeviceCommand, sendWaterCommand };

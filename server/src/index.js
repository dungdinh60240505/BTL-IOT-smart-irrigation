const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const User = require('./models/User');
const { initWs } = require('./ws');
const { initMqtt } = require('./mqtt');

async function main() {
  if (!config.jwtSecret || config.jwtSecret.length < 32 || config.jwtSecret === 'replace-with-a-long-random-secret') {
    throw new Error('JWT_SECRET phai la chuoi ngau nhien it nhat 32 ky tu');
  }
  if (!config.mqttPassword) {
    throw new Error('MQTT_PASSWORD chua duoc cau hinh');
  }

  await mongoose.connect(config.mongoUri);
  console.log('[db] da ket noi MongoDB');
  await User.init();
  await User.initAdmin();

  const server = http.createServer(app);
  initWs(server);
  initMqtt();
  server.listen(config.port, () => console.log(`[http] http://localhost:${config.port}  (WebSocket: /ws)`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

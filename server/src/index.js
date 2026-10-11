const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const { initWs } = require('./ws');
const { initMqtt } = require('./mqtt');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('[db] da ket noi MongoDB');

  const server = http.createServer(app);
  initWs(server);
  initMqtt();
  server.listen(config.port, () => console.log(`[http] http://localhost:${config.port}  (WebSocket: /ws)`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

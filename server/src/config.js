require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3001,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/smart_irrigation',
  mqttUrl: process.env.MQTT_URL || 'mqtt://192.168.1.101:1883',
  jwtSecret: process.env.JWT_SECRET,
  offlineAfterSec: Number(process.env.OFFLINE_AFTER_SEC) || 30,
  defaultFlowRateLpm: Number(process.env.DEFAULT_FLOW_RATE_LPM) || 2,
};

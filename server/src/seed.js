// Tao du lieu mau: 1 Asset "Cay so 1" chua thiet bi esp32_01.
const mongoose = require('mongoose');
const config = require('./config');
const Asset = require('./models/Asset');
const Device = require('./models/Device');
const Attribute = require('./models/Attribute');

(async () => {
  await mongoose.connect(config.mongoUri);
  const asset = await Asset.findOneAndUpdate(
    { name: 'Cây số 1' },
    { $setOnInsert: { type: 'plant' } },
    { upsert: true, new: true }
  );
  await Device.findByIdAndUpdate(
    'esp32_01',
    { $set: { name: 'ESP32 cây số 1', assetId: asset._id } },
    { upsert: true }
  );
  await Attribute.findOneAndUpdate(
    { deviceId: 'esp32_01' },
    {
      $setOnInsert: {
        safe_min_soil_humidity: 30,
        safe_max_soil_humidity: 70,
        safe_min_water_level: 20,
        safe_max_water_level: 95,
        flow_rate_lpm: 2,
      },
    },
    { upsert: true }
  );
  console.log(`Da tao Asset ${asset._id} ("${asset.name}") va thiet bi esp32_01`);
  await mongoose.disconnect();
})();

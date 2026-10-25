const { Schema, model } = require('mongoose');

// Asset = boi canh su dung (vuon, cay...). Khong tu gui du lieu, chi chua Devices.
const assetSchema = new Schema(
  {
    name: { type: String, required: true },
    //pot, no_pot, outdoor, indoor
    type: { type: String, default: 'pot' },
  },
  { timestamps: true }
);

module.exports = model('Asset', assetSchema);

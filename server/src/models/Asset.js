const { Schema, model } = require('mongoose');

// Asset = boi canh su dung (vuon, cay...). Khong tu gui du lieu, chi chua Devices.
const assetSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, default: 'plant' },
  },
  { timestamps: true }
);

module.exports = model('Asset', assetSchema);

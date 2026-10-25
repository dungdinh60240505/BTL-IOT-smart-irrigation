const { Schema, model } = require('mongoose');

// Asset = boi canh su dung (vuon, cay...). Khong tu gui du lieu, chi chua Devices.
const layoutSchema = new Schema(
  {
    x: { type: Number, required: true },
    z: { type: Number, required: true },
  },
  { _id: false }
);

const assetSchema = new Schema(
  {
    name: { type: String, required: true },
    //pot, no_pot, outdoor, indoor
    type: { type: String, default: 'pot' },
    // Vi tri cua cum cay + van tren mat luoi 3D (don vi: met).
    layout: { type: layoutSchema, default: null },
  },
  { timestamps: true }
);

module.exports = model('Asset', assetSchema);

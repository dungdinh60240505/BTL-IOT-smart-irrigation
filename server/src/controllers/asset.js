const Asset = require('../models/Asset');
const Device = require('../models/Device');
const WateringEvent = require('../models/WateringEvent');
const { assetStats } = require('../services/stats');

async function listAssets(req, res) {
	res.json(await Asset.find().sort('name'));
}

async function createAsset(req, res) {
	const { name, type } = req.body;
	if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Thieu name' });
	res.status(201).json(await Asset.create({ name: name.trim(), ...(type !== undefined && { type }) }));
}

async function updateAsset(req, res) {
	const { name, type } = req.body;
	const updates = {};
	if (name !== undefined) {
		if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name khong duoc de trong' });
		updates.name = name.trim();
	}
	if (type !== undefined) updates.type = type;
	const asset = await Asset.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
	if (!asset) return res.status(404).json({ error: 'Khong tim thay asset' });
	res.json(asset);
}

async function deleteAsset(req, res) {
	const asset = await Asset.findById(req.params.id);
	if (!asset) return res.status(404).json({ error: 'Khong tim thay asset' });
	await Device.updateMany({ assetId: asset._id }, { $set: { assetId: null } });
	await WateringEvent.updateMany({ assetId: asset._id }, { $set: { assetId: null } });
	await asset.deleteOne();
	res.status(204).end();
}

async function listAssetDevices(req, res) {
	res.json(await Device.find({ assetId: req.params.id }));
}

async function updateAssetDevices(req, res) {
	const { deviceIds } = req.body;
	if (!Array.isArray(deviceIds) || deviceIds.some((id) => typeof id !== 'string' || !id.trim())) {
		return res.status(400).json({ error: 'deviceIds phai la mang id hop le' });
	}
	const asset = await Asset.findById(req.params.id);
	if (!asset) return res.status(404).json({ error: 'Khong tim thay asset' });
	const selectedIds = [...new Set(deviceIds.map((id) => id.trim()))];
	const devices = await Device.find({ _id: { $in: selectedIds } }).select('_id');
	if (devices.length !== selectedIds.length) return res.status(400).json({ error: 'Co device khong ton tai' });

	await Device.updateMany(
		{ assetId: asset._id, _id: { $nin: selectedIds } },
		{ $set: { assetId: null } }
	);
	if (selectedIds.length) {
		await Device.updateMany({ _id: { $in: selectedIds } }, { $set: { assetId: asset._id } });
	}
	res.json({ assetId: asset._id, deviceIds: selectedIds });
}

async function getWateringHistory(req, res) {
	const limit = Math.min(Number(req.query.limit) || 50, 500);
	const deviceIds = (await Device.find({ assetId: req.params.id }).select('_id')).map((d) => d._id);
	res.json(await WateringEvent.find({ deviceId: { $in: deviceIds } }).sort({ startedAt: -1 }).limit(limit));
}

async function getAssetStats(req, res) {
	const stats = await assetStats(req.params.id, req.query.period || 'day');
	if (!stats) return res.status(400).json({ error: 'period phai la day | week | month' });
	res.json(stats);
}

module.exports = {
	listAssets,
	createAsset,
	updateAsset,
	deleteAsset,
	listAssetDevices,
	updateAssetDevices,
	getWateringHistory,
	getAssetStats,
};

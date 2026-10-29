const Device = require('../models/Device');
const Attribute = require('../models/Attribute');
const Telemetry = require('../models/Telemetry');
const DEVICE_ATTRIBUTE_FIELDS = [
	'firmware_version',
	'safe_min_soil_humidity',
	'safe_max_soil_humidity',
	'safe_min_water_level',
	'safe_max_water_level',
	'flow_rate_lpm',
];
const { sendDeviceCommand } = require('../mqtt');

async function listDevices(req, res) {
	const devices = await Device.find().sort('_id');
	const attributes = await Attribute.find({ deviceId: { $in: devices.map((device) => device._id) } });
	const attributesByDevice = new Map(attributes.map((item) => [String(item.deviceId), item]));
	res.json(devices.map((device) => ({ ...device.toJSON(), attributes: attributesByDevice.get(String(device._id)) || null })));
}

async function upsertDevice(req, res) {
	const { id, name, type, assetId, ...attributes } = req.body;
	if (!id) return res.status(400).json({ error: 'Thieu id (device_id dung trong MQTT topic)' });
	if (Object.keys(attributes).length && req.user?.role !== 'admin') {
		return res.status(403).json({ error: 'Chi admin duoc sua cau hinh thiet bi' });
	}
	if (name !== undefined && (typeof name !== 'string' || !name.trim())) return res.status(400).json({ error: 'name khong duoc de trong' });
	const device = await Device.findByIdAndUpdate(
		id,
		{ $set: { name: name?.trim() || id, ...(type !== undefined && { type }), ...(assetId !== undefined && { assetId: assetId || null }) } },
		{ upsert: true, new: true, runValidators: true }
	);
	await updateDeviceAttributes(device._id, attributes);
	res.status(201).json(device);
}

async function updateDeviceAttributes(deviceId, values) {
	const updates = {};
	for (const field of DEVICE_ATTRIBUTE_FIELDS) {
		if (values[field] !== undefined) updates[field] = values[field] === '' ? null : values[field];
	}
	if (!Object.keys(updates).length) return;
	await Attribute.findOneAndUpdate({ deviceId }, { $set: updates }, { upsert: true, new: true, runValidators: true });
}

async function updateDevice(req, res) {
	const { name, type, assetId, ...attributes } = req.body;
	if (Object.keys(attributes).length && req.user?.role !== 'admin') {
		return res.status(403).json({ error: 'Chi admin duoc sua cau hinh thiet bi' });
	}
	const updates = {};
	if (name !== undefined) {
		if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name khong duoc de trong' });
		updates.name = name.trim();
	}
	if (type !== undefined) updates.type = type;
	if (assetId !== undefined) updates.assetId = assetId || null;
	const device = await Device.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
	if (!device) return res.status(404).json({ error: 'Khong tim thay thiet bi' });
	await updateDeviceAttributes(device._id, attributes);
	res.json(device);
}

async function deleteDevice(req, res) {
	const device = await Device.findByIdAndDelete(req.params.id);
	if (!device) return res.status(404).json({ error: 'Khong tim thay thiet bi' });
	await Attribute.deleteMany({ deviceId: device._id });
	res.status(204).end();
}

async function getDevice(req, res) {
	const device = await Device.findById(req.params.id);
	if (!device) return res.status(404).json({ error: 'Khong tim thay thiet bi' });
	const attributes = await Attribute.findOne({ deviceId: device._id });
	const latest = await Telemetry.findOne({ deviceId: device._id }).sort({ timestamp: -1 });
	res.json({ ...device.toJSON(), attributes, latestTelemetry: latest });
}

// Query: ?from=ISO&to=ISO&limit=200 (moi nhat truoc)
async function getDeviceTelemetry(req, res) {
	const { from, to } = req.query;
	const limit = Math.min(Number(req.query.limit) || 200, 5000);
	const filter = { deviceId: req.params.id };
	if (from || to) {
		filter.timestamp = {};
		if (from) filter.timestamp.$gte = new Date(from);
		if (to) filter.timestamp.$lte = new Date(to);
	}
	res.json(await Telemetry.find(filter).sort({ timestamp: -1 }).limit(limit));
}

async function sendCommand(req, res) {
	const { state } = req.body;
	const action = req.body.action || 'WATER';
	if (state !== 'ON' && state !== 'OFF') return res.status(400).json({ error: 'state phai la ON hoac OFF' });
	if (action !== 'WATER' && action !== 'LAMP') return res.status(400).json({ error: 'action phai la WATER hoac LAMP' });
	const device = await Device.findById(req.params.id);
	if (!device) return res.status(404).json({ error: 'Khong tim thay thiet bi' });
	if (!device.online) return res.status(409).json({ error: 'Thiet bi dang offline, khong gui lenh' });
	await sendDeviceCommand(device._id, action, state);
	// 202: lenh da gui; trang thai thuc te se cap nhat khi thiet bi xac nhan.
	res.status(202).json({ sent: true, deviceId: device._id, action, state });
}

async function updateAttributes(req, res) {
	const deviceId = req.params.id;
	await updateDeviceAttributes(deviceId, req.body);
	const attr = await Attribute.findOne({ deviceId });
	res.json(attr);
}

async function updateAllAttributes(req, res) {
	const updates = {};
	for (const field of DEVICE_ATTRIBUTE_FIELDS) {
		if (req.body[field] !== undefined) updates[field] = req.body[field] === '' ? null : req.body[field];
	}
	if (!Object.keys(updates).length) {
		return res.status(400).json({ error: 'Không có dữ liệu thuộc tính cần cập nhật' });
	}

	// 1. Cập nhật tất cả các bản ghi Attribute hiện có
	await Attribute.updateMany({}, { $set: updates });

	// 2. Đảm bảo tất cả các thiết bị đều có Attribute được upsert
	const devices = await Device.find().select('_id');
	for (const dev of devices) {
		await Attribute.findOneAndUpdate(
			{ deviceId: dev._id },
			{ $set: updates },
			{ upsert: true, new: true }
		);
	}

	const updatedAttributes = await Attribute.find();
	res.json({
		message: 'Đã cập nhật cấu hình ngưỡng an toàn cho toàn bộ thiết bị',
		updates,
		attributes: updatedAttributes,
	});
}

module.exports = {
	listDevices,
	upsertDevice,
	updateDevice,
	deleteDevice,
	getDevice,
	getDeviceTelemetry,
	sendCommand,
	updateAttributes,
	updateAllAttributes,
};

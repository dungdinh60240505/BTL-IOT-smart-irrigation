const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const userSchema = new Schema(
	{
		username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 40 },
		password: { type: String, required: true, select: false },
		priority: { type: Number, default: 1 },
		role: { type: String, enum: ['admin', 'user'], default: 'user' },
		turnOnPump: { type: Boolean, default: false },
		status_online: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

const User = model('User', userSchema);

/**
 * Tao tai khoan admin dau tien tu bien moi truong.
 * Khong hard-code mat khau va khong tu nang quyen dua tren username.
 */
async function initAdmin() {
	const existingAdmin = await User.findOne({ role: 'admin' }).select('_id username');
	if (existingAdmin) {
		if (process.env.ADMIN_PASSWORD) {
			const fullAdmin = await User.findById(existingAdmin._id).select('+password');
			if (fullAdmin && await bcrypt.compare('12345678', fullAdmin.password)) {
				fullAdmin.password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
				await fullAdmin.save();
				console.log('[User] Da thay mat khau admin mac dinh cu bang ADMIN_PASSWORD.');
			}
		}
		console.log(`[User] Admin da ton tai: ${existingAdmin.username}`);
		return existingAdmin;
	}

	const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
	const password = process.env.ADMIN_PASSWORD;
	if (!password) {
		console.warn('[User] Chua co ADMIN_PASSWORD; khong tao admin. Hay dat bien nay roi khoi dong lai.');
		return null;
	}
	if (password.length < 8) {
		throw new Error('ADMIN_PASSWORD phai co it nhat 8 ky tu');
	}

	const sameUsername = await User.findOne({ username }).select('_id username role');
	if (sameUsername) {
		console.warn(`[User] Username "${username}" da ton tai nhung khong phai admin. Hay dat ADMIN_USERNAME khac.`);
		return null;
	}

	const admin = await User.create({
		username,
		password: await bcrypt.hash(password, 12),
		role: 'admin',
		turnOnPump: true,
		priority: 1,
		status_online: false,
	});
	console.log(`[User] Da tao admin "${username}" tu ADMIN_PASSWORD.`);
	return admin;
}

module.exports = User;
module.exports.initAdmin = initAdmin;

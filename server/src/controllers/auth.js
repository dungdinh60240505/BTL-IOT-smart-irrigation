const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

const PASSWORD_MIN_LENGTH = 8;

function publicUser(user) {
	return {
		id: user._id,
		username: user.username,
		role: user.role,
		priority: user.priority ?? 1,
		turnOnPump: user.turnOnPump ?? false,
		status_online: user.status_online,
		createdAt: user.createdAt,
	};
}

function createToken(user) {
	if (!config.jwtSecret) throw new Error('JWT_SECRET chua duoc cau hinh');
	return jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '8h' });
}

function setAuthCookie(req, res, token) {
	res.cookie('auth_token', token, {
		httpOnly: true,
		sameSite: 'lax',
		secure: req.secure,
		maxAge: 8 * 60 * 60 * 1000,
		path: '/',
	});
}

function normalizeCredentials(body = {}) {
	const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
	const password = typeof body.password === 'string' ? body.password : '';
	return { username, password };
}

async function register(req, res) {
	const { username, password } = normalizeCredentials(req.body);
	if (username.length < 3 || username.length > 40) return res.status(400).json({ error: 'username phai co 3-40 ky tu' });
	if (username === 'admin') return res.status(400).json({ error: 'username admin duoc danh rieng cho tai khoan quan tri' });
	if (password.length < PASSWORD_MIN_LENGTH) return res.status(400).json({ error: 'password phai co it nhat 8 ky tu' });
	if (!config.jwtSecret) return res.status(500).json({ error: 'JWT_SECRET chua duoc cau hinh' });

	try {
		const user = await User.create({
			username,
			password: await bcrypt.hash(password, 12),
			role: 'user',
			turnOnPump: false,
			status_online: true,
		});
		const token = createToken(user);
		setAuthCookie(req, res, token);
		res.status(201).json({ token, user: publicUser(user) });
	} catch (error) {
		if (error.code === 11000) return res.status(409).json({ error: 'username da ton tai' });
		throw error;
	}
}

async function login(req, res) {
	const { username, password } = normalizeCredentials(req.body);
	if (!username || !password) return res.status(400).json({ error: 'Can username va password' });
	if (!config.jwtSecret) return res.status(500).json({ error: 'JWT_SECRET chua duoc cau hinh' });

	const user = await User.findOne({ username }).select('+password');
	if (!user || !(await bcrypt.compare(password, user.password))) {
		return res.status(401).json({ error: 'username hoac password khong dung' });
	}

	user.status_online = true;
	await user.save();
	const token = createToken(user);
	setAuthCookie(req, res, token);
	res.json({ token, user: publicUser(user) });
}

function getCurrentAccount(req, res) {
	res.json({ user: publicUser(req.user) });
}

async function updateAccount(req, res) {
	const updates = {};
	if (req.body.username !== undefined) {
		if (typeof req.body.username !== 'string') return res.status(400).json({ error: 'username khong hop le' });
		const username = req.body.username.trim().toLowerCase();
		if (username.length < 3 || username.length > 40) return res.status(400).json({ error: 'username phai co 3-40 ky tu' });
		if (username === 'admin') return res.status(400).json({ error: 'username admin duoc danh rieng cho tai khoan quan tri' });
		updates.username = username;
	}
	if (req.body.password !== undefined) {
		if (typeof req.body.password !== 'string' || req.body.password.length < PASSWORD_MIN_LENGTH) {
			return res.status(400).json({ error: 'password phai co it nhat 8 ky tu' });
		}
		updates.password = await bcrypt.hash(req.body.password, 12);
	}
	if (!Object.keys(updates).length) return res.status(400).json({ error: 'Khong co thong tin de cap nhat' });

	try {
		const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
		res.json({ user: publicUser(user) });
	} catch (error) {
		if (error.code === 11000) return res.status(409).json({ error: 'username da ton tai' });
		throw error;
	}
}

async function deleteAccount(req, res) {
	await User.findByIdAndDelete(req.user._id);
	res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', path: '/' });
	res.status(204).end();
}

async function logout(req, res) {
	req.user.status_online = false;
	await req.user.save();
	res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', path: '/' });
	res.redirect(303, '/login');
}

module.exports = { register, login, getCurrentAccount, updateAccount, deleteAccount, logout };

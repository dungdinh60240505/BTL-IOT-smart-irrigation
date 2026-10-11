const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

function rejectAuthentication(req, res, message, status = 401) {
	res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', path: '/' });
	if (!req.originalUrl.startsWith('/api/')) return res.redirect('/login');
	return res.status(status).json({ error: message });
}

function readCookie(req, name) {
	const cookie = (req.headers.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
	return cookie ? cookie.slice(name.length + 1) : '';
}

async function authenticateToken(req, res, next) {
	if (!config.jwtSecret) return rejectAuthentication(req, res, 'JWT_SECRET chua duoc cau hinh', 500);
	const authorization = req.get('Authorization') || '';
	let token = readCookie(req, 'auth_token');
	if (authorization) {
		const [scheme, bearerToken, extra] = authorization.trim().split(/\s+/);
		if (scheme !== 'Bearer' || !bearerToken || extra) return rejectAuthentication(req, res, 'Can Authorization: Bearer <token>');
		token = bearerToken;
	}
	if (!token) return rejectAuthentication(req, res, 'Can Authorization: Bearer <token>');

	let payload;
	try {
		payload = jwt.verify(token, config.jwtSecret);
	} catch {
		return rejectAuthentication(req, res, 'Token khong hop le hoac da het han');
	}
	if (!payload.sub) return rejectAuthentication(req, res, 'Token khong hop le');
	try {
		const user = await User.findById(payload.sub).select('_id username status_online createdAt');
		if (!user) return rejectAuthentication(req, res, 'Tai khoan khong ton tai');
		if (!user.status_online) return rejectAuthentication(req, res, 'Phien dang nhap da ket thuc');
		req.user = user;
		next();
	} catch (error) {
		next(error);
	}
}

module.exports = { authenticateToken };

const User = require('../models/User');

/**
 * Lấy danh sách toàn bộ người dùng (không trả về mật khẩu)
 * Hỗ trợ tìm kiếm theo username qua query: ?search=...
 */
async function listUsers(req, res) {
	const { search } = req.query;
	const filter = {};
	if (search && typeof search === 'string') {
		filter.username = { $regex: search.trim(), $options: 'i' };
	}
	const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
	res.json(users);
}

/**
 * Lấy thông tin chi tiết một người dùng theo ID
 */
async function getUserById(req, res) {
	const user = await User.findById(req.params.id).select('-password');
	if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
	res.json(user);
}

/**
 * Helper tìm tài khoản admin trong hệ sinh thái
 * Ưu tiên: role: 'admin' -> username: 'admin' -> tài khoản khởi tạo sớm nhất
 */
async function findAdminUser() {
	const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
	return admin;
}

/**
 * Cập nhật thông tin người dùng (patch field turnOnPump, priority, status_online, role)
 */
async function patchUser(req, res) {
	const { id } = req.params;
	const { turnOnPump, priority, status_online, role } = req.body;
	const updates = {};

	if (turnOnPump !== undefined) {
		if (typeof turnOnPump !== 'boolean') {
			return res.status(400).json({ error: 'turnOnPump phai la true hoac false' });
		}
		updates.turnOnPump = turnOnPump;
	}
	if (priority !== undefined) {
		const parsedPriority = Number(priority);
		if (Number.isNaN(parsedPriority)) {
			return res.status(400).json({ error: 'Độ ưu tiên (priority) phải là một số hợp lệ' });
		}
		updates.priority = parsedPriority;
	}
	if (status_online !== undefined) {
		if (typeof status_online !== 'boolean') {
			return res.status(400).json({ error: 'status_online phai la true hoac false' });
		}
		updates.status_online = status_online;
	}
	if (role !== undefined && (role === 'admin' || role === 'user')) {
		updates.role = role;
	}

	if (Object.keys(updates).length === 0) {
		return res.status(400).json({ error: 'Không có dữ liệu cần cập nhật' });
	}

	// Không cho phép thay đổi quyền turnOnPump của tài khoản admin
	if (updates.turnOnPump !== undefined) {
		const target = await User.findById(id);
		if (target && target.role === 'admin') {
			delete updates.turnOnPump;
		}
	}

	// Nếu cập nhật turnOnPump: true thì cập nhật toàn bộ user turnOnPump: false trước rồi mới cập nhật user đó
	if (updates.turnOnPump === true) {
		await User.updateMany({}, { $set: { turnOnPump: false } });
	}

	const user = await User.findByIdAndUpdate(
		id,
		{ $set: updates },
		{ new: true, runValidators: true }
	).select('-password');

	if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

	// Nếu cập nhật turnOnPump: false thì sau khi cập nhật user đó, cập nhật user admin turnOnPump: true
	if (updates.turnOnPump === false) {
		const admin = await findAdminUser();
		if (admin) {
			await User.findByIdAndUpdate(admin._id, { $set: { turnOnPump: true } });
		}
	}

	res.json({
		message: updates.turnOnPump !== undefined
			? (updates.turnOnPump ? 'Đã cấp quyền bật máy bơm' : 'Đã thu hồi quyền bật máy bơm (quyền chuyển về cho Quản trị viên)')
			: 'Cập nhật thông tin thành công',
		user,
	});
}

/**
 * API chuyên dụng để cấp hoặc thu hồi quyền bật bơm (patch field turnOnPump)
 */
async function patchUserPumpPermission(req, res) {
	const { id } = req.params;
	const { turnOnPump } = req.body;
	if (turnOnPump === undefined) {
		return res.status(400).json({ error: 'Thiếu trường turnOnPump (true hoặc false)' });
	}

	const targetUser = await User.findById(id);
	if (!targetUser) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

	// Admin không cấp/thu hồi quyền của chính mình
	if (targetUser.role === 'admin') {
		return res.status(400).json({ error: 'Không thể cấp hoặc thu hồi quyền của chính tài khoản Quản trị viên (Admin)' });
	}

	if (typeof turnOnPump !== 'boolean') {
		return res.status(400).json({ error: 'turnOnPump phai la true hoac false' });
	}
	const hasPermission = turnOnPump;

	if (hasPermission) {
		// 1. Cập nhật toàn bộ user turnOnPump: false trước rồi mới cập nhật user đó (vì 1 lúc chỉ 1 user có turnOnPump: true)
		await User.updateMany({}, { $set: { turnOnPump: false } });

		const user = await User.findByIdAndUpdate(
			id,
			{ $set: { turnOnPump: true } },
			{ new: true, runValidators: true }
		).select('-password');

		if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

		return res.json({
			message: 'Đã cấp quyền bật máy bơm thành công (các tài khoản khác đã tự động thu hồi)',
			user,
		});
	} else {
		// 1. Cập nhật user đó turnOnPump: false
		const user = await User.findByIdAndUpdate(
			id,
			{ $set: { turnOnPump: false } },
			{ new: true, runValidators: true }
		).select('-password');

		if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

		// 2. Sau khi cập nhật user đó, cập nhật user admin turnOnPump: true (thu hồi quyền thì quyền về admin)
		const admin = await findAdminUser();
		if (admin) {
			await User.findByIdAndUpdate(admin._id, { $set: { turnOnPump: true } });
		}

		return res.json({
			message: 'Đã thu hồi quyền bật máy bơm thành công (quyền đã chuyển về cho Quản trị viên)',
			user,
		});
	}
}

/**
 * Xóa người dùng theo ID
 */
async function deleteUser(req, res) {
	const user = await User.findByIdAndDelete(req.params.id);
	if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

	// Nếu user bị xóa đang nắm giữ quyền bật bơm, hoàn trả quyền cho admin
	if (user.turnOnPump) {
		const admin = await findAdminUser();
		if (admin) {
			await User.findByIdAndUpdate(admin._id, { $set: { turnOnPump: true } });
		}
	}

	res.status(204).end();
}

module.exports = {
	listUsers,
	getUserById,
	patchUser,
	patchUserPumpPermission,
	deleteUser,
};

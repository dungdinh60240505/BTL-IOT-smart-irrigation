const router = require('express').Router();
const userController = require('../controllers/user');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Yêu cầu xác thực tài khoản cho tất cả các thao tác liên quan tới User
router.use(authenticateToken);

// Danh sách và chi tiết người dùng
router.get('/', userController.listUsers);
router.get('/:id', userController.getUserById);

// Các thao tác phân quyền và quản lý tài khoản: Chỉ quản trị viên (Admin) mới có quyền
router.patch('/:id', requireAdmin, userController.patchUser);
router.patch('/:id/turnOnPump', requireAdmin, userController.patchUserPumpPermission);
router.patch('/:id/permission', requireAdmin, userController.patchUserPumpPermission);
router.delete('/:id', requireAdmin, userController.deleteUser);

module.exports = router;

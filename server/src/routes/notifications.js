const router = require('express').Router();
const controller = require('../controllers/notification');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/', controller.listNotifications);
router.patch('/read-all', controller.markAllNotificationsRead);
router.patch('/:id/read', controller.markNotificationRead);

module.exports = router;

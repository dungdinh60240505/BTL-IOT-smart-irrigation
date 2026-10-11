const router = require('express').Router();
const authController = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getCurrentAccount);
router.post('/logout', authenticateToken, authController.logout);
router.put('/account', authenticateToken, authController.updateAccount);
router.delete('/account', authenticateToken, authController.deleteAccount);

module.exports = router;
const router = require('express').Router();
const deviceController = require('../controllers/device');
const { authenticateToken, requireAdmin, requirePumpPermission } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/', deviceController.listDevices);
router.post('/', deviceController.upsertDevice);
router.put('/attributes/all', requireAdmin, deviceController.updateAllAttributes);
router.post('/attributes/all', requireAdmin, deviceController.updateAllAttributes);
router.put('/attributes', requireAdmin, deviceController.updateAllAttributes);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', requireAdmin, deviceController.deleteDevice);
router.get('/:id', deviceController.getDevice);
router.put('/:id/attributes', requireAdmin, deviceController.updateAttributes);
router.post('/:id/attributes', requireAdmin, deviceController.updateAttributes);
router.get('/:id/telemetry', deviceController.getDeviceTelemetry);
router.post('/:id/command', requirePumpPermission, deviceController.sendCommand);

module.exports = router;

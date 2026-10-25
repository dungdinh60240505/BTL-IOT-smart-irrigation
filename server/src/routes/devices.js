const router = require('express').Router();
const deviceController = require('../controllers/device');

router.get('/', deviceController.listDevices);
router.post('/', deviceController.upsertDevice);
router.put('/attributes/all', deviceController.updateAllAttributes);
router.post('/attributes/all', deviceController.updateAllAttributes);
router.put('/attributes', deviceController.updateAllAttributes);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);
router.get('/:id', deviceController.getDevice);
router.put('/:id/attributes', deviceController.updateAttributes);
router.post('/:id/attributes', deviceController.updateAttributes);
router.get('/:id/telemetry', deviceController.getDeviceTelemetry);
router.post('/:id/command', deviceController.sendCommand);

module.exports = router;

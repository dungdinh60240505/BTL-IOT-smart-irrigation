const router = require('express').Router();
const assetController = require('../controllers/asset');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/', assetController.listAssets);
router.post('/', assetController.createAsset);
router.put('/:id/layout', assetController.updateAssetLayout);
router.put('/:id', assetController.updateAsset);
router.delete('/:id', requireAdmin, assetController.deleteAsset);
router.put('/:id/devices', assetController.updateAssetDevices);
router.get('/watering-history', assetController.getWateringHistory);
router.get('/:id/devices', assetController.listAssetDevices);
router.get('/:id/watering-history', assetController.getWateringHistory);
router.get('/:id/stats', assetController.getAssetStats);

module.exports = router;

const router = require('express').Router();
const assetController = require('../controllers/asset');

router.get('/', assetController.listAssets);
router.post('/', assetController.createAsset);
router.put('/:id', assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);
router.put('/:id/devices', assetController.updateAssetDevices);
router.get('/:id/devices', assetController.listAssetDevices);
router.get('/:id/watering-history', assetController.getWateringHistory);
router.get('/:id/stats', assetController.getAssetStats);

module.exports = router;

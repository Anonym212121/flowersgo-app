const express = require('express');
const adminProductController = require('../controllers/adminProductController');
const adminCategoryController = require('../controllers/adminCategoryController');
const adminReviewController = require('../controllers/adminReviewController');
const router = express.Router();

router.get('/categories', adminCategoryController.listForAdmin);
router.get('/products', adminProductController.listForAdmin);
router.get('/products/:id', adminProductController.getOneForAdmin);
router.post('/products', adminProductController.createForAdmin);
router.post('/products/:id', adminProductController.updateForAdmin);

router.get('/reviews', adminReviewController.listPendingForAdmin);
router.post('/reviews/:id/approve', adminReviewController.approveForAdmin);
router.delete('/reviews/:id', adminReviewController.deleteForAdmin);

router.get('/ping', (req, res) => {
    return res.status(200).json({ ok: true });
});

module.exports = router;

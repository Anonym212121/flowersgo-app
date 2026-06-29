const express = require('express');
const adminProductController = require('../controllers/adminProductController');
const adminCategoryController = require('../controllers/adminCategoryController');
const adminReviewController = require('../controllers/adminReviewController');
const adminOrderController = require('../controllers/adminOrderController');
const adminDashboardController = require('../controllers/adminDashboardController');
const adminUserController = require('../controllers/adminUserController');
const adminDeliveryController = require('../controllers/adminDeliveryController');
const adminConstructorController = require('../controllers/adminConstructorController');
const adminBouquetTemplateController = require('../controllers/adminBouquetTemplateController');
const constructorColorImageController = require('../controllers/constructorColorImageController');
const adminLegalController = require('../controllers/adminLegalController');
const adminCourierController = require('../controllers/adminCourierController');
const adminSupportChatController = require('../controllers/adminSupportChatController');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const router = express.Router();

router.get('/dashboard', adminDashboardController.getStats);
router.get('/dashboard/revenue', adminDashboardController.getRevenue);

router.get('/stats/options', adminAnalyticsController.getFilterOptions);
router.get('/stats/report', adminAnalyticsController.getReport);
router.get('/stats/export', adminAnalyticsController.exportCsv);

router.get('/categories', adminCategoryController.listForAdmin);
router.post('/categories', adminCategoryController.createForAdmin);
router.post('/categories/:id', adminCategoryController.updateForAdmin);
router.post('/categories/:id/move', adminCategoryController.moveForAdmin);
router.delete('/categories/:id', adminCategoryController.deleteForAdmin);

router.get('/products', adminProductController.listForAdmin);
router.get('/products/:id', adminProductController.getOneForAdmin);
router.post('/products', adminProductController.createForAdmin);
router.post('/products/bulk', adminProductController.bulkForAdmin);
router.post('/products/:id', adminProductController.updateForAdmin);
router.post('/products/:id/toggle-active', adminProductController.setActiveForAdmin);
router.post('/products/:id/stock', adminProductController.updateStockForAdmin);
router.post('/products/:id/duplicate', adminProductController.duplicateForAdmin);
router.delete('/products/:id', adminProductController.deleteForAdmin);

router.get('/reviews', adminReviewController.listPendingForAdmin);
router.post('/reviews/:id/approve', adminReviewController.approveForAdmin);
router.delete('/reviews/:id', adminReviewController.deleteForAdmin);
router.post('/review-requests/:id/approve-edit', adminReviewController.approveEditRequest);
router.post('/review-requests/:id/approve-delete', adminReviewController.approveDeleteRequest);
router.post('/review-requests/:id/reject', adminReviewController.rejectChangeRequest);

router.get('/orders', adminOrderController.listPendingForAdmin);
router.get('/orders/awaiting-payment', adminOrderController.listAwaitingPaymentForAdmin);
router.get('/orders/all', adminOrderController.listAllForAdmin);
router.get('/orders/:id/detail', adminOrderController.getDetailForAdmin);
router.post('/orders/:id/approve', adminOrderController.approveForAdmin);
router.post('/orders/:id/reject', adminOrderController.rejectForAdmin);
router.post('/orders/:id/cancel/approve', adminOrderController.approveCancelForAdmin);
router.post('/orders/:id/cancel/reject', adminOrderController.rejectCancelForAdmin);
router.post('/orders/:id/assign-courier', adminCourierController.assignCourier);
router.post('/orders/:id/auto-assign-courier', adminCourierController.autoAssignCourier);
router.post('/orders/:id/unassign-courier', adminCourierController.unassignCourier);

router.get('/couriers', adminCourierController.listCouriers);
router.post('/couriers/:id/work-email', adminCourierController.updateWorkEmail);
router.post('/couriers/:id/shift', adminCourierController.setShift);
router.post('/couriers/auto-assign-ready', adminCourierController.autoAssignAllReady);

router.get('/users', adminUserController.listForAdmin);
router.post('/users/:id/role', adminUserController.updateRole);
router.post('/users/:id/block', adminUserController.setBlocked);

router.get('/delivery-settings', adminDeliveryController.getSettings);
router.post('/delivery-settings', adminDeliveryController.saveSettings);

router.get('/constructor-products', adminConstructorController.listProducts);
router.get('/constructor-products/:id/colors', adminConstructorController.listColors);
router.post('/constructor-products/:id/colors', adminConstructorController.createColor);
router.post('/constructor-colors/:id', adminConstructorController.updateColor);
router.delete('/constructor-colors/:id', adminConstructorController.deleteColor);

router.post(
    '/constructor-colors/:id/image',
    constructorColorImageController.uploadMiddleware,
    constructorColorImageController.uploadVariantImage
);

router.get('/bouquet-templates/form-data', adminBouquetTemplateController.getFormData);
router.get('/bouquet-templates', adminBouquetTemplateController.listForAdmin);
router.get('/bouquet-templates/:id', adminBouquetTemplateController.getOneForAdmin);
router.post('/bouquet-templates', adminBouquetTemplateController.createForAdmin);
router.post('/bouquet-templates/:id', adminBouquetTemplateController.updateForAdmin);
router.post('/bouquet-templates/:id/toggle-active', adminBouquetTemplateController.setActiveForAdmin);
router.delete('/bouquet-templates/:id', adminBouquetTemplateController.deleteForAdmin);

router.get('/legal-pages', adminLegalController.listForAdmin);
router.get('/legal-pages/:slug', adminLegalController.getOneForAdmin);
router.post('/legal-pages/:slug', adminLegalController.saveForAdmin);

router.get('/support/chats/counts', adminSupportChatController.getCounts);
router.get('/support/chats/inbox', adminSupportChatController.listInbox);
router.get('/support/chats/mine', adminSupportChatController.listMine);
router.get('/support/chats/archive', adminSupportChatController.listArchive);
router.get('/support/chats/:id/poll', adminSupportChatController.pollChat);
router.get('/support/chats/:id', adminSupportChatController.getChatDetail);
router.post('/support/chats/:id/claim', adminSupportChatController.claimChat);
router.post('/support/chats/:id/message', adminSupportChatController.sendMessage);
router.post('/support/chats/:id/close', adminSupportChatController.closeChat);
router.post('/support/chats/:id/read', adminSupportChatController.markRead);

router.get('/ping', (req, res) => {
    return res.status(200).json({ ok: true });
});

module.exports = router;

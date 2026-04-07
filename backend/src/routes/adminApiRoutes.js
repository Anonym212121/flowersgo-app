const express = require('express');
const adminProductController = require('../controllers/adminProductController');
const router = express.Router();

router.get('/products', adminProductController.listForAdmin);

router.get('/ping', (req, res) => {
    return res.status(200).json({ ok: true });
});

module.exports = router;

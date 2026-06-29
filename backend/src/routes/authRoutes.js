const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);
router.post('/blocked-info', authController.blockedInfo);
router.post('/blocked-message', authController.blockedMessage);
router.get('/me', authMiddleware, authController.me);
module.exports = router;


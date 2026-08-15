const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const createRateLimit = require('../middleware/rateLimit');
const honeypot = require('../middleware/honeypot');

const router = express.Router();

const authLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    scope: 'auth',
    message: 'Забагато спроб входу. Зачекайте кілька хвилин.'
});

const registerLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    scope: 'register',
    message: 'Забагато спроб реєстрації. Спробуйте пізніше.'
});

router.post('/register', registerLimit, honeypot, authController.register);
router.post('/login', authLimit, honeypot, authController.login);
router.post('/google', authLimit, authController.googleAuth);
router.post('/blocked-info', authLimit, honeypot, authController.blockedInfo);
router.post('/blocked-message', authLimit, honeypot, authController.blockedMessage);
router.get('/me', authMiddleware, authController.me);
module.exports = router;


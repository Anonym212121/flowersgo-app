const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');
const WishlistModel = require('../models/Wishlist');
const supportChatService = require('../services/supportChatService');
const registerValidator = require('../validators/registerValidator');
const loginValidator = require('../validators/loginValidator');
const googleAuthService = require('../services/googleAuthService');
const { getBlockReasonText } = require('../constants/blockReasons');

const parseGuestWishlist = (cookieHeader) => {
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return [];
    }

    const part = cookieHeader
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('guest_wishlist='));

    if (!part) {
        return [];
    }

    try {
        const raw = decodeURIComponent(part.split('=')[1] || '[]');
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
            .slice(0, 100);
    } catch {
        return [];
    }
};

const buildAuthToken = (user) => {
    return jwt.sign(
        {
            user_id: user.id,
            role_id: user.role_id,
            role_name: user.role_name
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

const setAuthCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};

const mergeGuestWishlist = async (req, res, userId) => {
    const guestIds = parseGuestWishlist(req.headers.cookie);
    if (guestIds.length > 0) {
        await WishlistModel.addMany(userId, guestIds);
        res.clearCookie('guest_wishlist');
    }
};

const buildPublicUser = (user) => ({
    id: user.id,
    role_id: user.role_id,
    role_name: user.role_name,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url,
    loyalty_points: user.loyalty_points
});

const register = async (req, res) => {
    try {
        const validation = registerValidator(req.body);
        if (!validation.ok) {
            return res.status(400).json({ message: validation.message });
        }

        const { first_name, last_name, email, password, phone } = validation.data;
        const password_hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 10));

        const role_id = await UserModel.getDefaultRoleId();

        const user = await UserModel.createUser({
            role_id,
            first_name,
            last_name,
            email,
            password_hash,
            phone
        });

        const token = buildAuthToken(user);
        setAuthCookie(res, token);
        await mergeGuestWishlist(req, res, user.id);

        return res.status(201).json({
            message: 'Реєстрацію завершено',
            token,
            user: buildPublicUser(user)
        });
    } catch (err) {
        if (err && err.message) {
            if (err.message.toLowerCase().includes('email')) {
                return res.status(400).json({ message: err.message });
            }
        }

        return res.status(500).json({ message: 'Сталася помилка реєстрації' });
    }
};

const login = async (req, res) => {
    try {
        const validation = loginValidator(req.body);
        if (!validation.ok) {
            return res.status(400).json({ message: validation.message });
        }

        const { email, password } = validation.data;

        const user = await UserModel.findUserByEmailWithRole(email);
        if (!user) {
            return res.status(401).json({ message: 'Невірний email або пароль' });
        }

        if (!user.password_hash) {
            return res.status(401).json({ message: 'Невірний email або пароль' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Невірний email або пароль' });
        }

        if (Number(user.is_blocked) === 1) {
            return res.status(403).json({
                message: 'Акаунт заблоковано адміністратором',
                blocked: true
            });
        }

        const token = buildAuthToken(user);
        setAuthCookie(res, token);
        await mergeGuestWishlist(req, res, user.id);

        return res.status(200).json({
            message: 'Успішний вхід',
            token,
            user: buildPublicUser(user)
        });
    } catch (err) {
        return res.status(500).json({ message: 'Сталася помилка авторизації' });
    }
};

const blockedInfo = async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';

        if (!email || !password) {
            return res.status(400).json({ message: 'Вкажіть email і пароль' });
        }

        const user = await UserModel.findUserByEmailWithRole(email);
        if (!user) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        if (!user.password_hash) {
            return res.status(401).json({ message: 'Невірний пароль' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Невірний пароль' });
        }

        if (Number(user.is_blocked) !== 1) {
            return res.status(400).json({ message: 'Цей акаунт не заблоковано' });
        }

        const reason = getBlockReasonText(user.block_reason_key, user.block_reason_text);

        return res.status(200).json({ reason });
    } catch (err) {
        return res.status(500).json({ message: 'Сталася помилка' });
    }
};

const blockedMessage = async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const message_text = typeof req.body.message === 'string' ? req.body.message.trim() : '';

        if (!email || !password) {
            return res.status(400).json({ message: 'Вкажіть email і пароль' });
        }

        if (message_text.length < 5) {
            return res.status(400).json({ message: 'Повідомлення занадто коротке' });
        }

        const user = await UserModel.findUserByEmailWithRole(email);
        if (!user) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        if (!user.password_hash) {
            return res.status(401).json({ message: 'Невірний пароль' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Невірний пароль' });
        }

        if (Number(user.is_blocked) !== 1) {
            return res.status(400).json({ message: 'Цей акаунт не заблоковано' });
        }

        const result = await supportChatService.submitBlockedUserMessage(
            user.id,
            user.email,
            message_text
        );
        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Не вдалося надіслати повідомлення' });
        }

        return res.status(200).json({ message: 'Повідомлення надіслано адміністратору' });
    } catch (err) {
        return res.status(500).json({ message: 'Сталася помилка' });
    }
};

const me = async (req, res) => {
    try {
        const profile = await UserModel.getUserid(req.user.user_id);

        if (!profile) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        return res.status(200).json({ user: profile });
    } catch (err) {
        return res.status(500).json({ message: 'помилка' });
    }
};

const googleAuth = async (req, res) => {
    try {
        if (!googleAuthService.getClientId()) {
            return res.status(503).json({ message: 'Google вхід не налаштовано' });
        }

        const credential =
            typeof req.body.credential === 'string' ? req.body.credential.trim() : '';
        if (!credential) {
            return res.status(400).json({ message: 'Немає даних від Google' });
        }

        const profile = await googleAuthService.verifyCredential(credential);
        if (!profile) {
            return res.status(401).json({ message: 'Не вдалося перевірити Google акаунт' });
        }

        let user = await UserModel.findByGoogleId(profile.google_id);
        let isNew = false;

        if (!user) {
            const byEmail = await UserModel.findUserByEmailWithRole(profile.email);
            if (byEmail) {
                if (byEmail.google_id && String(byEmail.google_id) !== String(profile.google_id)) {
                    return res.status(400).json({
                        message: 'Цей email вже прив’язаний до іншого Google акаунта'
                    });
                }
                if (!byEmail.google_id) {
                    await UserModel.linkGoogleId(byEmail.id, profile.google_id);
                }
                user = await UserModel.findUserByEmailWithRole(profile.email);
            } else {
                const role_id = await UserModel.getDefaultRoleId();
                user = await UserModel.createGoogleUser({
                    role_id,
                    google_id: profile.google_id,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    email: profile.email,
                    avatar_url: profile.avatar_url
                });
                isNew = true;
            }
        }

        if (!user) {
            return res.status(500).json({ message: 'Не вдалося увійти через Google' });
        }

        if (Number(user.is_blocked) === 1) {
            return res.status(403).json({
                message: 'Акаунт заблоковано адміністратором',
                blocked: true
            });
        }

        const token = buildAuthToken(user);
        setAuthCookie(res, token);
        await mergeGuestWishlist(req, res, user.id);

        return res.status(isNew ? 201 : 200).json({
            message: isNew ? 'Реєстрацію через Google завершено' : 'Успішний вхід через Google',
            token,
            user: buildPublicUser(user)
        });
    } catch (err) {
        if (err && err.message && err.message.toLowerCase().includes('email')) {
            return res.status(400).json({ message: err.message });
        }
        console.error('googleAuth:', err.message);
        return res.status(500).json({ message: 'Сталася помилка авторизації через Google' });
    }
};

module.exports = {
    register,
    login,
    googleAuth,
    blockedInfo,
    blockedMessage,
    me
};


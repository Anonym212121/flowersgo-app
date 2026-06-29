const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/User');
const OrderModel = require('../models/Order');
const ReviewModel = require('../models/Review');
const PasswordEmailCodeModel = require('../models/PasswordEmailCode');
const orderCancelService = require('../services/orderCancelService');
const orderRoleNotifyService = require('../services/orderRoleNotifyService');
const emailService = require('../services/emailService');
const paymentToken = require('../utils/paymentToken');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');

const ensureUploadsDir = () => {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadsDir();
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const safeExt = allowedExt.includes(ext) ? ext : '.jpg';
        const name = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
        cb(null, name);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMime = /^(image\/jpeg|image\/jpg|image\/png|image\/gif|image\/webp)$/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (allowedMime.test(file.mimetype || '') || allowedExt.includes(ext)) {
        return cb(null, true);
    }
    cb(new Error('Дозволені лише зображення: jpeg, png, gif, webp'));
};

const upload = multer({
    storage,
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter
});

const uploadAvatarMiddleware = upload.single('avatar');

const isJsonRequest = (req) => {
    const accept = String(req.headers.accept || '').toLowerCase();
    const xr = String(req.headers['x-requested-with'] || '').toLowerCase();
    return accept.includes('application/json') || xr === 'xmlhttprequest';
};

const respond = (req, res, payload) => {
    if (isJsonRequest(req)) {
        return res.status(payload.ok ? 200 : 400).json(payload);
    }

    if (payload.ok) {
        const suffix = payload.pw_step ? `&pw_step=${payload.pw_step}` : '';
        return res.redirect(`/cabinet?ok=${payload.ok_code || 'saved'}${suffix}`);
    }
    const suffix = payload.pw_step ? `&pw_step=${payload.pw_step}` : '';
    return res.redirect(`/cabinet?err=${payload.err_code || 'server'}${suffix}`);
};

const isEmailValid = (email) => {
    if (!email || typeof email !== 'string') {
        return false;
    }
    const value = email.trim();
    if (!value.includes('@') || value.includes(' ')) {
        return false;
    }
    const parts = value.split('@');
    if (parts.length !== 2) {
        return false;
    }
    const domain = parts[1] || '';
    return domain.includes('.') && domain.split('.').pop().length >= 2;
};

const updateProfile = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        if (!current || !current.user_id) {
            if (isJsonRequest(req)) {
                return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
            }
            return res.redirect('/login');
        }

        const first_name = typeof req.body.first_name === 'string' ? req.body.first_name.trim() : '';
        const last_name = typeof req.body.last_name === 'string' ? req.body.last_name.trim() : '';
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const rawPhone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
        const phoneDigits = rawPhone.replace(/\D/g, '');
        const saved_delivery_street =
            typeof req.body.saved_delivery_street === 'string' ? req.body.saved_delivery_street.trim() : '';
        const saved_delivery_house =
            typeof req.body.saved_delivery_house === 'string' ? req.body.saved_delivery_house.trim() : '';
        const saved_delivery_apartment =
            typeof req.body.saved_delivery_apartment === 'string' ? req.body.saved_delivery_apartment.trim() : '';

        if (first_name.length < 2) {
            return respond(req, res, { ok: false, err_code: 'bad_first_name', message: "Ім'я має бути не менше 2 символів" });
        }
        if (last_name.length < 2) {
            return respond(req, res, { ok: false, err_code: 'bad_last_name', message: 'Прізвище має бути не менше 2 символів' });
        }
        if (!isEmailValid(email)) {
            return respond(req, res, { ok: false, err_code: 'bad_email', message: 'Вкажіть коректний email' });
        }
        if (phoneDigits.length > 0 && (phoneDigits.length < 10 || phoneDigits.length > 20)) {
            return respond(req, res, { ok: false, err_code: 'bad_phone', message: 'Номер телефону має бути від 10 до 20 цифр' });
        }
        if (saved_delivery_street.length > 255) {
            return respond(req, res, { ok: false, err_code: 'bad_address', message: 'Вулиця занадто довга' });
        }
        if (saved_delivery_house.length > 50) {
            return respond(req, res, { ok: false, err_code: 'bad_address', message: 'Номер будинку занадто довгий' });
        }
        if (saved_delivery_apartment.length > 50) {
            return respond(req, res, { ok: false, err_code: 'bad_address', message: 'Квартира / офіс занадто довгі' });
        }
        if ((saved_delivery_street && !saved_delivery_house) || (!saved_delivery_street && saved_delivery_house)) {
            return respond(req, res, {
                ok: false,
                err_code: 'bad_address',
                message: 'Для збереженої адреси вкажи і вулицю, і будинок'
            });
        }

        const emailTaken = await UserModel.findByEmailExceptUserId(email, current.user_id);
        if (emailTaken) {
            return respond(req, res, { ok: false, err_code: 'email_exists', message: 'Такий email вже використовується' });
        }

        const phone = phoneDigits.length > 0 ? rawPhone : null;
        const street = saved_delivery_street || null;
        const house = saved_delivery_house || null;
        const apartment = saved_delivery_apartment || null;
        const updated = await UserModel.updateProfileById({
            user_id: current.user_id,
            first_name,
            last_name,
            email,
            phone,
            saved_delivery_street: street,
            saved_delivery_house: house,
            saved_delivery_apartment: apartment
        });

        if (!updated) {
            return respond(req, res, { ok: false, err_code: 'profile_not_updated', message: 'Не вдалося оновити профіль' });
        }

        return respond(req, res, { ok: true, ok_code: 'profile_saved', message: 'Профіль успішно оновлено' });
    } catch (err) {
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

const updateAvatar = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        if (!current || !current.user_id) {
            if (req.file && req.file.path) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch {
                }
            }
            if (isJsonRequest(req)) {
                return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
            }
            return res.redirect('/login');
        }

        if (!req.file) {
            return respond(req, res, { ok: false, err_code: 'avatar_empty', message: 'Оберіть файл для аватара' });
        }

        const profile = await UserModel.getUserid(current.user_id);
        const avatar_url = `/uploads/avatars/${req.file.filename}`;
        const updated = await UserModel.updateAvatarUrlById({
            user_id: current.user_id,
            avatar_url
        });

        if (!updated) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {
            }
            return respond(req, res, { ok: false, err_code: 'avatar_not_saved', message: 'Не вдалося зберегти аватар' });
        }

        if (profile && profile.avatar_url && profile.avatar_url.startsWith('/uploads/avatars/')) {
            const oldPath = path.join(__dirname, '..', '..', 'public', profile.avatar_url.replace('/uploads/', 'uploads/'));
            if (oldPath !== req.file.path && fs.existsSync(oldPath)) {
                try {
                    fs.unlinkSync(oldPath);
                } catch {
                }
            }
        }

        return respond(req, res, {
            ok: true,
            ok_code: 'avatar_saved',
            message: 'Аватар оновлено',
            avatar_url
        });
    } catch (err) {
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {
            }
        }
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

const requestPasswordEmailCode = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        if (!current || !current.user_id) {
            if (isJsonRequest(req)) {
                return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
            }
            return res.redirect('/login');
        }

        const profile = await UserModel.getUserid(current.user_id);
        if (!profile || !profile.email) {
            return respond(req, res, {
                ok: false,
                err_code: 'email_required_for_password_reset',
                message: 'У профілі має бути вказана пошта'
            });
        }

        const new_password = typeof req.body.new_password === 'string' ? req.body.new_password : '';
        const new_password_confirm =
            typeof req.body.new_password_confirm === 'string' ? req.body.new_password_confirm : '';

        if (!new_password || new_password.length < 6) {
            return respond(req, res, { ok: false, err_code: 'bad_new_password', message: 'Новий пароль має бути не менше 6 символів' });
        }
        if (new_password !== new_password_confirm) {
            return respond(req, res, { ok: false, err_code: 'password_confirm_mismatch', message: 'Підтвердження пароля не збігається' });
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const new_password_hash = await bcrypt.hash(
            new_password,
            Number(process.env.BCRYPT_SALT_ROUNDS || 10)
        );

        const codeId = await PasswordEmailCodeModel.createCode({
            user_id: current.user_id,
            email: String(profile.email),
            code,
            new_password_hash,
            expiresInMinutes: 10
        });
        if (!codeId) {
            return respond(req, res, { ok: false, err_code: 'email_code_not_saved', message: 'Не вдалося створити код підтвердження' });
        }

        const emailResult = await emailService.sendEmail({
            to: String(profile.email),
            subject: 'Код підтвердження зміни пароля',
            text: `Ваш код підтвердження: ${code}. Код діє 10 хвилин.`
        });
        if (!emailResult.ok) {
            await PasswordEmailCodeModel.consumeCode(codeId);
            return respond(req, res, { ok: false, err_code: 'email_not_sent', message: emailResult.message || 'Не вдалося відправити лист' });
        }

        return respond(req, res, {
            ok: true,
            ok_code: 'email_code_sent',
            message: 'Код підтвердження відправлено на вашу пошту',
            pw_step: 'verify',
            show_verify_step: true
        });
    } catch (err) {
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

const confirmPasswordByEmailCode = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        if (!current || !current.user_id) {
            if (isJsonRequest(req)) {
                return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
            }
            return res.redirect('/login');
        }

        const email_code = typeof req.body.email_code === 'string' ? req.body.email_code.trim() : '';
        if (!email_code || !/^\d{6}$/.test(email_code)) {
            return respond(req, res, {
                ok: false,
                err_code: 'bad_email_code_format',
                pw_step: 'verify',
                message: 'Код з листа має містити 6 цифр',
                show_verify_step: true
            });
        }

        const activeCode = await PasswordEmailCodeModel.getActiveCode(current.user_id);
        if (!activeCode) {
            return respond(req, res, { ok: false, err_code: 'email_code_expired', message: 'Код протермінований або неактивний' });
        }
        if (Number(activeCode.attempts_left) <= 0) {
            return respond(req, res, { ok: false, err_code: 'email_attempts_over', message: 'Вичерпано спроби введення коду' });
        }

        const emailHash = PasswordEmailCodeModel.hashCode(email_code);
        if (emailHash !== activeCode.code_hash) {
            await PasswordEmailCodeModel.decreaseAttempts(activeCode.id);
            return respond(req, res, {
                ok: false,
                err_code: 'bad_email_code',
                pw_step: 'verify',
                message: 'Невірний код з листа',
                show_verify_step: true
            });
        }

        const passwordUpdated = await UserModel.updatePasswordHashById({
            user_id: current.user_id,
            password_hash: activeCode.new_password_hash
        });
        if (!passwordUpdated) {
            return respond(req, res, { ok: false, err_code: 'password_not_updated', message: 'Не вдалося змінити пароль' });
        }

        await PasswordEmailCodeModel.consumeCode(activeCode.id);
        return respond(req, res, { ok: true, ok_code: 'password_changed', message: 'Пароль успішно змінено' });
    } catch (err) {
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

const archiveOrder = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        if (!current || !current.user_id) {
            if (isJsonRequest(req)) {
                return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
            }
            return res.redirect('/login');
        }

        const orderId = Number(req.params.id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return respond(req, res, { ok: false, err_code: 'bad_order', message: 'Невірне замовлення' });
        }

        const ok = await OrderModel.archiveByUserId(orderId, current.user_id);
        if (!ok) {
            return respond(req, res, { ok: false, err_code: 'archive_failed', message: 'Не вдалося архівувати замовлення' });
        }

        return respond(req, res, {
            ok: true,
            ok_code: 'order_archived',
            message: 'Замовлення переміщено в архів'
        });
    } catch (err) {
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

const requestOrderCancel = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        if (!current || !current.user_id) {
            if (isJsonRequest(req)) {
                return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
            }
            return res.redirect('/login');
        }

        const orderId = Number(req.params.id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return respond(req, res, { ok: false, err_code: 'bad_order', message: 'Невірне замовлення' });
        }

        const order = await OrderModel.getByIdForUserCancel(orderId, current.user_id);
        if (!order) {
            return respond(req, res, { ok: false, err_code: 'order_not_found', message: 'Замовлення не знайдено' });
        }

        const blockReason = orderCancelService.getCancelBlockReason(order);
        if (blockReason !== 'ok') {
            return respond(req, res, {
                ok: false,
                err_code: 'cancel_not_allowed',
                message: orderCancelService.getCancelBlockMessage(blockReason)
            });
        }

        const note = typeof req.body.cancel_note === 'string' ? req.body.cancel_note.trim() : '';
        const saved = await OrderModel.createCancelRequest(orderId, current.user_id, note);
        if (!saved) {
            return respond(req, res, {
                ok: false,
                err_code: 'cancel_request_failed',
                message: 'Не вдалося надіслати запит на скасування'
            });
        }

        try {
            await orderRoleNotifyService.onCancelRequestForAdmin(orderId);
        } catch (notifyErr) {
            console.error('onCancelRequestForAdmin:', notifyErr.message);
        }

        let message = 'Запит на скасування надіслано. Адмін підтвердить протягом робочого дня.';
        const hint = orderCancelService.getRefundHintForCustomer(order);
        if (hint) {
            message += ' ' + hint;
        }

        return respond(req, res, {
            ok: true,
            ok_code: 'cancel_request_sent',
            message: message
        });
    } catch (err) {
        console.error('requestOrderCancel:', err.message);
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

const requestReviewEdit = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        if (!current || !current.user_id) {
            if (isJsonRequest(req)) {
                return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
            }
            return res.redirect('/login');
        }

        const reviewId = Number(req.params.id);
        if (!reviewId || reviewId <= 0) {
            return respond(req, res, { ok: false, err_code: 'bad_review', message: 'Невірний відгук' });
        }

        const rating = Number(req.body.rating);
        const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';

        const result = await ReviewModel.createChangeRequest({
            review_id: reviewId,
            user_id: current.user_id,
            request_type: 'edit',
            new_rating: rating,
            new_comment: comment
        });

        if (result === 'pending') {
            return respond(req, res, {
                ok: false,
                err_code: 'review_request_pending',
                message: 'Запит на зміну вже очікує рішення адміна'
            });
        }
        if (!result) {
            return respond(req, res, { ok: false, err_code: 'review_edit_failed', message: 'Не вдалося надіслати запит' });
        }

        await orderRoleNotifyService.onReviewChangeRequestForAdmin(reviewId, 'edit');

        return respond(req, res, {
            ok: true,
            ok_code: 'review_edit_sent',
            message: 'Запит на редагування надіслано адміну'
        });
    } catch (err) {
        console.error('requestReviewEdit:', err.message);
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

const requestReviewDelete = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        if (!current || !current.user_id) {
            if (isJsonRequest(req)) {
                return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
            }
            return res.redirect('/login');
        }

        const reviewId = Number(req.params.id);
        if (!reviewId || reviewId <= 0) {
            return respond(req, res, { ok: false, err_code: 'bad_review', message: 'Невірний відгук' });
        }

        const result = await ReviewModel.createChangeRequest({
            review_id: reviewId,
            user_id: current.user_id,
            request_type: 'delete'
        });

        if (result === 'pending') {
            return respond(req, res, {
                ok: false,
                err_code: 'review_request_pending',
                message: 'Запит вже очікує рішення адміна'
            });
        }
        if (!result) {
            return respond(req, res, { ok: false, err_code: 'review_delete_failed', message: 'Не вдалося надіслати запит' });
        }

        await orderRoleNotifyService.onReviewChangeRequestForAdmin(reviewId, 'delete');

        return respond(req, res, {
            ok: true,
            ok_code: 'review_delete_sent',
            message: 'Запит на видалення надіслано адміну'
        });
    } catch (err) {
        console.error('requestReviewDelete:', err.message);
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

const requestGuestOrderCancel = async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return respond(req, res, { ok: false, err_code: 'bad_order', message: 'Невірне замовлення' });
        }

        const order = await OrderModel.getByIdForCancelCheck(orderId);
        if (!order || order.user_id != null) {
            return respond(req, res, { ok: false, err_code: 'order_not_found', message: 'Замовлення не знайдено' });
        }

        const tokenInfo = paymentToken.verify(req.query.t || req.body.pay_token, orderId);
        if (!tokenInfo || tokenInfo.userId !== 0) {
            if (isJsonRequest(req)) {
                return res.status(403).json({ ok: false, message: 'Немає доступу до замовлення' });
            }
            return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/'));
        }

        const blockReason = orderCancelService.getCancelBlockReason(order);
        if (blockReason !== 'ok') {
            return respond(req, res, {
                ok: false,
                err_code: 'cancel_not_allowed',
                message: orderCancelService.getCancelBlockMessage(blockReason)
            });
        }

        const note = typeof req.body.cancel_note === 'string' ? req.body.cancel_note.trim() : '';
        const saved = await OrderModel.createCancelRequestForOrder(orderId, note);
        if (!saved) {
            return respond(req, res, {
                ok: false,
                err_code: 'cancel_request_failed',
                message: 'Не вдалося надіслати запит на скасування'
            });
        }

        try {
            await orderRoleNotifyService.onCancelRequestForAdmin(orderId);
        } catch (notifyErr) {
            console.error('onCancelRequestForAdmin:', notifyErr.message);
        }

        let message = 'Запит на скасування надіслано. Адмін підтвердить протягом робочого дня.';
        const hint = orderCancelService.getRefundHintForCustomer(order);
        if (hint) {
            message += ' ' + hint;
        }

        const payToken = paymentToken.makeForOrder(orderId, 0);
        if (isJsonRequest(req)) {
            return res.status(200).json({ ok: true, message: message });
        }
        return res.redirect(
            '/order/success/' +
                orderId +
                '?t=' +
                encodeURIComponent(payToken) +
                '&ok=cancel_request_sent'
        );
    } catch (err) {
        console.error('requestGuestOrderCancel:', err.message);
        return respond(req, res, { ok: false, err_code: 'server', message: 'Сталася помилка сервера' });
    }
};

module.exports = {
    uploadAvatarMiddleware,
    updateProfile,
    updateAvatar,
    requestPasswordEmailCode,
    confirmPasswordByEmailCode,
    archiveOrder,
    requestOrderCancel,
    requestGuestOrderCancel,
    requestReviewEdit,
    requestReviewDelete
};

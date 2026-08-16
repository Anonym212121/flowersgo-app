const UserModel = require('../models/User');
const bcrypt = require('bcryptjs');
const { BLOCK_REASONS } = require('../constants/blockReasons');
const emailValidator = require('../validators/emailValidator');
const phoneValidator = require('../validators/phoneValidator');

const STAFF_ROLES = ['admin', 'warehouse_worker', 'courier'];
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

const listForAdmin = async (req, res) => {
    try {
        const search = typeof req.query.q === 'string' ? req.query.q : '';
        const users = await UserModel.listForAdmin(search);
        return res.status(200).json({ users, reasons: BLOCK_REASONS });
    } catch (err) {
        console.error('adminUsers list:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const createStaff = async (req, res) => {
    try {
        const body = req.body || {};
        const first_name = typeof body.first_name === 'string' ? body.first_name.trim() : '';
        const last_name = typeof body.last_name === 'string' ? body.last_name.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const password_confirm = typeof body.password_confirm === 'string' ? body.password_confirm : '';
        const roleName = typeof body.role_name === 'string' ? body.role_name.trim() : '';

        if (first_name.length < 2) {
            return res.status(400).json({ message: "Ім'я має бути не менше 2 символів" });
        }
        if (last_name.length < 2) {
            return res.status(400).json({ message: 'Прізвище має бути не менше 2 символів' });
        }
        if (!STAFF_ROLES.includes(roleName)) {
            return res.status(400).json({ message: 'Оберіть роль: адмін, склад або кур\'єр' });
        }

        const emailCheck = emailValidator(body.email);
        if (!emailCheck.ok) {
            return res.status(400).json({ message: emailCheck.message });
        }

        const phoneCheck = phoneValidator(typeof body.phone === 'string' ? body.phone : '');
        if (!phoneCheck.ok) {
            return res.status(400).json({ message: phoneCheck.message });
        }

        if (!password || password.length < MIN_PASSWORD) {
            return res.status(400).json({ message: 'Пароль має бути не менше 8 символів' });
        }
        if (password.length > MAX_PASSWORD) {
            return res.status(400).json({ message: 'Пароль занадто довгий' });
        }
        if (password !== password_confirm) {
            return res.status(400).json({ message: 'Підтвердження пароля не збігається' });
        }

        const existingEmail = await UserModel.findUserByEmailWithRole(emailCheck.email);
        if (existingEmail) {
            return res.status(400).json({ message: 'Email вже зареєстрований' });
        }

        const existingPhone = await UserModel.findUserByPhoneWithRole(phoneCheck.phone);
        if (existingPhone) {
            return res.status(400).json({ message: 'Цей телефон уже використовується' });
        }

        const role_id = await UserModel.getRoleIdByName(roleName);
        if (!role_id) {
            return res.status(400).json({ message: 'Роль не знайдено' });
        }

        const password_hash = await bcrypt.hash(
            password,
            Number(process.env.BCRYPT_SALT_ROUNDS || 10)
        );

        const user = await UserModel.createUser({
            role_id,
            first_name,
            last_name,
            email: emailCheck.email,
            password_hash,
            phone: phoneCheck.phone
        });

        if (user && user.id) {
            await UserModel.markEmailVerifiedById(user.id);
        }

        return res.status(201).json({
            message: 'Співробітника створено',
            user
        });
    } catch (err) {
        if (err && err.message && err.message.toLowerCase().includes('email')) {
            return res.status(400).json({ message: err.message });
        }
        console.error('adminUsers createStaff:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const body = req.body || {};
        const password = typeof body.password === 'string' ? body.password : '';
        const password_confirm =
            typeof body.password_confirm === 'string' ? body.password_confirm : '';

        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: 'Невірний користувач' });
        }

        const target = await UserModel.findAuthById(id);
        if (!target) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        if (!password || password.length < MIN_PASSWORD) {
            return res.status(400).json({ message: 'Пароль має бути не менше 8 символів' });
        }
        if (password.length > MAX_PASSWORD) {
            return res.status(400).json({ message: 'Пароль занадто довгий' });
        }
        if (password !== password_confirm) {
            return res.status(400).json({ message: 'Підтвердження пароля не збігається' });
        }

        const password_hash = await bcrypt.hash(
            password,
            Number(process.env.BCRYPT_SALT_ROUNDS || 10)
        );

        const ok = await UserModel.updatePasswordHashById({
            user_id: id,
            password_hash
        });
        if (!ok) {
            return res.status(400).json({ message: 'Не вдалося змінити пароль' });
        }

        return res.status(200).json({ message: 'Пароль оновлено' });
    } catch (err) {
        console.error('adminUsers resetPassword:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const updateRole = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const roleName = typeof req.body.role_name === 'string' ? req.body.role_name.trim() : '';
        const allowed = ['user', 'admin', 'warehouse_worker', 'courier'];
        if (!Number.isFinite(id) || id <= 0 || !allowed.includes(roleName)) {
            return res.status(400).json({ message: 'Невірні дані' });
        }

        const target = await UserModel.findAuthById(id);
        if (target && target.role_name === 'admin' && roleName !== 'admin') {
            const adminIds = await UserModel.listUserIdsByRole('admin');
            if (adminIds.length <= 1) {
                return res.status(400).json({ message: 'Має лишитися хоча б один адміністратор' });
            }
        }

        const ok = await UserModel.updateRoleById(id, roleName);
        if (!ok) {
            return res.status(400).json({ message: 'Не вдалося змінити роль' });
        }

        return res.status(200).json({ message: 'Роль оновлено' });
    } catch (err) {
        console.error('adminUsers updateRole:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const setBlocked = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const blocked = req.body.blocked === true || req.body.blocked === 1 || req.body.blocked === '1';
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: 'Невірний користувач' });
        }

        const current = res.locals.currentUser;
        if (current && Number(current.user_id) === id) {
            return res.status(400).json({ message: 'Не можна заблокувати себе' });
        }

        if (blocked) {
            const target = await UserModel.findAuthById(id);
            if (target && target.role_name === 'admin') {
                const adminIds = await UserModel.listUserIdsByRole('admin');
                if (adminIds.length <= 1) {
                    return res.status(400).json({ message: 'Не можна заблокувати останнього адміністратора' });
                }
            }
        }

        let reasonKey = '';
        let reasonText = '';

        if (blocked) {
            reasonKey = typeof req.body.reason_key === 'string' ? req.body.reason_key.trim() : '';
            reasonText = typeof req.body.reason_text === 'string' ? req.body.reason_text.trim() : '';

            let reasonOk = false;
            for (let i = 0; i < BLOCK_REASONS.length; i++) {
                if (BLOCK_REASONS[i].key === reasonKey) {
                    reasonOk = true;
                    break;
                }
            }
            if (!reasonOk) {
                return res.status(400).json({ message: 'Оберіть причину блокування' });
            }

            if (reasonKey === 'other' && reasonText.length < 5) {
                return res.status(400).json({ message: 'Опишіть причину блокування' });
            }
        }

        const ok = await UserModel.setBlockedById(id, blocked, reasonKey, reasonText);
        if (!ok) {
            return res.status(400).json({ message: 'Не вдалося оновити статус' });
        }

        return res.status(200).json({
            message: blocked ? 'Користувача заблоковано' : 'Користувача розблоковано'
        });
    } catch (err) {
        console.error('adminUsers setBlocked:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    listForAdmin,
    createStaff,
    resetPassword,
    updateRole,
    setBlocked
};

const UserModel = require('../models/User');
const { BLOCK_REASONS } = require('../constants/blockReasons');

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

const updateRole = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const roleName = typeof req.body.role_name === 'string' ? req.body.role_name.trim() : '';
        const allowed = ['user', 'admin', 'warehouse_worker', 'courier'];
        if (!Number.isFinite(id) || id <= 0 || !allowed.includes(roleName)) {
            return res.status(400).json({ message: 'Невірні дані' });
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
    updateRole,
    setBlocked
};

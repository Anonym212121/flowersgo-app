const UserModel = require('../models/User');
const OrderModel = require('../models/Order');
const courierAssignService = require('../services/courierAssignService');
const emailValidator = require('../validators/emailValidator');

const listCouriers = async (req, res) => {
    try {
        const couriers = await UserModel.listCouriersForAdmin();
        const onShift = couriers.filter((c) => Number(c.courier_on_shift) === 1).length;
        const unassigned = await OrderModel.countUnassignedCourier();
        return res.status(200).json({
            couriers,
            summary: {
                on_shift: onShift,
                total: couriers.length,
                unassigned_courier: unassigned
            }
        });
    } catch (err) {
        console.error('listCouriers:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const assignCourier = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const courierId = Number(req.body.courier_id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'Невірне замовлення' });
        }
        if (!Number.isFinite(courierId) || courierId <= 0) {
            return res.status(400).json({ message: 'Оберіть кур\'єра' });
        }

        const result = await courierAssignService.assignCourierByAdmin(orderId, courierId);
        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Не вдалося призначити' });
        }

        return res.status(200).json({ message: 'Кур\'єра призначено' });
    } catch (err) {
        console.error('assignCourier:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const autoAssignCourier = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'Невірне замовлення' });
        }

        const ok = await courierAssignService.tryAutoAssign(orderId);
        if (!ok) {
            return res.status(400).json({ message: 'Не вдалося авто-призначити (немає кур\'єра на зміні або замовлення не готове)' });
        }

        return res.status(200).json({ message: 'Кур\'єра авто-призначено' });
    } catch (err) {
        console.error('autoAssignCourier:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const unassignCourier = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'Невірне замовлення' });
        }

        const autoReassign = req.body && req.body.auto_reassign === true;

        const result = await courierAssignService.unassignCourierByAdmin(orderId, autoReassign);
        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Не вдалося зняти кур\'єра' });
        }

        return res.status(200).json({ message: autoReassign ? 'Кур\'єра знято, спроба авто-призначення виконана' : 'Кур\'єра знято' });
    } catch (err) {
        console.error('unassignCourier:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const updateWorkEmail = async (req, res) => {
    try {
        const courierId = Number(req.params.id);
        const raw = typeof req.body.work_email === 'string' ? req.body.work_email.trim() : '';

        if (!Number.isFinite(courierId) || courierId <= 0) {
            return res.status(400).json({ message: 'Невірний кур\'єр' });
        }

        if (raw !== '') {
            const check = emailValidator(raw);
            if (!check.ok) {
                return res.status(400).json({ message: check.message || 'Невірний робочий email' });
            }
        }

        const ok = await UserModel.updateCourierWorkEmailById(courierId, raw);
        if (!ok) {
            return res.status(400).json({ message: 'Не вдалося зберегти (перевір, що це кур\'єр)' });
        }

        return res.status(200).json({ message: raw === '' ? 'Робочий email очищено' : 'Робочий email збережено' });
    } catch (err) {
        console.error('updateWorkEmail:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const setShift = async (req, res) => {
    try {
        const courierId = Number(req.params.id);
        if (!Number.isFinite(courierId) || courierId <= 0) {
            return res.status(400).json({ message: 'Невірний кур\'єр' });
        }

        const onShift = Number(req.body.on_shift) === 1;

        if (!onShift) {
            const activeRows = await OrderModel.listForCourierStats(courierId);
            if (activeRows.length > 0) {
                return res.status(400).json({
                    message:
                        'Не можна зняти зі зміни: у кур\'єра ' +
                        activeRows.length +
                        ' активних доставок. Спочатку завершіть або перепризначте їх.'
                });
            }
        }

        const ok = await UserModel.setCourierOnShift(courierId, onShift);
        if (!ok) {
            return res.status(400).json({ message: 'Не вдалося змінити зміну (перевір роль кур\'єра)' });
        }

        let assigned = 0;
        if (onShift) {
            try {
                assigned = await courierAssignService.assignPendingReadyOrders();
            } catch (assignErr) {
                console.error('assignPendingReadyOrders:', assignErr.message);
            }
        }

        let message = onShift ? 'Зміну кур\'єра увімкнено' : 'Зміну кур\'єра вимкнено';
        if (onShift && assigned > 0) {
            message += '. Авто-призначено замовлень: ' + assigned;
        }

        return res.status(200).json({ message, assigned });
    } catch (err) {
        console.error('setShift:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const autoAssignAllReady = async (req, res) => {
    try {
        const assigned = await courierAssignService.assignPendingReadyOrders();
        const message =
            assigned > 0
                ? 'Авто-призначено замовлень: ' + assigned
                : 'Немає готових замовлень або кур\'єрів на зміні';
        return res.status(200).json({ message, assigned });
    } catch (err) {
        console.error('autoAssignAllReady:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    listCouriers,
    assignCourier,
    autoAssignCourier,
    unassignCourier,
    updateWorkEmail,
    setShift,
    autoAssignAllReady
};

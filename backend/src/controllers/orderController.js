const OrderModel = require('../models/Order');

const getUserId = (res) => {
    const raw = res.locals.currentUser && res.locals.currentUser.user_id;
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
        return null;
    }
    return userId;
};

const wantsJson = (req) => {
    const accept = req.headers.accept || '';
    return accept.includes('application/json');
};

const parseItemsFromBody = (raw) => {
    if (raw == null || raw === '') {
        return [];
    }
    if (Array.isArray(raw)) {
        return raw;
    }
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }
    return [];
};

const createOrder = async (req, res) => {
    try {
        const userId = getUserId(res);
        if (!userId) {
            if (wantsJson(req)) {
                return res.status(401).json({ message: 'Потрібно увійти' });
            }
            return res.redirect('/login');
        }

        const total_price = Number(req.body.total_price);
        if (!Number.isFinite(total_price) || total_price < 0) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Невірна сума замовлення' });
            }
            return res.status(400).send('Невірна сума замовлення');
        }

        const items = parseItemsFromBody(req.body.items);
        if (items.length === 0) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Додай хоча б один товар до замовлення' });
            }
            return res.status(400).send('Додай хоча б один товар до замовлення');
        }

        const first = typeof req.body.customer_first_name === 'string' ? req.body.customer_first_name.trim() : '';
        const last = typeof req.body.customer_last_name === 'string' ? req.body.customer_last_name.trim() : '';
        const phone = typeof req.body.customer_phone === 'string' ? req.body.customer_phone.trim() : '';
        const emailOpt = typeof req.body.customer_email === 'string' ? req.body.customer_email.trim() : '';

        if (first || last || phone) {
            if (!first || !last || !phone) {
                if (wantsJson(req)) {
                    return res.status(400).json({ message: "Заповни ім'я, прізвище та телефон" });
                }
                return res.status(400).send("Заповни ім'я, прізвище та телефон");
            }
        }

        const delivery_place =
            typeof req.body.delivery_place === 'string' ? req.body.delivery_place.trim() : '';

        if (first && last && phone && !delivery_place) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Вкажи адресу доставки' });
            }
            return res.status(400).send('Вкажи адресу доставки');
        }

        let delivery_datetime = null;
        const rawDt = req.body.delivery_datetime;
        if (typeof rawDt === 'string' && rawDt.trim() !== '') {
            let d = rawDt.trim().replace('T', ' ');
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(d)) {
                d = `${d}:00`;
            }
            delivery_datetime = d;
        }

        const recipient_mode = req.body.recipient_mode === 'other' ? 'other' : 'self';
        const recFirst =
            typeof req.body.recipient_first_name === 'string' ? req.body.recipient_first_name.trim() : '';
        const recLast =
            typeof req.body.recipient_last_name === 'string' ? req.body.recipient_last_name.trim() : '';
        const recPhone =
            typeof req.body.recipient_phone === 'string' ? req.body.recipient_phone.trim() : '';
        const recNote =
            typeof req.body.recipient_note === 'string' ? req.body.recipient_note.trim() : '';

        if (first && last && phone && recipient_mode === 'other') {
            if (!recFirst || !recLast || !recPhone) {
                if (wantsJson(req)) {
                    return res.status(400).json({ message: "Заповни ім'я, прізвище та телефон одержувача" });
                }
                return res.status(400).send("Заповни ім'я, прізвище та телефон одержувача");
            }
        }

        let delivery_address = '—';
        if (first && last && phone) {
            const lineName = `${first} ${last}`.replace(/\s+/g, ' ').trim();
            const parts = [lineName, `Тел: ${phone}`];
            if (emailOpt) {
                parts.push(`Email: ${emailOpt}`);
            }
            if (recipient_mode === 'other' && recFirst && recLast && recPhone) {
                const recLineName = `${recFirst} ${recLast}`.replace(/\s+/g, ' ').trim();
                parts.push('');
                parts.push('Одержувач:');
                parts.push(recLineName);
                parts.push(`Тел: ${recPhone}`);
                if (recNote) {
                    parts.push(recNote);
                }
            }
            if (delivery_place) {
                parts.push('');
                parts.push('Адреса доставки:');
                parts.push(delivery_place);
            }
            delivery_address = parts.join('\n');
        }

        const orderId = await OrderModel.createWithTransaction({
            user_id: userId,
            delivery_address,
            delivery_datetime,
            total_price,
            items
        });

        if (!orderId) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Не вдалося оформити замовлення' });
            }
            return res.status(400).send('Не вдалося оформити замовлення');
        }

        if (wantsJson(req)) {
            return res.status(200).json({ ok: true, order_id: orderId });
        }
        return res.redirect('/cabinet');
    } catch (err) {
        console.error('createOrder:', err.message);
        if (wantsJson(req)) {
            return res.status(500).json({ message: 'помилка' });
        }
        return res.status(500).send('помилка');
    }
};

const updateOrderStatusForWarehouse = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const statusId = Number(req.body.status_id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.status(400).send('Невірне замовлення');
        }
        if (!Number.isFinite(statusId) || statusId <= 0) {
            return res.status(400).send('Невірний статус');
        }

        const allowedStatuses = await OrderModel.listStatusesForWarehouse();
        const allowedStatusIds = allowedStatuses.map((row) => Number(row.id));
        if (!allowedStatusIds.includes(statusId)) {
            return res.status(400).send('Статус недоступний');
        }

        const ok = await OrderModel.updateStatusByWarehouse(orderId, statusId);
        if (!ok) {
            return res.status(400).send('Не вдалося оновити статус');
        }

        return res.redirect('/warehouse/orders');
    } catch (err) {
        console.error('updateOrderStatusForWarehouse:', err.message);
        return res.status(500).send('помилка');
    }
};

module.exports = {};
module.exports.createOrder = createOrder;
module.exports.updateOrderStatusForWarehouse = updateOrderStatusForWarehouse;

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

        let delivery_address = '—';
        if (first && last && phone) {
            const lineName = `${first} ${last}`.replace(/\s+/g, ' ').trim();
            const parts = [lineName, `Тел: ${phone}`];
            if (emailOpt) {
                parts.push(`Email: ${emailOpt}`);
            }
            delivery_address = parts.join('\n');
        }

        const orderId = await OrderModel.createWithTransaction({
            user_id: userId,
            delivery_address,
            delivery_datetime: null,
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

module.exports = {};
module.exports.createOrder = createOrder;

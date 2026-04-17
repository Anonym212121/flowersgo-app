const db = require('../config/db');

const getPendingStatusId = async () => {
    const [rows] = await db.execute(
        'SELECT id FROM statuses WHERE status_name = ? LIMIT 1',
        ['pending']
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return Number(rows[0].id) || null;
};

const normalizeItems = (items) => {
    if (!Array.isArray(items)) {
        return [];
    }

    const cleaned = [];
    for (const item of items) {
        const product_id = Number(item && item.product_id);
        const quantity = Number(item && item.quantity);
        const unit_price = Number(item && item.unit_price);

        if (!Number.isFinite(product_id) || product_id <= 0) {
            continue;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            continue;
        }
        if (!Number.isFinite(unit_price) || unit_price < 0) {
            continue;
        }

        cleaned.push({ product_id, quantity, unit_price });
    }

    return cleaned;
};

module.exports = {
    getPendingStatusId,
    normalizeItems
};

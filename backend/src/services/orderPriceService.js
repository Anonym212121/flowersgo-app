const db = require('../config/db');
const { mergeCartItems } = require('../utils/cartItemMerge');

const roundMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.round(n * 100) / 100;
};

const mergeOrderItems = (rawItems) => {
    return mergeCartItems(rawItems);
};

const resolveItemsPrices = async (rawItems) => {
    const merged = mergeOrderItems(rawItems);
    if (merged.length === 0) {
        return { ok: false, message: 'Немає товарів у замовленні' };
    }

    const resolved = [];

    for (let i = 0; i < merged.length; i += 1) {
        const item = merged[i];
        const product_id = Number(item.product_id);
        const quantity = Number(item.quantity);
        let variantId = item.color_variant_id;

        const [prows] = await db.execute(
            `SELECT id, name, sale_price, is_active
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [product_id]
        );

        if (!prows || !prows[0]) {
            return { ok: false, message: 'Один із товарів більше недоступний' };
        }

        if (Number(prows[0].is_active) !== 1) {
            return { ok: false, message: 'Товар «' + prows[0].name + '» більше недоступний' };
        }

        if (variantId) {
            const [vrows] = await db.execute(
                `SELECT id FROM product_color_variants WHERE id = ? AND product_id = ? LIMIT 1`,
                [variantId, product_id]
            );
            if (!vrows || !vrows[0]) {
                return { ok: false, message: 'Один із варіантів товару більше недоступний' };
            }
        }

        const unit_price = roundMoney(prows[0].sale_price || 0);
        if (unit_price < 0) {
            return { ok: false, message: 'Невірна ціна товару «' + prows[0].name + '»' };
        }

        resolved.push({
            product_id,
            color_variant_id: variantId,
            quantity,
            unit_price
        });
    }

    if (resolved.length === 0) {
        return { ok: false, message: 'Додай хоча б один товар до замовлення' };
    }

    let itemsTotal = 0;
    for (let j = 0; j < resolved.length; j++) {
        itemsTotal += resolved[j].quantity * resolved[j].unit_price;
    }

    return {
        ok: true,
        items: resolved,
        itemsTotal: roundMoney(itemsTotal)
    };
};

module.exports = {
    roundMoney,
    resolveItemsPrices
};

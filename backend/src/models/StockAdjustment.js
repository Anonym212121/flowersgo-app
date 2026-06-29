const db = require('../config/db');

const insert = async (payload, conn) => {
    const executor = conn || db;
    const pid = Number(payload.product_id);
    const uid = Number(payload.user_id);
    const delta = Math.floor(Number(payload.delta_qty));
    const before = Math.floor(Number(payload.stock_before));
    const after = Math.floor(Number(payload.stock_after));

    if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(uid) || uid <= 0) {
        return false;
    }
    if (!Number.isFinite(delta) || delta === 0) {
        return false;
    }

    let variantId = null;
    if (payload.color_variant_id != null && payload.color_variant_id !== '') {
        const vid = Number(payload.color_variant_id);
        if (Number.isFinite(vid) && vid > 0) {
            variantId = vid;
        }
    }

    const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 255) : null;

    const [result] = await executor.execute(
        `INSERT INTO stock_adjustments
            (product_id, color_variant_id, user_id, delta_qty, stock_before, stock_after, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pid, variantId, uid, delta, before, after, note || null]
    );

    return result && result.affectedRows > 0;
};

const listRecent = async (limit) => {
    const lim = Number(limit);
    const safeLimit = Number.isFinite(lim) && lim > 0 && lim <= 50 ? lim : 15;

    const [rows] = await db.execute(
        `SELECT a.id,
                a.product_id,
                a.color_variant_id,
                a.delta_qty,
                a.stock_before,
                a.stock_after,
                a.note,
                a.createdAt,
                p.name AS product_name,
                v.flower_color,
                u.first_name,
                u.last_name
         FROM stock_adjustments a
         INNER JOIN products p ON p.id = a.product_id
         LEFT JOIN product_color_variants v ON v.id = a.color_variant_id
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.id DESC
         LIMIT ${safeLimit}`
    );

    return rows || [];
};

module.exports = {
    insert,
    listRecent
};

const db = require('../config/db');

let cache = null;

const envMinStems = () => {
    const raw = Number(process.env.CONSTRUCTOR_MIN_STEMS);
    if (Number.isFinite(raw) && raw > 0) {
        return Math.floor(raw);
    }
    return 5;
};

const envConstructorEnabled = () => (process.env.CONSTRUCTOR_ENABLED === '0' ? 0 : 1);

const envPhone = (index) => {
    const number = process.env['SUPPORT_PHONE_' + index];
    const label = process.env['SUPPORT_PHONE_' + index + '_LABEL'];
    return {
        label: label && String(label).trim() ? String(label).trim() : '',
        number: number && String(number).trim() ? String(number).trim() : ''
    };
};

const emptyRow = () => {
    const p1 = envPhone(1);
    const p2 = envPhone(2);
    const p3 = envPhone(3);
    if (!p1.number && !p2.number && !p3.number) {
        p1.number = '+380671234567';
        p1.label = 'Магазин FlowersGo';
    }
    return {
        id: 1,
        constructor_enabled: envConstructorEnabled(),
        constructor_min_stems: envMinStems(),
        support_phone_1: p1.number,
        support_phone_1_label: p1.label,
        support_phone_2: p2.number,
        support_phone_2_label: p2.label,
        support_phone_3: p3.number,
        support_phone_3_label: p3.label,
        support_welcome: ''
    };
};

const setCache = (row) => {
    cache = row || null;
};

const getCached = () => cache;

const get = async () => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM shop_settings WHERE id = 1 LIMIT 1'
        );
        if (!rows || rows.length === 0) {
            const fallback = emptyRow();
            setCache(fallback);
            return fallback;
        }
        setCache(rows[0]);
        return rows[0];
    } catch (err) {
        console.error('ShopSettings.get:', err.message);
        const fallback = emptyRow();
        setCache(fallback);
        return fallback;
    }
};

const warmCache = async () => {
    await get();
};

const save = async (payload) => {
    const row = payload || {};

    const constructor_enabled = Number(row.constructor_enabled) === 1 ? 1 : 0;
    let constructor_min_stems = Number(row.constructor_min_stems);
    if (!Number.isFinite(constructor_min_stems) || constructor_min_stems < 1) {
        return false;
    }
    constructor_min_stems = Math.min(99, Math.floor(constructor_min_stems));

    const phone1 = typeof row.support_phone_1 === 'string' ? row.support_phone_1.trim() : '';
    const phone1Label = typeof row.support_phone_1_label === 'string' ? row.support_phone_1_label.trim() : '';
    const phone2 = typeof row.support_phone_2 === 'string' ? row.support_phone_2.trim() : '';
    const phone2Label = typeof row.support_phone_2_label === 'string' ? row.support_phone_2_label.trim() : '';
    const phone3 = typeof row.support_phone_3 === 'string' ? row.support_phone_3.trim() : '';
    const phone3Label = typeof row.support_phone_3_label === 'string' ? row.support_phone_3_label.trim() : '';
    const welcome = typeof row.support_welcome === 'string' ? row.support_welcome.trim() : '';

    const [result] = await db.execute(
        `INSERT INTO shop_settings (
            id, constructor_enabled, constructor_min_stems,
            support_phone_1, support_phone_1_label,
            support_phone_2, support_phone_2_label,
            support_phone_3, support_phone_3_label,
            support_welcome
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            constructor_enabled = VALUES(constructor_enabled),
            constructor_min_stems = VALUES(constructor_min_stems),
            support_phone_1 = VALUES(support_phone_1),
            support_phone_1_label = VALUES(support_phone_1_label),
            support_phone_2 = VALUES(support_phone_2),
            support_phone_2_label = VALUES(support_phone_2_label),
            support_phone_3 = VALUES(support_phone_3),
            support_phone_3_label = VALUES(support_phone_3_label),
            support_welcome = VALUES(support_welcome)`,
        [
            constructor_enabled,
            constructor_min_stems,
            phone1 || null,
            phone1Label || null,
            phone2 || null,
            phone2Label || null,
            phone3 || null,
            phone3Label || null,
            welcome || null
        ]
    );

    if (!result || result.affectedRows < 1) {
        return false;
    }

    await get();
    return true;
};

const toPublic = (row) => {
    const data = row || emptyRow();
    return {
        constructor_enabled: Number(data.constructor_enabled) === 1 ? 1 : 0,
        constructor_min_stems: Number(data.constructor_min_stems) > 0
            ? Number(data.constructor_min_stems)
            : envMinStems(),
        support_phone_1: data.support_phone_1 || '',
        support_phone_1_label: data.support_phone_1_label || '',
        support_phone_2: data.support_phone_2 || '',
        support_phone_2_label: data.support_phone_2_label || '',
        support_phone_3: data.support_phone_3 || '',
        support_phone_3_label: data.support_phone_3_label || '',
        support_welcome: data.support_welcome || ''
    };
};

module.exports = {
    get,
    getCached,
    warmCache,
    save,
    toPublic,
    emptyRow
};

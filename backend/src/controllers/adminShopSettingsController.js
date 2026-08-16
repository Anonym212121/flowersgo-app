const ShopSettings = require('../models/ShopSettings');
const phoneValidator = require('../validators/phoneValidator');
const sanitizeUserText = require('../utils/sanitizeUserText');

const normalizePhone = (raw) => {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) {
        return { ok: true, phone: '' };
    }
    return phoneValidator(text);
};

const normalizeLabel = (raw) => {
    const text = typeof raw === 'string' ? raw.trim() : '';
    return text.slice(0, 80);
};

const getSettings = async (req, res) => {
    try {
        const row = await ShopSettings.get();
        return res.status(200).json({ settings: ShopSettings.toPublic(row) });
    } catch (err) {
        console.error('adminShopSettings get:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const saveSettings = async (req, res) => {
    try {
        const body = req.body || {};
        const constructor_enabled =
            body.constructor_enabled === true ||
            body.constructor_enabled === 1 ||
            body.constructor_enabled === '1'
                ? 1
                : 0;

        const phone1 = normalizePhone(body.support_phone_1);
        const phone2 = normalizePhone(body.support_phone_2);
        const phone3 = normalizePhone(body.support_phone_3);
        if (!phone1.ok) {
            return res.status(400).json({ message: 'Телефон 1: ' + phone1.message });
        }
        if (!phone2.ok) {
            return res.status(400).json({ message: 'Телефон 2: ' + phone2.message });
        }
        if (!phone3.ok) {
            return res.status(400).json({ message: 'Телефон 3: ' + phone3.message });
        }

        const ok = await ShopSettings.save({
            constructor_enabled,
            constructor_min_stems: body.constructor_min_stems,
            support_phone_1: phone1.phone,
            support_phone_1_label: normalizeLabel(body.support_phone_1_label),
            support_phone_2: phone2.phone,
            support_phone_2_label: normalizeLabel(body.support_phone_2_label),
            support_phone_3: phone3.phone,
            support_phone_3_label: normalizeLabel(body.support_phone_3_label),
            support_welcome: sanitizeUserText(body.support_welcome, 1000)
        });

        if (!ok) {
            return res.status(400).json({ message: 'Невірні налаштування магазину' });
        }

        const row = await ShopSettings.get();
        return res.status(200).json({
            message: 'Налаштування магазину збережено',
            settings: ShopSettings.toPublic(row)
        });
    } catch (err) {
        console.error('adminShopSettings save:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    getSettings,
    saveSettings
};

const ShopSettings = require('../models/ShopSettings');

const parseMinStems = () => {
    const raw = Number(process.env.CONSTRUCTOR_MIN_STEMS);
    if (Number.isFinite(raw) && raw > 0) {
        return Math.floor(raw);
    }
    return 5;
};

const isEnabledFromEnv = () => process.env.CONSTRUCTOR_ENABLED !== '0';

const getSettings = () => {
    const row = ShopSettings.getCached();
    if (row) {
        const minRaw = Number(row.constructor_min_stems);
        return {
            min_stems: Number.isFinite(minRaw) && minRaw > 0 ? Math.floor(minRaw) : parseMinStems(),
            is_enabled: Number(row.constructor_enabled) === 1 ? 1 : 0
        };
    }

    return {
        min_stems: parseMinStems(),
        is_enabled: isEnabledFromEnv() ? 1 : 0
    };
};

const isEnabled = () => Number(getSettings().is_enabled) === 1;

module.exports = {
    getSettings,
    isEnabled,
    parseMinStems
};

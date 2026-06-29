const parseMinStems = () => {
    const raw = Number(process.env.CONSTRUCTOR_MIN_STEMS);
    if (Number.isFinite(raw) && raw > 0) {
        return Math.floor(raw);
    }
    return 5;
};

const isEnabled = () => process.env.CONSTRUCTOR_ENABLED !== '0';

const getSettings = () => ({
    min_stems: parseMinStems(),
    is_enabled: isEnabled() ? 1 : 0
});

module.exports = {
    getSettings,
    isEnabled,
    parseMinStems
};

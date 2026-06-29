const db = require('../config/db');

const buildMapsLink = (addressText) => {
    const text = typeof addressText === 'string' ? addressText.trim() : '';
    if (!text) {
        return '';
    }
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(text);
};

module.exports = {
    buildMapsLink
};

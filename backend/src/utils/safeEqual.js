const crypto = require('crypto');

const safeEqual = (left, right) => {
    const a = Buffer.from(String(left == null ? '' : left), 'utf8');
    const b = Buffer.from(String(right == null ? '' : right), 'utf8');
    if (a.length === 0 || a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(a, b);
};

module.exports = safeEqual;

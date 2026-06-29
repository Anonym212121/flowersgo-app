const crypto = require('crypto');

const secret = process.env.JWT_SECRET || 'payment-token-secret';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const signPayload = (oid, uid, expMs) => {
    return crypto.createHmac('sha256', secret).update(oid + ':' + uid + ':' + expMs).digest('hex').slice(0, 20);
};

const makeForOrder = (orderId, userId) => {
    const oid = Number(orderId);
    let uid = Number(userId);
    if (!uid || uid < 0) {
        uid = 0;
    }
    if (!oid || oid <= 0) {
        return '';
    }

    const expMs = Date.now() + TOKEN_TTL_MS;
    const sig = signPayload(oid, uid, expMs);
    return oid + '.' + uid + '.' + expMs + '.' + sig;
};

const verifyLegacy = (parts, oid) => {
    const tokenOrderId = Number(parts[0]);
    const tokenUserId = Number(parts[1]);
    if (tokenOrderId !== oid || tokenUserId < 0) {
        return null;
    }

    const legacySig = crypto
        .createHmac('sha256', secret)
        .update(tokenOrderId + ':' + tokenUserId)
        .digest('hex')
        .slice(0, 20);

    if (legacySig !== parts[2]) {
        return null;
    }

    return { orderId: tokenOrderId, userId: tokenUserId };
};

const verify = (token, orderId) => {
    const text = typeof token === 'string' ? token.trim() : '';
    const oid = Number(orderId);
    if (!text || !oid || oid <= 0) {
        return null;
    }

    const parts = text.split('.');
    if (parts.length === 3) {
        return verifyLegacy(parts, oid);
    }

    if (parts.length !== 4) {
        return null;
    }

    const tokenOrderId = Number(parts[0]);
    const tokenUserId = Number(parts[1]);
    const expMs = Number(parts[2]);
    if (tokenOrderId !== oid || tokenUserId < 0 || !Number.isFinite(expMs) || expMs <= 0) {
        return null;
    }

    if (Date.now() > expMs) {
        return null;
    }

    const expectedSig = signPayload(tokenOrderId, tokenUserId, expMs);
    if (expectedSig !== parts[3]) {
        return null;
    }

    return { orderId: tokenOrderId, userId: tokenUserId };
};

module.exports = { makeForOrder, verify };

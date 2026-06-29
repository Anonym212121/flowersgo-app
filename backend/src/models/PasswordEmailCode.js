const crypto = require('crypto');
const db = require('../config/db');

let tableEnsured = false;

const ensureTable = async () => {
    if (tableEnsured) {
        return;
    }

    await db.execute(
        `CREATE TABLE IF NOT EXISTS password_email_codes (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            email VARCHAR(255) NOT NULL,
            code_hash VARCHAR(128) NOT NULL,
            new_password_hash VARCHAR(255) NOT NULL,
            attempts_left INT NOT NULL DEFAULT 5,
            expires_at DATETIME NOT NULL,
            consumed_at DATETIME NULL,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_password_email_user (user_id),
            INDEX idx_password_email_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    tableEnsured = true;
};

const hashCode = (code) => {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
};

const invalidateActiveCodes = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return;
    }

    await ensureTable();
    await db.execute(
        `UPDATE password_email_codes
         SET consumed_at = NOW()
         WHERE user_id = ?
           AND consumed_at IS NULL
           AND expires_at > NOW()`,
        [uid]
    );
};

const createCode = async ({ user_id, email, code, new_password_hash, expiresInMinutes = 10 }) => {
    const uid = Number(user_id);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }
    if (!email || typeof email !== 'string') {
        return false;
    }
    if (!new_password_hash || typeof new_password_hash !== 'string') {
        return false;
    }

    await ensureTable();
    await invalidateActiveCodes(uid);

    const [result] = await db.execute(
        `INSERT INTO password_email_codes (user_id, email, code_hash, new_password_hash, attempts_left, expires_at)
         VALUES (?, ?, ?, ?, 5, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [uid, email.trim().toLowerCase(), hashCode(code), new_password_hash, Number(expiresInMinutes)]
    );

    const insertedId = Number(result && result.insertId);
    if (!Number.isFinite(insertedId) || insertedId <= 0) {
        return null;
    }

    return insertedId;
};

const getActiveCode = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return null;
    }

    await ensureTable();
    const [rows] = await db.execute(
        `SELECT id, user_id, email, code_hash, new_password_hash, attempts_left, expires_at
         FROM password_email_codes
         WHERE user_id = ?
           AND consumed_at IS NULL
           AND expires_at > NOW()
         ORDER BY id DESC
         LIMIT 1`,
        [uid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const decreaseAttempts = async (id) => {
    const sid = Number(id);
    if (!Number.isFinite(sid) || sid <= 0) {
        return;
    }
    await ensureTable();
    await db.execute(
        `UPDATE password_email_codes
         SET attempts_left = GREATEST(attempts_left - 1, 0)
         WHERE id = ?`,
        [sid]
    );
};

const consumeCode = async (id) => {
    const sid = Number(id);
    if (!Number.isFinite(sid) || sid <= 0) {
        return false;
    }
    await ensureTable();
    const [result] = await db.execute(
        `UPDATE password_email_codes
         SET consumed_at = NOW()
         WHERE id = ?
           AND consumed_at IS NULL`,
        [sid]
    );
    return result && result.affectedRows > 0;
};

module.exports = {
    hashCode,
    createCode,
    getActiveCode,
    decreaseAttempts,
    consumeCode
};

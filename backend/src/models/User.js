const db = require('../config/db');

const getDefaultRoleId = async () => {
    const roleNames = ['user', 'client', 'customer'];

    for (const roleName of roleNames) {
        const [rows] = await db.execute(
            'SELECT id FROM roles WHERE role_name = ? LIMIT 1',
            [roleName]
        );

        if (rows && rows.length > 0) {
            return rows[0].id;
        }
    }

    const [roles] = await db.execute(
        'SELECT id FROM roles ORDER BY id ASC LIMIT 1'
    );

    if (!roles || roles.length === 0) {
        throw new Error('Ролі не знайдено в базі');
    }

    return roles[0].id;
};

const createUser = async ({ role_id, first_name, last_name, email, password_hash, phone }) => {
    try {
        const [result] = await db.execute(
            `INSERT INTO users
            (role_id, first_name, last_name, email, password_hash, phone)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [role_id, first_name, last_name, email, password_hash, phone || null]
        );

        const [rows] = await db.execute(
            `SELECT
                u.id, u.role_id, r.role_name, u.first_name, u.last_name, u.email,
                u.phone, u.avatar_url, u.loyalty_points, u.createdAt, u.updatedAt
             FROM users u
             INNER JOIN roles r ON u.role_id = r.id
             WHERE u.id = ?
             LIMIT 1`,
            [result.insertId]
        );

        return rows[0];
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            throw new Error('Email вже зареєстрований');
        }

        throw err;
    }
};

const findUserByEmailWithRole = async (email) => {
    const [rows] = await db.execute(
        `SELECT
            u.id, u.role_id, r.role_name,
            u.first_name, u.last_name, u.email, u.password_hash, u.google_id,
            u.phone, u.avatar_url, u.loyalty_points,
            COALESCE(u.is_blocked, 0) AS is_blocked,
            u.block_reason_key,
            u.block_reason_text
         FROM users u
         INNER JOIN roles r ON u.role_id = r.id
         WHERE u.email = ?
         LIMIT 1`,
        [email]
    );

    return rows[0] || null;
};

const findByGoogleId = async (googleId) => {
    const gid = typeof googleId === 'string' ? googleId.trim() : '';
    if (!gid) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT
            u.id, u.role_id, r.role_name,
            u.first_name, u.last_name, u.email, u.password_hash, u.google_id,
            u.phone, u.avatar_url, u.loyalty_points,
            COALESCE(u.is_blocked, 0) AS is_blocked,
            u.block_reason_key,
            u.block_reason_text
         FROM users u
         INNER JOIN roles r ON u.role_id = r.id
         WHERE u.google_id = ?
         LIMIT 1`,
        [gid]
    );

    return rows[0] || null;
};

const createGoogleUser = async ({ role_id, google_id, first_name, last_name, email, avatar_url }) => {
    try {
        const [result] = await db.execute(
            `INSERT INTO users
            (role_id, first_name, last_name, email, password_hash, google_id, avatar_url, phone)
            VALUES (?, ?, ?, ?, NULL, ?, ?, NULL)`,
            [role_id, first_name, last_name, email, google_id, avatar_url || null]
        );

        const [rows] = await db.execute(
            `SELECT
                u.id, u.role_id, r.role_name, u.first_name, u.last_name, u.email,
                u.phone, u.avatar_url, u.loyalty_points, u.createdAt, u.updatedAt
             FROM users u
             INNER JOIN roles r ON u.role_id = r.id
             WHERE u.id = ?
             LIMIT 1`,
            [result.insertId]
        );

        return rows[0];
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            throw new Error('Email вже зареєстрований');
        }
        throw err;
    }
};

const linkGoogleId = async (userId, googleId) => {
    const uid = Number(userId);
    const gid = typeof googleId === 'string' ? googleId.trim() : '';
    if (!Number.isFinite(uid) || uid <= 0 || !gid) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE users
         SET google_id = ?
         WHERE id = ?
           AND (google_id IS NULL OR google_id = '')`,
        [gid, uid]
    );

    return result && result.affectedRows > 0;
};

const getUserid = async (id) => {
    const [rows] = await db.execute(
        `SELECT
            u.id, u.role_id, r.role_name,
            u.first_name, u.last_name, u.email,
            u.phone, u.avatar_url, u.loyalty_points,
            u.courier_work_email,
            u.saved_delivery_street, u.saved_delivery_house, u.saved_delivery_apartment
         FROM users u
         INNER JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?
         LIMIT 1`,
        [id]
    );

    return rows[0] || null;
};

const findByEmailExceptUserId = async (email, excludeUserId) => {
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    const uid = Number(excludeUserId);
    if (!normalizedEmail || !Number.isFinite(uid) || uid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT id
         FROM users
         WHERE email = ? AND id <> ?
         LIMIT 1`,
        [normalizedEmail, uid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const updateProfileById = async ({
    user_id,
    first_name,
    last_name,
    email,
    phone,
    saved_delivery_street,
    saved_delivery_house,
    saved_delivery_apartment
}) => {
    const uid = Number(user_id);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE users
         SET first_name = ?, last_name = ?, email = ?, phone = ?,
             saved_delivery_street = ?, saved_delivery_house = ?, saved_delivery_apartment = ?
         WHERE id = ?`,
        [
            first_name,
            last_name,
            email,
            phone || null,
            saved_delivery_street || null,
            saved_delivery_house || null,
            saved_delivery_apartment || null,
            uid
        ]
    );

    return result && result.affectedRows > 0;
};

const updateAvatarUrlById = async ({ user_id, avatar_url }) => {
    const uid = Number(user_id);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE users
         SET avatar_url = ?
         WHERE id = ?`,
        [avatar_url || null, uid]
    );

    return result && result.affectedRows > 0;
};

const updatePasswordHashById = async ({ user_id, password_hash }) => {
    const uid = Number(user_id);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }
    if (!password_hash || typeof password_hash !== 'string') {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE users
         SET password_hash = ?
         WHERE id = ?`,
        [password_hash, uid]
    );

    return result && result.affectedRows > 0;
};

const getRoleIdByName = async (roleName) => {
    const name = typeof roleName === 'string' ? roleName.trim() : '';
    if (!name) {
        return null;
    }

    const [rows] = await db.execute(
        'SELECT id FROM roles WHERE role_name = ? LIMIT 1',
        [name]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return Number(rows[0].id) || null;
};

const listForAdmin = async (search) => {
    let sql = `
        SELECT u.id,
               u.first_name,
               u.last_name,
               u.email,
               u.phone,
               u.saved_delivery_street,
               u.saved_delivery_house,
               u.saved_delivery_apartment,
               COALESCE(u.is_blocked, 0) AS is_blocked,
               u.block_reason_key,
               u.block_reason_text,
               u.createdAt,
               r.id AS role_id,
               r.role_name
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
    `;

    const params = [];
    const q = typeof search === 'string' ? search.trim() : '';
    if (q !== '') {
        const like = `%${q}%`;
        sql += ` WHERE u.email LIKE ? OR u.phone LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?`;
        params.push(like, like, like, like);
    }

    sql += ' ORDER BY u.id DESC LIMIT 200';

    const [rows] = await db.execute(sql, params);
    return rows;
};

const updateRoleById = async (userId, roleName) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const roleId = await getRoleIdByName(roleName);
    if (!roleId) {
        return false;
    }

    const [result] = await db.execute(
        'UPDATE users SET role_id = ? WHERE id = ?',
        [roleId, uid]
    );

    return result && result.affectedRows > 0;
};

const setBlockedById = async (userId, blocked, reasonKey, reasonText) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    if (blocked) {
        const key = typeof reasonKey === 'string' ? reasonKey.trim() : '';
        const text = typeof reasonText === 'string' ? reasonText.trim().slice(0, 500) : '';
        const [result] = await db.execute(
            `UPDATE users
             SET is_blocked = 1, block_reason_key = ?, block_reason_text = ?
             WHERE id = ?`,
            [key, text || null, uid]
        );
        return result && result.affectedRows > 0;
    }

    const [result] = await db.execute(
        `UPDATE users
         SET is_blocked = 0, block_reason_key = NULL, block_reason_text = NULL
         WHERE id = ?`,
        [uid]
    );

    return result && result.affectedRows > 0;
};

const setCourierOnShift = async (userId, onShift) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const value = onShift ? 1 : 0;
    const [result] = await db.execute(
        `UPDATE users u
         INNER JOIN roles r ON u.role_id = r.id
         SET u.courier_on_shift = ?
         WHERE u.id = ? AND r.role_name = 'courier'`,
        [value, uid]
    );

    return result && result.affectedRows > 0;
};

const getCourierShift = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const [rows] = await db.execute(
        `SELECT COALESCE(u.courier_on_shift, 0) AS courier_on_shift
         FROM users u
         INNER JOIN roles r ON u.role_id = r.id
         WHERE u.id = ? AND r.role_name = 'courier'
         LIMIT 1`,
        [uid]
    );

    if (!rows || rows.length === 0) {
        return false;
    }

    return Number(rows[0].courier_on_shift) === 1;
};

const listCouriersOnShiftWithLoad = async () => {
    const [rows] = await db.execute(
        `SELECT u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.courier_work_email,
                COALESCE(u.courier_on_shift, 0) AS courier_on_shift,
                (
                    SELECT COUNT(*)
                    FROM orders o
                    INNER JOIN statuses s ON o.status_id = s.id
                    WHERE o.courier_id = u.id
                      AND s.status_name = 'shipped'
                      AND o.admin_approved = 1
                ) AS delivering_now,
                (
                    SELECT COUNT(*)
                    FROM orders o
                    INNER JOIN statuses s ON o.status_id = s.id
                    WHERE o.courier_id = u.id
                      AND s.status_name IN ('processing', 'ready_for_pickup')
                      AND o.admin_approved = 1
                ) AS queue_at_warehouse,
                (
                    SELECT COUNT(*)
                    FROM orders o
                    INNER JOIN statuses s ON o.status_id = s.id
                    WHERE o.courier_id = u.id
                      AND s.status_name IN ('processing', 'ready_for_pickup', 'shipped')
                      AND o.admin_approved = 1
                ) AS active_orders
         FROM users u
         INNER JOIN roles r ON u.role_id = r.id
         WHERE r.role_name = 'courier'
           AND COALESCE(u.is_blocked, 0) = 0
           AND COALESCE(u.courier_on_shift, 0) = 1
         ORDER BY active_orders ASC, u.id ASC`
    );

    return rows || [];
};

const listCouriersForAdmin = async () => {
    const [rows] = await db.execute(
        `SELECT u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.courier_work_email,
                COALESCE(u.courier_on_shift, 0) AS courier_on_shift,
                (
                    SELECT COUNT(*)
                    FROM orders o
                    INNER JOIN statuses s ON o.status_id = s.id
                    WHERE o.courier_id = u.id
                      AND s.status_name = 'shipped'
                      AND o.admin_approved = 1
                ) AS delivering_now,
                (
                    SELECT COUNT(*)
                    FROM orders o
                    INNER JOIN statuses s ON o.status_id = s.id
                    WHERE o.courier_id = u.id
                      AND s.status_name IN ('processing', 'ready_for_pickup')
                      AND o.admin_approved = 1
                ) AS queue_at_warehouse,
                (
                    SELECT COUNT(*)
                    FROM orders o
                    INNER JOIN statuses s ON o.status_id = s.id
                    WHERE o.courier_id = u.id
                      AND s.status_name IN ('processing', 'ready_for_pickup', 'shipped')
                      AND o.admin_approved = 1
                ) AS active_orders
         FROM users u
         INNER JOIN roles r ON u.role_id = r.id
         WHERE r.role_name = 'courier'
           AND COALESCE(u.is_blocked, 0) = 0
         ORDER BY u.courier_on_shift DESC, active_orders ASC, u.id ASC`
    );

    return rows || [];
};

const updateCourierWorkEmailById = async (userId, workEmail) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    let value = null;
    if (typeof workEmail === 'string') {
        const trimmed = workEmail.trim();
        if (trimmed !== '') {
            value = trimmed.toLowerCase();
        }
    }

    const [result] = await db.execute(
        `UPDATE users u
         INNER JOIN roles r ON u.role_id = r.id
         SET u.courier_work_email = ?
         WHERE u.id = ? AND r.role_name = 'courier'`,
        [value, uid]
    );

    return result && result.affectedRows > 0;
};

const resolveCourierNotifyEmail = (userRow) => {
    if (!userRow) {
        return '';
    }

    const work = userRow.courier_work_email ? String(userRow.courier_work_email).trim() : '';
    if (work) {
        return work;
    }

    const personal = userRow.email ? String(userRow.email).trim() : '';
    return personal;
};

const listUserIdsByRole = async (roleName) => {
    const role = typeof roleName === 'string' ? roleName.trim() : '';
    if (!role) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT u.id
         FROM users u
         INNER JOIN roles r ON u.role_id = r.id
         WHERE r.role_name = ?
           AND COALESCE(u.is_blocked, 0) = 0`,
        [role]
    );

    if (!rows || rows.length === 0) {
        return [];
    }

    return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
};

const isBlocked = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const [rows] = await db.execute(
        'SELECT COALESCE(is_blocked, 0) AS is_blocked FROM users WHERE id = ? LIMIT 1',
        [uid]
    );

    return !!(rows && rows[0] && Number(rows[0].is_blocked) === 1);
};

module.exports = {
    getDefaultRoleId,
    getRoleIdByName,
    getUserid,
    createUser,
    findByGoogleId,
    createGoogleUser,
    linkGoogleId,
    findUserByEmailWithRole,
    findByEmailExceptUserId,
    updateProfileById,
    updateAvatarUrlById,
    updatePasswordHashById,
    listForAdmin,
    updateRoleById,
    setBlockedById,
    setCourierOnShift,
    getCourierShift,
    listCouriersOnShiftWithLoad,
    listCouriersForAdmin,
    updateCourierWorkEmailById,
    resolveCourierNotifyEmail,
    listUserIdsByRole,
    isBlocked
};

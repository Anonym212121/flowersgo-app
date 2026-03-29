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
            u.first_name, u.last_name, u.email, u.password_hash,
            u.phone, u.avatar_url, u.loyalty_points
         FROM users u
         INNER JOIN roles r ON u.role_id = r.id
         WHERE u.email = ?
         LIMIT 1`,
        [email]
    );

    return rows[0] || null;
};

module.exports = {
    getDefaultRoleId,
    createUser,
    findUserByEmailWithRole
};


const db = require('../config/db');

const seedDefaults = async () => {
    const defaultRoles = ['user', 'admin', 'warehouse_worker'];
    const defaultStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    for (const roleName of defaultRoles) {
        await db.execute(
            'INSERT IGNORE INTO roles (role_name) VALUES (?)',
            [roleName]
        );
    }

    for (const statusName of defaultStatuses) {
        await db.execute(
            'INSERT IGNORE INTO statuses (status_name) VALUES (?)',
            [statusName]
        );
    }
};

module.exports = seedDefaults;


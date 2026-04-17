const db = require('../config/db');

const getPendingStatusId = async () => {
    const [rows] = await db.execute(
        'SELECT id FROM statuses WHERE status_name = ? LIMIT 1',
        ['pending']
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return Number(rows[0].id) || null;
};

module.exports = {
    getPendingStatusId
};

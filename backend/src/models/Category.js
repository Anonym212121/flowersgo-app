const db = require('../config/db');

const allCategories = async () => {
const [rows] = await db.execute(
        `SELECT id, name, parent_id
         FROM categories
         ORDER BY parent_id IS NULL DESC, name ASC`
    );

    return rows;
};

module.exports = {
    allCategories
};
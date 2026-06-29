const db = require('../config/db');

const listForWarehouse = async () => {
    const [rows] = await db.execute(
        `SELECT id, status_name, label_uk
         FROM statuses
         WHERE show_in_warehouse = 1
         ORDER BY sort_order ASC, id ASC`
    );
    return rows;
};

const canTransition = async (fromStatusId, toStatusId) => {
    const fromId = Number(fromStatusId);
    const toId = Number(toStatusId);
    if (!Number.isFinite(fromId) || fromId <= 0 || !Number.isFinite(toId) || toId <= 0) {
        return false;
    }
    if (fromId === toId) {
        return true;
    }

    const [rows] = await db.execute(
        `SELECT id FROM status_transitions
         WHERE from_status_id = ? AND to_status_id = ?
         LIMIT 1`,
        [fromId, toId]
    );
    return rows && rows.length > 0;
};

const listTransitionsMap = async () => {
    const [rows] = await db.execute(
        `SELECT from_status_id, to_status_id
         FROM status_transitions`
    );
    const map = {};
    for (const row of rows) {
        const fromKey = String(row.from_status_id);
        if (!map[fromKey]) {
            map[fromKey] = [];
        }
        map[fromKey].push(Number(row.to_status_id));
    }
    return map;
};

const listForCourier = async () => {
    const [rows] = await db.execute(
        `SELECT id, status_name, label_uk
         FROM statuses
         WHERE show_in_courier = 1
         ORDER BY sort_order ASC, id ASC`
    );
    return rows;
};

const getIdByName = async (statusName) => {
    const name = typeof statusName === 'string' ? statusName.trim() : '';
    if (!name) {
        return null;
    }
    const [rows] = await db.execute(
        'SELECT id FROM statuses WHERE status_name = ? LIMIT 1',
        [name]
    );
    if (!rows || rows.length === 0) {
        return null;
    }
    return Number(rows[0].id);
};

const getById = async (statusId) => {
    const sid = Number(statusId);
    if (!Number.isFinite(sid) || sid <= 0) {
        return null;
    }
    const [rows] = await db.execute(
        'SELECT id, status_name, label_uk FROM statuses WHERE id = ? LIMIT 1',
        [sid]
    );
    return rows && rows.length > 0 ? rows[0] : null;
};

module.exports = {
    listForWarehouse,
    listForCourier,
    getById,
    getIdByName,
    canTransition,
    listTransitionsMap
};

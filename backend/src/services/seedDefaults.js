const db = require('../config/db');

const seedDefaults = async () => {
    const defaultRoles = ['user', 'admin', 'warehouse_worker', 'courier'];
    const defaultStatuses = [
        { name: 'pending', label: 'Нове замовлення', sort: 1, initial: 1, warehouse: 0, courier: 0 },
        { name: 'confirmed', label: 'Підтверджено', sort: 2, initial: 0, warehouse: 1, courier: 0 },
        { name: 'processing', label: 'Комплектується', sort: 3, initial: 0, warehouse: 1, courier: 0 },
        { name: 'ready_for_pickup', label: 'Готово до видачі', sort: 4, initial: 0, warehouse: 1, courier: 1 },
        { name: 'shipped', label: 'В дорозі', sort: 5, initial: 0, warehouse: 0, courier: 1 },
        { name: 'delivered', label: 'Доставлено', sort: 6, initial: 0, warehouse: 1, courier: 1 },
        { name: 'accepted', label: 'Завершено', sort: 7, initial: 0, warehouse: 0, courier: 0 },
        { name: 'rejected', label: 'Не прийнято', sort: 8, initial: 0, warehouse: 0, courier: 0 },
        { name: 'cancelled', label: 'Скасовано', sort: 9, initial: 0, warehouse: 0, courier: 0 }
    ];
    const defaultTransitions = [
        ['pending', 'confirmed'],
        ['pending', 'cancelled'],
        ['confirmed', 'processing'],
        ['confirmed', 'cancelled'],
        ['processing', 'ready_for_pickup'],
        ['processing', 'cancelled'],
        ['ready_for_pickup', 'shipped'],
        ['ready_for_pickup', 'delivered'],
        ['ready_for_pickup', 'cancelled'],
        ['shipped', 'delivered'],
        ['shipped', 'cancelled'],
        ['delivered', 'accepted'],
        ['delivered', 'rejected']
    ];

    for (const roleName of defaultRoles) {
        await db.execute('INSERT IGNORE INTO roles (role_name) VALUES (?)', [roleName]);
    }

    for (const row of defaultStatuses) {
        await db.execute(
            `INSERT IGNORE INTO statuses (status_name, label_uk, sort_order, show_in_warehouse, show_in_courier, is_initial)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [row.name, row.label, row.sort, row.warehouse, row.courier, row.initial]
        );
        await db.execute(
            `UPDATE statuses
             SET label_uk = ?, sort_order = ?, show_in_warehouse = ?, show_in_courier = ?, is_initial = ?
             WHERE status_name = ?`,
            [row.label, row.sort, row.warehouse, row.courier, row.initial, row.name]
        );
    }

    const [statusRows] = await db.execute('SELECT id, status_name FROM statuses');
    const nameToId = {};
    for (const s of statusRows) {
        nameToId[s.status_name] = Number(s.id);
    }

    for (const pair of defaultTransitions) {
        const fromId = nameToId[pair[0]];
        const toId = nameToId[pair[1]];
        if (!fromId || !toId) {
            continue;
        }
        await db.execute(
            'INSERT IGNORE INTO status_transitions (from_status_id, to_status_id) VALUES (?, ?)',
            [fromId, toId]
        );
    }

    const pendingId = nameToId.pending;
    const processingId = nameToId.processing;
    if (pendingId && processingId) {
        await db.execute(
            'DELETE FROM status_transitions WHERE from_status_id = ? AND to_status_id = ?',
            [pendingId, processingId]
        );
    }

    const shippedId = nameToId.shipped;
    if (processingId && shippedId) {
        await db.execute(
            'DELETE FROM status_transitions WHERE from_status_id = ? AND to_status_id = ?',
            [processingId, shippedId]
        );
    }
};

module.exports = seedDefaults;

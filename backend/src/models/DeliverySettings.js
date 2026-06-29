const db = require('../config/db');

const get = async () => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM delivery_settings WHERE id = 1 LIMIT 1'
        );

        if (!rows || rows.length === 0) {
            return null;
        }

        return rows[0];
    } catch (err) {
        console.error('DeliverySettings.get:', err.message);
        return null;
    }
};

const save = async (payload) => {
    const row = payload || {};

    const work_start_hour = Number(row.work_start_hour);
    const work_end_hour = Number(row.work_end_hour);
    const slot_hours = Number(row.slot_hours);
    const standard_buffer_min = Number(row.standard_buffer_min);
    const express_buffer_min = Number(row.express_buffer_min);
    const pickup_start_hour = Number(row.pickup_start_hour);
    const pickup_end_hour = Number(row.pickup_end_hour);
    const pickup_buffer_min = Number(row.pickup_buffer_min);
    const fee_standard = Number(row.fee_standard);
    const fee_exact = Number(row.fee_exact);
    const fee_express = Number(row.fee_express);
    const fee_pickup = Number(row.fee_pickup);

    if (
        !Number.isFinite(work_start_hour) ||
        !Number.isFinite(work_end_hour) ||
        !Number.isFinite(slot_hours) ||
        !Number.isFinite(standard_buffer_min) ||
        !Number.isFinite(express_buffer_min) ||
        !Number.isFinite(pickup_start_hour) ||
        !Number.isFinite(pickup_end_hour) ||
        !Number.isFinite(pickup_buffer_min)
    ) {
        return false;
    }

    const [result] = await db.execute(
        `INSERT INTO delivery_settings (
            id, work_start_hour, work_end_hour, slot_hours,
            standard_buffer_min, express_buffer_min,
            pickup_start_hour, pickup_end_hour, pickup_buffer_min,
            fee_standard, fee_exact, fee_express, fee_pickup
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            work_start_hour = VALUES(work_start_hour),
            work_end_hour = VALUES(work_end_hour),
            slot_hours = VALUES(slot_hours),
            standard_buffer_min = VALUES(standard_buffer_min),
            express_buffer_min = VALUES(express_buffer_min),
            pickup_start_hour = VALUES(pickup_start_hour),
            pickup_end_hour = VALUES(pickup_end_hour),
            pickup_buffer_min = VALUES(pickup_buffer_min),
            fee_standard = VALUES(fee_standard),
            fee_exact = VALUES(fee_exact),
            fee_express = VALUES(fee_express),
            fee_pickup = VALUES(fee_pickup)`,
        [
            work_start_hour,
            work_end_hour,
            slot_hours,
            standard_buffer_min,
            express_buffer_min,
            pickup_start_hour,
            pickup_end_hour,
            pickup_buffer_min,
            Number.isFinite(fee_standard) ? fee_standard : 0,
            Number.isFinite(fee_exact) ? fee_exact : 0,
            Number.isFinite(fee_express) ? fee_express : 0,
            Number.isFinite(fee_pickup) ? fee_pickup : 0
        ]
    );

    return result && result.affectedRows > 0;
};

module.exports = {
    get,
    save
};

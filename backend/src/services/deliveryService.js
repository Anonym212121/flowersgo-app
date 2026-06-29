const DEFAULTS = {
    workStartHour: 9,
    workEndHour: 23,
    slotHours: 2,
    standardBufferMin: 120,
    expressBufferMin: 60,
    pickupStartHour: 9,
    pickupEndHour: 19,
    pickupBufferMin: 60,
    fees: {
        standard: 0,
        exact: 99,
        express: 99,
        pickup: 0
    }
};

const buildConfig = (row) => {
    if (!row) {
        return {
            workStartHour: DEFAULTS.workStartHour,
            workEndHour: DEFAULTS.workEndHour,
            slotHours: DEFAULTS.slotHours,
            standardBufferMin: DEFAULTS.standardBufferMin,
            expressBufferMin: DEFAULTS.expressBufferMin,
            pickupStartHour: DEFAULTS.pickupStartHour,
            pickupEndHour: DEFAULTS.pickupEndHour,
            pickupBufferMin: DEFAULTS.pickupBufferMin,
            fees: {
                standard: DEFAULTS.fees.standard,
                exact: DEFAULTS.fees.exact,
                express: DEFAULTS.fees.express,
                pickup: DEFAULTS.fees.pickup
            }
        };
    }

    return {
        workStartHour: Number(row.work_start_hour),
        workEndHour: Number(row.work_end_hour),
        slotHours: Number(row.slot_hours),
        standardBufferMin: Number(row.standard_buffer_min),
        expressBufferMin: Number(row.express_buffer_min),
        pickupStartHour: Number(row.pickup_start_hour),
        pickupEndHour: Number(row.pickup_end_hour),
        pickupBufferMin: Number(row.pickup_buffer_min),
        fees: {
            standard: Number(row.fee_standard),
            exact: Number(row.fee_exact),
            express: Number(row.fee_express),
            pickup: Number(row.fee_pickup)
        }
    };
};

const getDeliveryFee = (method, config) => {
    const fees = config && config.fees ? config.fees : {};
    const fee = fees[method];
    if (fee === undefined) {
        return null;
    }
    return fee;
};

const pad = (n) => String(n).padStart(2, '0');

const buildDateTime = (dateStr, timeStr) => {
    if (typeof dateStr !== 'string' || typeof timeStr !== 'string') {
        return null;
    }
    const dateParts = dateStr.split('-');
    const timeParts = timeStr.split(':');
    if (dateParts.length !== 3 || timeParts.length < 2) {
        return null;
    }

    const year = Number(dateParts[0]);
    const month = Number(dateParts[1]);
    const day = Number(dateParts[2]);
    const hour = Number(timeParts[0]);
    const minute = Number(timeParts[1]);

    if (![year, month, day, hour, minute].every(Number.isFinite)) {
        return null;
    }

    const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(dt.getTime())) {
        return null;
    }
    return dt;
};

const formatDateTime = (dt) => {
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const validateSelection = (payload, now, config) => {
    const method = payload && payload.method;
    const fee = getDeliveryFee(method, config);
    if (fee === null) {
        return { ok: false, message: 'Невірний спосіб доставки' };
    }

    const nowTime = now instanceof Date ? now : new Date();

    if (method === 'express') {
        const dt = new Date(nowTime.getTime() + config.expressBufferMin * 60000);
        if (dt.getHours() >= config.workEndHour) {
            return { ok: false, message: 'Експрес-доставка вже недоступна на сьогодні' };
        }
        if (dt.getHours() < config.workStartHour) {
            dt.setHours(config.workStartHour, 0, 0, 0);
        }
        return { ok: true, fee, deliveryDatetime: formatDateTime(dt) };
    }

    const dt = buildDateTime(payload.date, payload.time);
    if (!dt) {
        return { ok: false, message: 'Вкажіть дату й час доставки' };
    }

    if (method === 'pickup') {
        const hour = dt.getHours();
        if (hour < config.pickupStartHour || hour >= config.pickupEndHour) {
            return { ok: false, message: `Самовивіз доступний з ${config.pickupStartHour}:00 до ${config.pickupEndHour}:00` };
        }
        const earliest = new Date(nowTime.getTime() + config.pickupBufferMin * 60000);
        if (dt.getTime() < earliest.getTime()) {
            return { ok: false, message: 'Оберіть пізніший час — потрібен час на складання' };
        }
        return { ok: true, fee, deliveryDatetime: formatDateTime(dt) };
    }

    const hour = dt.getHours();
    if (hour < config.workStartHour || hour >= config.workEndHour) {
        return { ok: false, message: `Доставка доступна з ${config.workStartHour}:00 до ${config.workEndHour}:00` };
    }
    const earliest = new Date(nowTime.getTime() + config.standardBufferMin * 60000);
    if (dt.getTime() < earliest.getTime()) {
        return { ok: false, message: 'Оберіть пізніший час — потрібен час на складання й доставку' };
    }

    return { ok: true, fee, deliveryDatetime: formatDateTime(dt) };
};

module.exports = {
    buildConfig,
    getDeliveryFee,
    validateSelection
};

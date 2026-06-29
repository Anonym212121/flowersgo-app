const buildDeliveryDateTime = (row) => {
    if (!row || !row.delivery_date) {
        return null;
    }

    let yyyy;
    let mm;
    let dd;

    if (row.delivery_date instanceof Date && !Number.isNaN(row.delivery_date.getTime())) {
        yyyy = row.delivery_date.getFullYear();
        mm = row.delivery_date.getMonth() + 1;
        dd = row.delivery_date.getDate();
    } else {
        const text = String(row.delivery_date).trim();
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!iso) {
            return null;
        }
        yyyy = Number(iso[1]);
        mm = Number(iso[2]);
        dd = Number(iso[3]);
    }

    let hh = 12;
    let mi = 0;
    if (row.delivery_timeslot) {
        const slot = String(row.delivery_timeslot).trim();
        const parts = slot.split(':');
        hh = Number(parts[0]) || 12;
        mi = Number(parts[1]) || 0;
    }

    return new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
};

const deliveryTimestampMs = (row) => {
    const dt = buildDeliveryDateTime(row);
    if (!dt) {
        return null;
    }
    return dt.getTime();
};

module.exports = {
    buildDeliveryDateTime,
    deliveryTimestampMs
};

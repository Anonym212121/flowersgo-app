const parseDateParts = (raw) => {
    if (raw == null || raw === '') {
        return null;
    }

    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return {
            day: raw.getDate(),
            month: raw.getMonth() + 1,
            year: raw.getFullYear()
        };
    }

    const text = String(raw).trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        return {
            day: Number(iso[3]),
            month: Number(iso[2]),
            year: Number(iso[1])
        };
    }

    return null;
};

const formatDatePart = (raw) => {
    const parts = parseDateParts(raw);
    if (!parts) {
        return '';
    }

    const dd = String(parts.day).padStart(2, '0');
    const mm = String(parts.month).padStart(2, '0');
    return dd + '.' + mm + '.' + parts.year;
};

const formatTimePart = (raw) => {
    if (raw == null || raw === '') {
        return '';
    }

    const text = String(raw).trim();
    if (/^\d{1,2}:\d{2}/.test(text)) {
        const hh = text.slice(0, 2);
        const mi = text.slice(3, 5);
        return hh + ':' + mi;
    }

    return text.slice(0, 5);
};

const formatDeliveryDisplay = (deliveryDate, deliveryTimeslot) => {
    const dateText = formatDatePart(deliveryDate);
    const timeText = formatTimePart(deliveryTimeslot);

    if (!dateText) {
        return '—';
    }
    if (!timeText) {
        return dateText;
    }

    return dateText + ', ' + timeText;
};

const withDeliveryDisplay = (order) => {
    if (!order) {
        return order;
    }
    return {
        ...order,
        delivery_display: formatDeliveryDisplay(order.delivery_date, order.delivery_timeslot)
    };
};

module.exports = {
    formatDatePart,
    formatTimePart,
    formatDeliveryDisplay,
    withDeliveryDisplay
};

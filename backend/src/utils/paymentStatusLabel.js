const paymentStatusLabel = (status) => {
    const s = String(status || '').trim();
    if (s === 'paid') {
        return 'Оплачено онлайн';
    }
    if (s === 'cod') {
        return 'Оплата при отриманні';
    }
    if (s === 'unpaid') {
        return 'Не оплачено';
    }
    if (s === 'refunded') {
        return 'Повернено';
    }
    return s || '—';
};

const paymentStatusLabelShort = (status) => {
    const s = String(status || '').trim();
    if (s === 'paid') {
        return 'Оплачено';
    }
    if (s === 'cod') {
        return 'При отриманні';
    }
    if (s === 'unpaid') {
        return 'Не оплачено';
    }
    if (s === 'refunded') {
        return 'Повернено';
    }
    return s || '—';
};

module.exports = {
    paymentStatusLabel,
    paymentStatusLabelShort
};

const buildPhoneLinks = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return { ok: false };
    }

    const digits = phone.replace(/\D/g, '');
    let full = digits;

    if (full.startsWith('380') && full.length === 12) {
    } else if (full.startsWith('0') && full.length === 10) {
        full = '38' + full;
    } else if (full.length === 9) {
        full = '380' + full;
    } else {
        return { ok: false };
    }

    if (!full.startsWith('380') || full.length !== 12) {
        return { ok: false };
    }

    const display = '+380' + full.slice(3);

    return {
        ok: true,
        display: display,
        tel: 'tel:' + display,
        viber: 'viber://chat?number=' + full,
        telegram: 'https://t.me/+' + full
    };
};

module.exports = {
    buildPhoneLinks
};

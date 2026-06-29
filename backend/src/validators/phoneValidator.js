const phoneValidator = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return { ok: false, message: 'Вкажіть номер телефону' };
    }

    const digits = phone.replace(/\D/g, '');

    let national = digits;
    if (national.startsWith('380')) {
        national = national.slice(3);
    } else if (national.startsWith('0')) {
        national = national.slice(1);
    }

    if (national.length !== 9) {
        return { ok: false, message: 'Номер має бути у форматі +380 і ще 9 цифр' };
    }

    return { ok: true, phone: '+380' + national };
};

module.exports = phoneValidator;

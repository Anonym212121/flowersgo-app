const registerValidator = (body) => {
    if (!body) {
        return { ok: false, message: 'Тіло запиту відсутнє' };
    }

    const { first_name, last_name, email, password, phone } = body;

    if (!first_name || typeof first_name !== 'string' || first_name.trim().length < 2) {
        return { ok: false, message: 'Імя має бути не менше 2 символів' };
    }

    if (!last_name || typeof last_name !== 'string' || last_name.trim().length < 2) {
        return { ok: false, message: 'Прізвище має бути не менше 2 символів' };
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return { ok: false, message: 'Email має бути коректним' };
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        return { ok: false, message: 'Пароль має бути не менше 6 символів' };
    }

    if (phone !== undefined && phone !== null) {
        if (typeof phone !== 'string') {
            return { ok: false, message: 'Номер телефону має бути рядком' };
        }

        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 20) {
            return { ok: false, message: 'Номер телефону має бути в межах 10-20 цифр' };
        }
    }

    return { ok: true };
};

module.exports = registerValidator;


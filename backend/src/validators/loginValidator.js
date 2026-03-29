const loginValidator = (body) => {
    if (!body) {
        return { ok: false, message: 'Тіло запиту відсутнє' };
    }

    const { email, password } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return { ok: false, message: 'Email має бути коректним' };
    }

    if (!password || typeof password !== 'string' || password.length < 1) {
        return { ok: false, message: 'Пароль має бути заданим' };
    }

    return { ok: true };
};

module.exports = loginValidator;


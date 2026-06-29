const emailValidator = require('./emailValidator');

const loginValidator = (body) => {
    if (!body) {
        return { ok: false, message: 'Тіло запиту відсутнє' };
    }

    const emailCheck = emailValidator(body.email);
    if (!emailCheck.ok) {
        return emailCheck;
    }

    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) {
        return { ok: false, message: 'Вкажіть пароль' };
    }

    return {
        ok: true,
        data: {
            email: emailCheck.email,
            password
        }
    };
};

module.exports = loginValidator;

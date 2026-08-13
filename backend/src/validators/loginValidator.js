const emailValidator = require('./emailValidator');
const phoneValidator = require('./phoneValidator');

const getLoginIdentifier = (body) => {
    if (!body) {
        return '';
    }

    if (typeof body.email === 'string' && body.email.trim()) {
        return body.email.trim();
    }
    if (typeof body.phone === 'string' && body.phone.trim()) {
        return body.phone.trim();
    }
    if (typeof body.login === 'string' && body.login.trim()) {
        return body.login.trim();
    }

    return '';
};

const loginValidator = (body) => {
    if (!body) {
        return { ok: false, message: 'Тіло запиту відсутнє' };
    }

    const identifier = getLoginIdentifier(body);
    if (!identifier) {
        return { ok: false, message: 'Вкажи email або номер телефону' };
    }

    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) {
        return { ok: false, message: 'Вкажіть пароль' };
    }

    if (identifier.includes('@')) {
        const emailCheck = emailValidator(identifier);
        if (!emailCheck.ok) {
            return emailCheck;
        }

        return {
            ok: true,
            data: {
                login_type: 'email',
                email: emailCheck.email,
                password
            }
        };
    }

    const phoneCheck = phoneValidator(identifier);
    if (!phoneCheck.ok) {
        return {
            ok: false,
            message: 'Вкажи email або номер телефону у форматі +380XXXXXXXXX'
        };
    }

    return {
        ok: true,
        data: {
            login_type: 'phone',
            phone: phoneCheck.phone,
            password
        }
    };
};

module.exports = loginValidator;

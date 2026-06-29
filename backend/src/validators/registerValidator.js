const emailValidator = require('./emailValidator');
const phoneValidator = require('./phoneValidator');

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

const registerValidator = (body) => {
    if (!body) {
        return { ok: false, message: 'Тіло запиту відсутнє' };
    }

    const first_name = typeof body.first_name === 'string' ? body.first_name.trim() : '';
    const last_name = typeof body.last_name === 'string' ? body.last_name.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const password_confirm =
        typeof body.password_confirm === 'string' ? body.password_confirm : '';
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';

    if (first_name.length < 2) {
        return { ok: false, message: "Ім'я має бути не менше 2 символів" };
    }

    if (last_name.length < 2) {
        return { ok: false, message: 'Прізвище має бути не менше 2 символів' };
    }

    const emailCheck = emailValidator(body.email);
    if (!emailCheck.ok) {
        return emailCheck;
    }

    if (!password || password.length < MIN_PASSWORD) {
        return { ok: false, message: `Пароль має бути не менше ${MIN_PASSWORD} символів` };
    }

    if (password.length > MAX_PASSWORD) {
        return { ok: false, message: 'Пароль занадто довгий' };
    }

    if (password !== password_confirm) {
        return { ok: false, message: 'Підтвердження пароля не збігається' };
    }

    const phoneCheck = phoneValidator(rawPhone);
    if (!phoneCheck.ok) {
        return phoneCheck;
    }

    const acceptTerms =
        body.accept_terms === true ||
        body.accept_terms === 'true' ||
        body.accept_terms === 'on' ||
        body.accept_terms === '1';

    if (!acceptTerms) {
        return { ok: false, message: 'Потрібно погодитися з політикою конфіденційності' };
    }

    return {
        ok: true,
        data: {
            first_name,
            last_name,
            email: emailCheck.email,
            password,
            phone: phoneCheck.phone
        }
    };
};

module.exports = registerValidator;

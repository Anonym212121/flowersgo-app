const registerValidator = require('../src/validators/registerValidator');
const loginValidator = require('../src/validators/loginValidator');

describe('Валідація реєстрації', () => {
    const validPayload = {
        first_name: 'Іван',
        last_name: 'Петренко',
        email: 'ivan@example.com',
        password: 'secret123',
        password_confirm: 'secret123',
        phone: '+380991112233',
        accept_terms: '1'
    };

    test('повертає ok=true для коректних даних', () => {
        const result = registerValidator(validPayload);
        expect(result.ok).toBe(true);
        expect(result.data).toEqual({
            first_name: 'Іван',
            last_name: 'Петренко',
            email: 'ivan@example.com',
            password: 'secret123',
            phone: '+380991112233'
        });
    });

    test('нормалізує email до нижнього регістру', () => {
        const result = registerValidator({
            ...validPayload,
            email: '  Ivan@Example.COM  '
        });
        expect(result.ok).toBe(true);
        expect(result.data.email).toBe('ivan@example.com');
    });

    test('блокує некоректний email', () => {
        const result = registerValidator({
            ...validPayload,
            email: 'ivan.example.com'
        });
        expect(result.ok).toBe(false);
    });

    test('блокує короткий пароль', () => {
        const result = registerValidator({
            ...validPayload,
            password: '123',
            password_confirm: '123'
        });
        expect(result.ok).toBe(false);
    });

    test('блокує різні паролі', () => {
        const result = registerValidator({
            ...validPayload,
            password_confirm: 'otherpass'
        });
        expect(result.ok).toBe(false);
    });

    test('блокує реєстрацію без згоди з політикою', () => {
        const result = registerValidator({
            ...validPayload,
            accept_terms: ''
        });
        expect(result.ok).toBe(false);
    });
});

describe('Валідація логіну', () => {
    test('приймає коректний email і пароль', () => {
        const result = loginValidator({
            email: 'user@example.com',
            password: '12345678'
        });
        expect(result).toEqual({
            ok: true,
            data: {
                email: 'user@example.com',
                password: '12345678'
            }
        });
    });

    test('блокує порожній пароль', () => {
        const result = loginValidator({
            email: 'user@example.com',
            password: ''
        });
        expect(result.ok).toBe(false);
    });
});

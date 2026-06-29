const phoneValidator = require('../src/validators/phoneValidator');
const emailValidator = require('../src/validators/emailValidator');

describe('phoneValidator на checkout', () => {
    test('приймає номер +380 і 9 цифр', () => {
        const result = phoneValidator('+380501112233');
        expect(result.ok).toBe(true);
        expect(result.phone).toBe('+380501112233');
    });

    test('приймає номер що починається з 0', () => {
        const result = phoneValidator('0501112233');
        expect(result.ok).toBe(true);
        expect(result.phone).toBe('+380501112233');
    });

    test('відхиляє занадто короткий номер', () => {
        const result = phoneValidator('+3805011');
        expect(result.ok).toBe(false);
    });
});

describe('emailValidator на checkout', () => {
    test('приймає нормальний email', () => {
        const result = emailValidator('  test@mail.com  ');
        expect(result).toEqual({ ok: true, email: 'test@mail.com' });
    });

    test('відхиляє email без @', () => {
        const result = emailValidator('test.mail.com');
        expect(result.ok).toBe(false);
    });
});

const checkUserContent = require('../src/utils/userContentGuard');

describe('checkUserContent', () => {
    test('пропускає звичайний відгук', () => {
        const result = checkUserContent('Дуже гарний букет, квіти свіжі, дякую!', { minLen: 2 });
        expect(result.ok).toBe(true);
        expect(result.text).toContain('букет');
    });

    test('відхиляє скрипт як небезпечний або чистить його', () => {
        const result = checkUserContent('<script>alert(1)</script>гарний букет', { minLen: 2 });
        expect(result.ok).toBe(true);
        expect(result.text).toBe('гарний букет');
    });

    test('відхиляє атаку javascript:', () => {
        const result = checkUserContent('javascript:alert(1)');
        expect(result.ok).toBe(false);
        expect(result.code).toBe('unsafe');
    });

    test('відхиляє спам з кількома посиланнями', () => {
        const result = checkUserContent('Дивіться https://spam.com і www.casino.test');
        expect(result.ok).toBe(false);
        expect(result.code).toBe('spam');
    });

    test('відхиляє лайку', () => {
        const result = checkUserContent('це сука, не беру');
        expect(result.ok).toBe(false);
        expect(result.code).toBe('profanity');
    });
});

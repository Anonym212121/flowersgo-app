const { buildPhoneLinks } = require('../src/utils/phoneMessengerLinks');

describe('buildPhoneLinks', () => {
    test('формат +380', () => {
        const result = buildPhoneLinks('+380671234567');
        expect(result.ok).toBe(true);
        expect(result.display).toBe('+380671234567');
        expect(result.tel).toBe('tel:+380671234567');
        expect(result.viber).toBe('viber://chat?number=380671234567');
        expect(result.telegram).toBe('https://t.me/+380671234567');
    });

    test('формат 0XX', () => {
        const result = buildPhoneLinks('0671234567');
        expect(result.ok).toBe(true);
        expect(result.display).toBe('+380671234567');
    });

    test('порожній номер', () => {
        const result = buildPhoneLinks('');
        expect(result.ok).toBe(false);
    });
});

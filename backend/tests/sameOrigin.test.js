const sameOrigin = require('../src/middleware/sameOrigin');

describe('sameOrigin.originMatchesHost', () => {
    test('пускає той самий host', () => {
        expect(sameOrigin.originMatchesHost({
            headers: {
                host: 'flowersgo.com',
                origin: 'https://flowersgo.com'
            }
        })).toBe(true);
    });

    test('відхиляє чужий origin', () => {
        expect(sameOrigin.originMatchesHost({
            headers: {
                host: 'flowersgo.com',
                origin: 'https://evil.example'
            }
        })).toBe(false);
    });

    test('відхиляє запит без origin', () => {
        expect(sameOrigin.originMatchesHost({
            headers: {
                host: 'flowersgo.com'
            }
        })).toBe(false);
    });
});

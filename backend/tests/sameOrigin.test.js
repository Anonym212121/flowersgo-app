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

    test('пускає origin з APP_BASE_URL коли Host інший', () => {
        const prev = process.env.APP_BASE_URL;
        process.env.APP_BASE_URL = 'https://flowersgo.online';
        expect(sameOrigin.originMatchesHost({
            headers: {
                host: 'flowersgo.onrender.com',
                origin: 'https://flowersgo.online'
            }
        })).toBe(true);
        if (prev === undefined) {
            delete process.env.APP_BASE_URL;
        } else {
            process.env.APP_BASE_URL = prev;
        }
    });

    test('пускає origin як X-Forwarded-Host', () => {
        expect(sameOrigin.originMatchesHost({
            headers: {
                host: 'flowersgo.onrender.com',
                'x-forwarded-host': 'flowersgo.online',
                origin: 'https://flowersgo.online'
            }
        })).toBe(true);
    });

    test('пускає Sec-Fetch-Site same-origin', () => {
        expect(sameOrigin.originMatchesHost({
            headers: {
                host: 'flowersgo.onrender.com',
                origin: 'https://flowersgo.online',
                'sec-fetch-site': 'same-origin'
            }
        })).toBe(true);
    });
});

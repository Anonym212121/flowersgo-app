process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

describe('HTTP захист', () => {
    afterAll(async () => {
        if (db && typeof db.end === 'function') {
            await db.end();
        }
    });

    test('POST з чужого Origin відхиляється', async () => {
        const res = await request(app)
            .post('/cart/add')
            .set('Origin', 'https://evil.example')
            .send({ product_id: 1 });

        expect(res.status).toBe(403);
    });

    test('/api/admin без входу дає 401', async () => {
        const res = await request(app).get('/api/admin/dashboard');
        expect(res.status).toBe(401);
    });

    test('callback LiqPay з кривим підписом відхиляється', async () => {
        const res = await request(app)
            .post('/payment/liqpay/callback')
            .type('form')
            .send({ data: 'abc', signature: 'bad-signature' });

        expect(res.status).toBe(400);
        expect(String(res.text)).toContain('bad signature');
    });

    test('надто велике тіло callback дає 413', async () => {
        const big = 'x'.repeat(40 * 1024);
        const res = await request(app)
            .post('/payment/liqpay/callback')
            .type('form')
            .send({ data: big, signature: 'y' });

        expect(res.status).toBe(413);
    });
});

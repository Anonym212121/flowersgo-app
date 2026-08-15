process.env.LIQPAY_PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY || 'test-public';
process.env.LIQPAY_PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY || 'test-private';

const liqpayService = require('../src/services/liqpayService');

describe('liqpayService.verifySignature', () => {
    test('правильний підпис проходить', () => {
        const form = liqpayService.buildCheckoutForm({
            orderId: 12,
            amount: 100,
            description: 'Тест',
            resultUrl: 'https://example.com/result',
            serverUrl: 'https://example.com/payment/liqpay/callback'
        });
        expect(liqpayService.verifySignature(form.data, form.signature)).toBe(true);
    });

    test('кривий підпис відхиляється', () => {
        const form = liqpayService.buildCheckoutForm({
            orderId: 12,
            amount: 100,
            description: 'Тест',
            resultUrl: 'https://example.com/result'
        });
        expect(liqpayService.verifySignature(form.data, 'bad-signature-value')).toBe(false);
        expect(liqpayService.verifySignature(form.data, '')).toBe(false);
    });
});

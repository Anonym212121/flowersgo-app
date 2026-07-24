const refundStatusLabel = require('../src/utils/refundStatusLabel');

describe('refundStatusLabel', () => {
    test('бейдж для скасованого з очікуванням повернення', () => {
        const order = {
            status_name: 'cancelled',
            payment_status: 'paid',
            refund_status: 'pending'
        };
        expect(refundStatusLabel.orderSummaryBadge(order)).toBe('Скасовано · Повернення');
        expect(refundStatusLabel.paymentBadgeForCabinet(order).text).toBe('Очікує повернення');
    });

    test('бейдж після повернення', () => {
        const order = {
            status_name: 'cancelled',
            payment_status: 'refunded',
            refund_status: 'refunded'
        };
        expect(refundStatusLabel.orderSummaryBadge(order)).toBe('Скасовано · Повернено');
    });

    test('підказка для processing', () => {
        const order = {
            status_name: 'cancelled',
            payment_status: 'paid',
            refund_status: 'processing'
        };
        expect(refundStatusLabel.refundStatusHint(order)).toMatch(/LiqPay/i);
    });
});

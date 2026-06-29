const paymentApplyService = require('../src/services/paymentApplyService');
const paymentService = require('../src/services/paymentService');

describe('paymentApplyService — guard оплати', () => {
    test('success вважається оплаченим callback', () => {
        expect(paymentApplyService.isIncomingPaid({ status: 'success' })).toBe(true);
        expect(paymentApplyService.isIncomingPaid({ status: 'failure' })).toBe(false);
    });

    test('скасоване замовлення закрито для оплати', () => {
        const order = {
            admin_approved: -1,
            status_name: 'cancelled',
            payment_status: 'unpaid',
            cancel_request_at: null,
            payment_deadline_at: new Date(Date.now() + 600000)
        };
        expect(paymentApplyService.isOrderClosedForPayment(order)).toBe(true);
    });

    test('активне unpaid у вікні — можна платити', () => {
        const order = {
            admin_approved: 0,
            status_name: 'pending',
            payment_status: 'unpaid',
            cancel_request_at: null,
            payment_deadline_at: new Date(Date.now() + 600000),
            createdAt: new Date()
        };
        expect(paymentApplyService.isOrderClosedForPayment(order)).toBe(false);
        expect(paymentService.getPaymentBlockReason(order)).toBe('ok');
    });

    test('прострочене unpaid — закрито', () => {
        const order = {
            admin_approved: 0,
            status_name: 'pending',
            payment_status: 'unpaid',
            cancel_request_at: null,
            payment_deadline_at: new Date(Date.now() - 60000),
            createdAt: new Date(Date.now() - 20 * 60000)
        };
        expect(paymentApplyService.isOrderClosedForPayment(order)).toBe(true);
        expect(paymentService.getPaymentBlockReason(order)).toBe('expired');
    });

    test('cancel_request блокує оплату', () => {
        const order = {
            admin_approved: 1,
            status_name: 'confirmed',
            payment_status: 'unpaid',
            cancel_request_at: new Date(),
            payment_deadline_at: new Date(Date.now() + 600000)
        };
        expect(paymentApplyService.isOrderClosedForPayment(order)).toBe(true);
        expect(paymentService.getPaymentBlockReason(order)).toBe('cancel_pending');
    });
});

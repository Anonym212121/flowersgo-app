const orderCancelService = require('../src/services/orderCancelService');

describe('orderCancelService', () => {
    test('дозволяє скасування на модерації', () => {
        const order = {
            status_name: 'pending',
            admin_approved: 0,
            delivery_date: '2099-01-01',
            delivery_timeslot: '14:00'
        };
        expect(orderCancelService.canCustomerRequestCancel(order)).toBe(true);
    });

    test('блокує якщо вже є запит', () => {
        const order = {
            status_name: 'confirmed',
            admin_approved: 1,
            cancel_request_at: new Date(),
            delivery_date: '2099-06-01',
            delivery_timeslot: '14:00'
        };
        expect(orderCancelService.getCancelBlockReason(order)).toBe('pending_request');
    });

    test('блокує якщо до доставки менше 2 годин', () => {
        const soon = new Date(Date.now() + 60 * 60 * 1000);
        const yyyy = soon.getFullYear();
        const mm = String(soon.getMonth() + 1).padStart(2, '0');
        const dd = String(soon.getDate()).padStart(2, '0');
        const hh = String(soon.getHours()).padStart(2, '0');
        const mi = String(soon.getMinutes()).padStart(2, '0');

        const order = {
            status_name: 'confirmed',
            admin_approved: 1,
            delivery_date: `${yyyy}-${mm}-${dd}`,
            delivery_timeslot: `${hh}:${mi}`
        };

        expect(orderCancelService.getCancelBlockReason(order)).toBe('too_soon');
    });

    test('підказка для оплаченого LiqPay', () => {
        const text = orderCancelService.getRefundHintForCustomer({ payment_status: 'paid' });
        expect(text).toMatch(/картку/i);
    });
});

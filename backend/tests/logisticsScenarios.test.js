const deliveryService = require('../src/services/deliveryService');
const orderCancelService = require('../src/services/orderCancelService');

const cfg = deliveryService.buildConfig(null);

const futureDate = () => {
    const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

describe('checkout — час доставки (як на формі)', () => {
    test('standard + delivery_slot проходить валідацію', () => {
        const result = deliveryService.validateSelection(
            {
                method: 'standard',
                date: futureDate(),
                time: '14:00'
            },
            new Date(),
            cfg
        );
        expect(result.ok).toBe(true);
        expect(result.deliveryDatetime).toContain('14:00');
    });

    test('exact + delivery_time_exact проходить валідацію', () => {
        const result = deliveryService.validateSelection(
            {
                method: 'exact',
                date: futureDate(),
                time: '15:30'
            },
            new Date(),
            cfg
        );
        expect(result.ok).toBe(true);
    });

    test('express без дати проходить', () => {
        const result = deliveryService.validateSelection(
            {
                method: 'express',
                date: '',
                time: ''
            },
            new Date(),
            cfg
        );
        expect(result.ok).toBe(true);
        expect(result.fee).toBe(cfg.fees.express);
    });

    test('standard без часу — помилка (як було б без hidden поля)', () => {
        const result = deliveryService.validateSelection(
            {
                method: 'standard',
                date: futureDate(),
                time: ''
            },
            new Date(),
            cfg
        );
        expect(result.ok).toBe(false);
    });
});

describe('скасування — ready_for_pickup', () => {
    test('дозволяє якщо до доставки більше 1 години', () => {
        const later = new Date(Date.now() + 3 * 60 * 60 * 1000);
        const yyyy = later.getFullYear();
        const mm = String(later.getMonth() + 1).padStart(2, '0');
        const dd = String(later.getDate()).padStart(2, '0');
        const hh = String(later.getHours()).padStart(2, '0');

        const order = {
            status_name: 'ready_for_pickup',
            admin_approved: 1,
            delivery_date: `${yyyy}-${mm}-${dd}`,
            delivery_timeslot: `${hh}:00`
        };

        expect(orderCancelService.canCustomerRequestCancel(order)).toBe(true);
    });

    test('блокує shipped', () => {
        const order = {
            status_name: 'shipped',
            admin_approved: 1,
            delivery_date: '2099-01-01',
            delivery_timeslot: '14:00'
        };
        expect(orderCancelService.getCancelBlockReason(order)).toBe('too_late');
    });
});

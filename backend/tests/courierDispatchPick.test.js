const { pickBestCourierForOrder, attachNearestSlots } = require('../src/utils/courierDispatchPick');

describe('courierDispatchPick', () => {
    test('не призначає кур\'єру, який зараз доставляє', () => {
        const order = { delivery_date: '2026-06-06', delivery_timeslot: '14:00' };
        const couriers = [
            { id: 1, delivering_now: 1, active_orders: 1, nearest_slot_ms: Date.parse('2026-06-06T14:00:00') },
            { id: 2, delivering_now: 0, active_orders: 0, nearest_slot_ms: null }
        ];

        const best = pickBestCourierForOrder(order, couriers, 5);
        expect(Number(best.id)).toBe(2);
    });

    test('обирає кур\'єра з найближчим часом доставки', () => {
        const order = { delivery_date: '2026-06-06', delivery_timeslot: '15:00' };
        const couriers = [
            { id: 1, delivering_now: 0, active_orders: 1, nearest_slot_ms: Date.parse('2026-06-06T10:00:00') },
            { id: 2, delivering_now: 0, active_orders: 1, nearest_slot_ms: Date.parse('2026-06-06T14:30:00') }
        ];

        const best = pickBestCourierForOrder(order, couriers, 5);
        expect(Number(best.id)).toBe(2);
    });

    test('attachNearestSlots рахує найближчий слот', () => {
        const couriers = [{ id: 5 }];
        const assignments = [
            { courier_id: 5, delivery_date: '2026-06-07', delivery_timeslot: '12:00' },
            { courier_id: 5, delivery_date: '2026-06-06', delivery_timeslot: '16:00' }
        ];
        const enriched = attachNearestSlots(couriers, assignments);
        expect(enriched[0].nearest_slot_ms).toBe(new Date(2026, 5, 6, 16, 0).getTime());
    });
});

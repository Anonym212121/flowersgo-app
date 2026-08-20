const realtimeService = require('../src/services/realtimeService');

describe('realtimeService', () => {
    test('sendToUser не падає якщо сокетів немає', () => {
        expect(realtimeService.sendToUser(2, { type: 'notification', title: 'Тест' })).toBe(0);
    });

    test('pushCourierOrder не падає без підключень', () => {
        expect(realtimeService.pushCourierOrder(2, {
            event: 'assigned',
            order_id: 15,
            title: 'Замовлення заброньовано'
        })).toBe(0);
    });

    test('sendToGuest не падає без підключень', () => {
        expect(realtimeService.sendToGuest('guest-token-demo', { type: 'support_chat' })).toBe(0);
    });

    test('pushSupportChat не падає без підключень', () => {
        expect(realtimeService.pushSupportChat({
            event: 'message',
            chat_id: 1,
            to_admins: true,
            guest_token: 'guest-token-demo'
        })).toBe(0);
    });
});

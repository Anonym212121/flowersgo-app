const sentMails = [];

jest.mock('../src/services/emailService', () => ({
    sendEmail: jest.fn(async ({ to, subject, text }) => {
        sentMails.push({ to, subject, text });
        return { ok: true };
    }),
    isConfigured: jest.fn(() => true)
}));

jest.mock('../src/models/Notification', () => ({
    insertForUser: jest.fn(async () => true),
    insertForUsers: jest.fn(async () => 1)
}));

jest.mock('../src/models/User', () => ({
    listUserIdsByRole: jest.fn(async (role) => {
        if (role === 'admin') return [1];
        if (role === 'warehouse_worker') return [3];
        return [2];
    }),
    getUserid: jest.fn(async (id) => ({
        user_id: id,
        email: id === 3 ? 'warehouse@test.com' : id === 2 ? 'courier@test.com' : 'admin@test.com',
        first_name: id === 2 ? 'Кур' : id === 3 ? 'Склад' : 'Адмін',
        last_name: id === 2 ? 'Єр' : '',
        courier_work_email: 'courier-work@test.com',
        role_name: id === 2 ? 'courier' : id === 3 ? 'warehouse_worker' : 'admin'
    })),
    resolveCourierNotifyEmail: jest.fn((userRow) => {
        if (!userRow || !userRow.email) return '';
        return String(userRow.email).trim();
    })
}));

jest.mock('../src/models/Order', () => ({
    getRowForCustomerNotify: jest.fn(async (orderId) => ({
        id: orderId,
        user_id: 10,
        delivery_method: 'courier',
        payment_status: 'paid',
        total_amount: 1200,
        delivery_date: '2026-07-05',
        delivery_timeslot: '14:00',
        customer_email: 'customer@test.com',
        status_name: 'processing'
    }))
}));

const emailService = require('../src/services/emailService');
const orderWarehouseNotifyService = require('../src/services/orderWarehouseNotifyService');
const orderRoleNotifyService = require('../src/services/orderRoleNotifyService');
const notificationEmailService = require('../src/services/notificationEmailService');

describe('email notifications', () => {
    beforeEach(() => {
        sentMails.length = 0;
        jest.clearAllMocks();
        process.env.EMAIL_NOTIFY = '1';
        process.env.EMAIL_PROVIDER_MODE = 'mock';
        process.env.APP_BASE_URL = 'http://localhost:5000';
    });

    test('клієнту надсилається лист при зміні статусу processing', async () => {
        await orderWarehouseNotifyService.notifyCustomerOnStatus(55, 'processing');
        expect(sentMails.length).toBe(1);
        expect(sentMails[0].to).toBe('customer@test.com');
        expect(sentMails[0].subject).toContain('комплектується');
        expect(sentMails[0].text).toContain('1200.00 грн');
    });

    test('клієнту надсилається лист при оплаті', async () => {
        await orderWarehouseNotifyService.notifyCustomerPaymentSuccess(77);
        expect(sentMails.length).toBe(1);
        expect(sentMails[0].subject).toContain('карткою');
        expect(sentMails[0].text).toContain('карткою');
    });

    test('клієнту надсилається лист при підтвердженні адміном', async () => {
        await orderWarehouseNotifyService.notifyCustomerOrderConfirmed(80);
        expect(sentMails.length).toBe(1);
        expect(sentMails[0].subject).toContain('підтверджено');
    });

    test('адміну надсилається лист про нове замовлення', async () => {
        await orderRoleNotifyService.onNewOrderForAdmin(88);
        expect(emailService.sendEmail).toHaveBeenCalled();
        const adminMail = sentMails.find((row) => row.to === 'admin@test.com');
        expect(adminMail).toBeTruthy();
        expect(adminMail.subject).toContain('нове замовлення');
    });

    test('складу надсилається лист про комплектацію', async () => {
        await orderRoleNotifyService.onOrderApprovedForWarehouse(90);
        const whMail = sentMails.find((row) => row.to === 'warehouse@test.com');
        expect(emailService.sendEmail).toHaveBeenCalled();
        expect(whMail).toBeTruthy();
    });

    test('курʼєру надсилається лист при бронюванні', async () => {
        await orderRoleNotifyService.onCourierBooked(99, 2);
        expect(emailService.sendEmail).toHaveBeenCalled();
        const courierMail = sentMails.find((row) => row.to === 'courier@test.com');
        expect(courierMail).toBeTruthy();
    });

    test('notificationEmailService не падає без email у користувача', async () => {
        const UserModel = require('../src/models/User');
        UserModel.getUserid.mockResolvedValueOnce({ user_id: 3, email: '', role_name: 'customer' });
        await notificationEmailService.sendForUserId(3, {
            title: 'Тест',
            body: 'Тіло',
            link_url: '/cabinet'
        });
        expect(sentMails.length).toBe(0);
    });

    test('notificationEmailService надсилає на адресу напряму', async () => {
        await notificationEmailService.sendToAddress('guest@test.com', {
            title: 'Підтримка',
            body: 'Нове повідомлення',
            link_url: '/support'
        });
        expect(sentMails.length).toBe(1);
        expect(sentMails[0].to).toBe('guest@test.com');
    });
});

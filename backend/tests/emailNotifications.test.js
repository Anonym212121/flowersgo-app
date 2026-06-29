const sentMails = [];

jest.mock('../src/services/emailService', () => ({
    sendEmail: jest.fn(async ({ to, subject, text }) => {
        sentMails.push({ to, subject, text });
        return { ok: true };
    })
}));

jest.mock('../src/models/Notification', () => ({
    insertForUser: jest.fn(async () => true),
    insertForUsers: jest.fn(async () => 1)
}));

jest.mock('../src/models/User', () => ({
    listUserIdsByRole: jest.fn(async (role) => (role === 'admin' ? [1] : [2])),
    getUserid: jest.fn(async (id) => ({
        user_id: id,
        email: id === 2 ? 'courier@test.com' : 'admin@test.com',
        courier_work_email: 'courier-work@test.com',
        role_name: id === 2 ? 'courier' : 'admin'
    })),
    resolveCourierNotifyEmail: jest.fn((userRow) => {
        if (!userRow) return '';
        if (userRow.courier_work_email) return String(userRow.courier_work_email).trim();
        return userRow.email ? String(userRow.email).trim() : '';
    })
}));

jest.mock('../src/models/Order', () => ({
    getDetailForWarehouse: jest.fn(async (orderId) => ({
        order: {
            id: orderId,
            user_id: 10,
            delivery_method: 'courier',
            guest_email: '',
            customer_email: 'customer@test.com'
        }
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
        process.env.SMTP_HOST = 'smtp.test';
        process.env.SMTP_USER = 'user@test.com';
        process.env.SMTP_PASS = 'pass';
    });

    test('клієнту надсилається лист при зміні статусу processing', async () => {
        await orderWarehouseNotifyService.notifyCustomerOnStatus(55, 'processing');
        expect(sentMails.length).toBe(1);
        expect(sentMails[0].to).toBe('customer@test.com');
        expect(sentMails[0].subject).toContain('комплектується');
    });

    test('клієнту надсилається лист при оплаті', async () => {
        await orderWarehouseNotifyService.notifyCustomerPaymentSuccess(77);
        expect(sentMails.length).toBe(1);
        expect(sentMails[0].subject).toContain('Оплату');
    });

    test('адміну надсилається лист про нове замовлення', async () => {
        await orderRoleNotifyService.onNewOrderForAdmin(88);
        expect(emailService.sendEmail).toHaveBeenCalled();
        const adminMail = sentMails.find((row) => row.to === 'admin@test.com');
        expect(adminMail).toBeTruthy();
        expect(adminMail.subject).toContain('FlowersGo');
    });

    test('курʼєру надсилається лист при бронюванні', async () => {
        await orderRoleNotifyService.onCourierBooked(99, 2);
        expect(emailService.sendEmail).toHaveBeenCalled();
        const courierMail = sentMails.find((row) => row.to === 'courier-work@test.com');
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

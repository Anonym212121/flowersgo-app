const emailService = require('./emailService');
const UserModel = require('../models/User');

const isEnabled = () => {
    if (String(process.env.EMAIL_NOTIFY || '1').trim() === '0') {
        return false;
    }
    return emailService.isConfigured();
};

const baseUrl = () => {
    const raw = process.env.APP_BASE_URL || 'http://localhost:5000';
    return String(raw).replace(/\/$/, '');
};

const buildText = (title, body, linkUrl) => {
    let text = title || 'FlowersGo';
    if (body) {
        text += '\n\n' + body;
    }
    if (linkUrl) {
        const link = linkUrl.startsWith('http') ? linkUrl : baseUrl() + linkUrl;
        text += '\n\nВідкрити в системі: ' + link;
    }
    text += '\n\n— FlowersGo';
    return text;
};

const resolveEmailForUser = (userRow) => {
    if (!userRow) {
        return '';
    }
    if (userRow.role_name === 'courier') {
        return UserModel.resolveCourierNotifyEmail(userRow);
    }
    const email = userRow.email ? String(userRow.email).trim() : '';
    return email;
};

const sendToAddress = async (email, payload) => {
    if (!isEnabled()) {
        return;
    }

    const to = typeof email === 'string' ? email.trim() : '';
    if (!to) {
        return;
    }

    const title = payload && payload.title ? payload.title : 'Сповіщення';
    const body = payload && payload.body ? payload.body : '';
    const linkUrl = payload && payload.link_url ? payload.link_url : '';

    try {
        await emailService.sendEmail({
            to,
            subject: 'FlowersGo: ' + title,
            text: buildText(title, body, linkUrl)
        });
    } catch (err) {
        console.error('notificationEmail address:', err.message);
    }
};

const sendForUserId = async (userId, payload) => {
    if (!isEnabled()) {
        return;
    }

    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return;
    }

    try {
        const user = await UserModel.getUserid(uid);
        const to = resolveEmailForUser(user);
        if (!to) {
            return;
        }
        await sendToAddress(to, payload);
    } catch (err) {
        console.error('notificationEmail user:', err.message);
    }
};

const sendForUserIds = async (userIds, payload) => {
    const ids = Array.isArray(userIds) ? userIds : [];
    for (const rawId of ids) {
        await sendForUserId(rawId, payload);
    }
};

const sendForRole = async (roleName, payload) => {
    if (!isEnabled()) {
        return;
    }

    try {
        const ids = await UserModel.listUserIdsByRole(roleName);
        await sendForUserIds(ids, payload);
    } catch (err) {
        console.error('notificationEmail role:', err.message);
    }
};

module.exports = {
    isEnabled,
    sendToAddress,
    sendForUserId,
    sendForUserIds,
    sendForRole
};

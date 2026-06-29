const nodemailer = require('nodemailer');

let cachedTransporter = null;

const getTransporter = () => {
    if (cachedTransporter) {
        return cachedTransporter;
    }

    const host = process.env.SMTP_HOST || '';
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    if (!host || !user || !pass) {
        return null;
    }

    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });
    return cachedTransporter;
};

const sendEmail = async ({ to, subject, text }) => {
    const mode = (process.env.EMAIL_PROVIDER_MODE || 'smtp').toLowerCase();

    if (mode === 'mock') {
        console.log(`EMAIL MOCK -> ${to}; subject="${subject}"; text="${text}"`);
        return { ok: true };
    }

    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    if (!transporter || !from) {
        return { ok: false, message: 'SMTP не налаштований у .env (SMTP_HOST/PORT/USER/PASS/FROM).' };
    }

    try {
        await transporter.sendMail({
            from,
            to,
            subject,
            text
        });
        return { ok: true };
    } catch (err) {
        console.error('sendEmail:', err.message);
        return { ok: false, message: 'Не вдалося відправити лист' };
    }
};

module.exports = {
    sendEmail
};

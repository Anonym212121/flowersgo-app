const nodemailer = require('nodemailer');

let cachedTransporter = null;

const trimEnv = (name) => {
    const raw = process.env[name];
    return typeof raw === 'string' ? raw.trim() : '';
};

const getMode = () => (trimEnv('EMAIL_PROVIDER_MODE') || 'smtp').toLowerCase();

const isSmtpConfigured = () => {
    return !!(trimEnv('SMTP_HOST') && trimEnv('SMTP_USER') && trimEnv('SMTP_PASS'));
};

const isResendConfigured = () => {
    return !!trimEnv('RESEND_API_KEY');
};

const getTransporter = () => {
    if (cachedTransporter) {
        return cachedTransporter;
    }

    const host = trimEnv('SMTP_HOST');
    const port = Number(trimEnv('SMTP_PORT') || 587);
    const user = trimEnv('SMTP_USER');
    const pass = trimEnv('SMTP_PASS');

    if (!host || !user || !pass) {
        return null;
    }

    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        ...(port === 587 ? { requireTLS: true } : {})
    });
    return cachedTransporter;
};

const smtpBlockedHint =
    ' Render Free блокує SMTP (порти 587/465). Використайте Starter plan або EMAIL_PROVIDER_MODE=resend.';

const mapSmtpError = (err) => {
    const code = err && err.code ? String(err.code) : '';
    const message = err && err.message ? String(err.message) : '';

    if (code === 'EAUTH' || message.toLowerCase().includes('invalid login')) {
        return 'Gmail відхилив логін. Потрібен App Password (16 символів), не звичайний пароль.';
    }
    if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ESOCKET') {
        return 'SMTP зʼєднання не встановлено.' + smtpBlockedHint;
    }
    return 'Не вдалося відправити лист через SMTP.';
};

const sendViaResend = async ({ to, subject, text }) => {
    const apiKey = trimEnv('RESEND_API_KEY');
    if (!apiKey) {
        return { ok: false, message: 'RESEND_API_KEY не налаштований на сервері.' };
    }

    const from = trimEnv('RESEND_FROM') || trimEnv('SMTP_FROM') || trimEnv('SMTP_USER');
    if (!from) {
        return { ok: false, message: 'RESEND_FROM або SMTP_FROM не налаштований.' };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject,
                text
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = data && data.message ? data.message : 'HTTP ' + response.status;
            console.error('sendEmail resend:', detail);
            return { ok: false, message: 'Resend: ' + detail };
        }

        return { ok: true };
    } catch (err) {
        console.error('sendEmail resend:', err.message);
        return { ok: false, message: 'Не вдалося відправити лист через Resend.' };
    }
};

const sendViaSmtp = async ({ to, subject, text }) => {
    const transporter = getTransporter();
    const from = trimEnv('SMTP_FROM') || trimEnv('SMTP_USER');
    if (!transporter || !from) {
        return { ok: false, message: 'SMTP не налаштований (SMTP_HOST/PORT/USER/PASS/FROM).' };
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
        console.error('sendEmail smtp:', err.code || '', err.message);
        return { ok: false, message: mapSmtpError(err) };
    }
};

const sendEmail = async ({ to, subject, text }) => {
    const mode = getMode();
    const recipient = typeof to === 'string' ? to.trim() : '';

    if (!recipient) {
        return { ok: false, message: 'Email одержувача не вказано.' };
    }

    if (mode === 'mock') {
        console.log('EMAIL MOCK -> ' + recipient + '; subject="' + subject + '"; text="' + text + '"');
        return { ok: true };
    }

    if (mode === 'resend') {
        return sendViaResend({ to: recipient, subject, text });
    }

    return sendViaSmtp({ to: recipient, subject, text });
};

const isConfigured = () => {
    const mode = getMode();
    if (mode === 'mock') {
        return true;
    }
    if (mode === 'resend') {
        return isResendConfigured();
    }
    return isSmtpConfigured();
};

module.exports = {
    sendEmail,
    isConfigured
};

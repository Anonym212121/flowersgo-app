const emailValidator = (email) => {
    if (typeof email !== 'string' || email.trim() === '') {
        return { ok: false, message: 'Вкажіть email' };
    }

    const value = email.trim();
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pattern.test(value)) {
        return { ok: false, message: 'Email має бути у форматі name@example.com' };
    }

    return { ok: true, email: value.toLowerCase() };
};

module.exports = emailValidator;

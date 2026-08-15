const cookieBase = (extra) => {
    const opts = {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    };
    if (extra && typeof extra === 'object') {
        const keys = Object.keys(extra);
        for (let i = 0; i < keys.length; i++) {
            opts[keys[i]] = extra[keys[i]];
        }
    }
    return opts;
};

module.exports = cookieBase;

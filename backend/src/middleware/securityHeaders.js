const helmet = require('helmet');

const helmetMw = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

const securityHeaders = (req, res, next) => {
    helmetMw(req, res, () => {
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
        next();
    });
};

module.exports = securityHeaders;

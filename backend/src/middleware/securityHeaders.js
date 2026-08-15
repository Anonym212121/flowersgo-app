const helmet = require('helmet');

const helmetMw = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false
});

const securityHeaders = (req, res, next) => {
    helmetMw(req, res, () => {
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
        next();
    });
};

module.exports = securityHeaders;

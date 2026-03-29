const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Токен відсутній' });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ message: 'Невірний формат токена' });
        }

        const token = parts[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
            user_id: decoded.user_id,
            role_id: decoded.role_id,
            role_name: decoded.role_name
        };

        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Токен недійсний або минув час' });
    }
};

module.exports = authMiddleware;


const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');

const authMiddleware = async (req, res, next) => {
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
        const rawId = decoded.user_id != null ? decoded.user_id : decoded.id;
        const userId = Number(rawId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(401).json({ message: 'Токен недійсний або минув час' });
        }

        const user = await UserModel.findAuthById(userId);
        if (!user || Number(user.is_blocked) === 1) {
            return res.status(401).json({ message: 'Токен недійсний або минув час' });
        }

        req.user = {
            user_id: Number(user.id),
            role_id: user.role_id,
            role_name: user.role_name
        };

        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Токен недійсний або минув час' });
    }
};

module.exports = authMiddleware;

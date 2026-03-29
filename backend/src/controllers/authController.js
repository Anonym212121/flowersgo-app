const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserModel = require('../models/User');
const registerValidator = require('../validators/registerValidator');
const loginValidator = require('../validators/loginValidator');

const register = async (req, res) => {
    try {
        const validation = registerValidator(req.body);
        if (!validation.ok) {
            return res.status(400).json({ message: validation.message });
        }

        const { first_name, last_name, email, password, phone } = req.body;

        const password_hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 10));

        const role_id = await UserModel.getDefaultRoleId();

        const user = await UserModel.createUser({
            role_id,
            first_name,
            last_name,
            email,
            password_hash,
            phone
        });

        return res.status(201).json({
            message: 'Користувача успішно створено',
            user
        });
    } catch (err) {
        if (err && err.message) {
            if (err.message.toLowerCase().includes('email')) {
                return res.status(400).json({ message: err.message });
            }
        }

        return res.status(500).json({ message: 'Сталася помилка реєстрації' });
    }
};

const login = async (req, res) => {
    try {
        const validation = loginValidator(req.body);
        if (!validation.ok) {
            return res.status(400).json({ message: validation.message });
        }

        const { email, password } = req.body;

        const user = await UserModel.findUserByEmailWithRole(email);
        if (!user) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Невірний пароль' });
        }

        const token = jwt.sign(
            {
                user_id: user.id,
                role_id: user.role_id,
                role_name: user.role_name
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        return res.status(200).json({
            message: 'Успішний вхід',
            token,
            user: {
                id: user.id,
                role_id: user.role_id,
                role_name: user.role_name,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                avatar_url: user.avatar_url,
                loyalty_points: user.loyalty_points
            }
        });
    } catch (err) {
        return res.status(500).json({ message: 'Сталася помилка авторизації' });
    }
};

const me = async (req, res) => {
    return res.status(200).json({
        user: req.user
    });
};

module.exports = {
    register,
    login,
    me
};


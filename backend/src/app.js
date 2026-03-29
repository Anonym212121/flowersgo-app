const express = require('express');
require('dotenv').config();
require('./config/db');

const app = express();

app.use(express.json());

// Тестовий "пінг", щоб перевірити, чи сервер живий
app.get('/status', (req, res) => {
    res.status(200).json({
        message: "Server is flying!",
        timestamp: new Date().toISOString()
    });
});

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const seedDefaults = require('./services/seedDefaults');

const PORT = process.env.PORT || 5000;
const start = async () => {
    try {
        await seedDefaults();
    } catch (err) {
        console.error('Seed error:', err && err.message ? err.message : err);
    }

    app.listen(PORT, () => {
        console.log(`: ${PORT}`);
    });
};

start();
const path = require('path');
const express = require('express');
require('dotenv').config();
require('./config/db');

const app = express();
const rootDir = path.join(__dirname, '..');

app.set('view engine', 'ejs');
app.set('views', path.join(rootDir, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const pagesRoutes = require('./routes/pagesRoutes');
app.use('/', pagesRoutes);
app.use(express.static(path.join(rootDir, 'public')));


const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const pageAuthContext = require('./middleware/pageAuthContext');
const requireAdminJson = require('./middleware/requireAdminJson');
const adminApiRoutes = require('./routes/adminApiRoutes');
app.use('/api/admin', pageAuthContext, requireAdminJson, adminApiRoutes);

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
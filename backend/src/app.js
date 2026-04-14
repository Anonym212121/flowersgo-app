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

const getErrorViewModel = (statusCode) => {
    if (statusCode === 404) {
        return {
            title: '404 - Сторінку не знайдено',
            errorTitle: 'Сторінку не знайдено',
            errorMessage: 'Схоже, адреса введена неправильно або сторінку було видалено.'
        };
    }

    if (statusCode === 502) {
        return {
            title: '502 - Помилка сервера',
            errorTitle: 'Тимчасова помилка сервера',
            errorMessage: 'Сервер тимчасово недоступний. Спробуйте оновити сторінку трохи пізніше.'
        };
    }

    return {
        title: `${statusCode} - Помилка сервера`,
        errorTitle: 'Сталася помилка',
        errorMessage: 'Не вдалося обробити запит. Спробуйте ще раз пізніше.'
    };
};

const renderErrorPage = (req, res, statusCode) => {
    const viewModel = getErrorViewModel(statusCode);
    return res.status(statusCode).render('layout', {
        title: viewModel.title,
        bodyPartial: 'pages/error',
        headerType: 'guest',
        currentUser: null,
        statusCode,
        errorTitle: viewModel.errorTitle,
        errorMessage: viewModel.errorMessage
    });
};

app.use((req, res) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ message: 'Маршрут не знайдено' });
    }
    return renderErrorPage(req, res, 404);
});

app.use((err, req, res, next) => {
    console.error('Global error:', err && err.message ? err.message : err);
    const statusCode = Number(err && err.status) || 500;

    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        return res.status(statusCode).json({ message: 'Внутрішня помилка сервера' });
    }

    return renderErrorPage(req, res, statusCode);
});

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
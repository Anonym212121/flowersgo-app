const path = require('path');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('./config/db');
const app = express();
app.set('trust proxy', 1);
const rootDir = path.join(__dirname, '..');
const bodyLimit = '12mb';

const wantsJson = (req) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        return true;
    }
    const accept = req.headers.accept || '';
    return accept.indexOf('application/json') !== -1;
};

app.set('view engine', 'ejs');
app.set('views', path.join(rootDir, 'views'));
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

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
    if (wantsJson(req)) {
        return res.status(404).json({ ok: false, message: 'Маршрут не знайдено' });
    }
    return renderErrorPage(req, res, 404);
});

app.use((err, req, res, next) => {
    console.error('Global error:', err && err.message ? err.message : err);
    let statusCode = Number(err && err.status) || 500;
    if (err && err.type === 'entity.too.large') {
        statusCode = 413;
    }

    if (wantsJson(req)) {
        const message =
            statusCode === 413
                ? 'Запит занадто великий'
                : 'Внутрішня помилка сервера';
        return res.status(statusCode).json({ ok: false, message });
    }

    return renderErrorPage(req, res, statusCode);
});

const seedDefaults = require('./services/seedDefaults');
const ensureAdminSchema = require('./services/ensureAdminSchema');
const seedLegalPages = require('./services/seedLegalPages');
const { startOrderExpiryJob } = require('./services/orderExpiryService');

const PORT = process.env.PORT || 5000;
const start = async () => {
    try {
        await seedDefaults();
        await ensureAdminSchema();
        await seedLegalPages();
        startOrderExpiryJob();
    } catch (err) {
        console.error('Seed error:', err && err.message ? err.message : err);
    }

    app.listen(PORT, () => {
        console.log(`: ${PORT}`);
    });
};
start();
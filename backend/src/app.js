const path = require('path');
const http = require('http');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('./config/db');
const app = express();
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}
const rootDir = path.join(__dirname, '..');
const bodyLimit = '12mb';
const createRateLimit = require('./middleware/rateLimit');
const securityHeaders = require('./middleware/securityHeaders');
const sameOrigin = require('./middleware/sameOrigin');

const isLiqpayCallbackPath = (req) => {
    const url = String(req.originalUrl || '');
    return url.indexOf('/payment/liqpay/callback') !== -1;
};

app.use(securityHeaders);
app.use(sameOrigin);
app.use(createRateLimit({
    windowMs: 60 * 1000,
    max: 180,
    scope: 'global',
    message: 'Забагато запитів. Спробуйте трохи пізніше.',
    skip: (req) => {
        const url = String(req.originalUrl || '');
        if (isLiqpayCallbackPath(req)) {
            return true;
        }
        if (url.indexOf('/ws') === 0 || url === '/ws') {
            return true;
        }
        if (req.method === 'GET' && /\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|map)$/i.test(String(req.path || ''))) {
            return true;
        }
        return false;
    }
}));

const jsonBodyParser = express.json({ limit: bodyLimit });
const formBodyParser = express.urlencoded({ extended: true, limit: bodyLimit });
const liqpayBodyParser = express.urlencoded({ extended: true, limit: '32kb' });
const liqpayCallbackLimit = createRateLimit({
    windowMs: 60 * 1000,
    max: 40,
    scope: 'liqpay-callback',
    message: 'Забагато запитів. Спробуйте трохи пізніше.'
});

app.use((req, res, next) => {
    if (String(req.method || '').toUpperCase() !== 'POST' || !isLiqpayCallbackPath(req)) {
        return next();
    }
    return liqpayCallbackLimit(req, res, (err) => {
        if (err) {
            return next(err);
        }
        return liqpayBodyParser(req, res, next);
    });
});
app.use((req, res, next) => {
    if (isLiqpayCallbackPath(req)) {
        return next();
    }
    return jsonBodyParser(req, res, next);
});
app.use((req, res, next) => {
    if (isLiqpayCallbackPath(req)) {
        return next();
    }
    return formBodyParser(req, res, next);
});

const wantsJson = (req) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        return true;
    }
    const accept = req.headers.accept || '';
    return accept.indexOf('application/json') !== -1;
};

app.set('view engine', 'ejs');
app.set('views', path.join(rootDir, 'views'));

const i18n = require('./utils/i18n');
const localeContext = require('./middleware/localeContext');
app.use(localeContext);

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

const buildPageLayoutLocals = require('./utils/pageLayoutLocals');

const renderErrorPage = (req, res, statusCode) => {
    const viewModel = getErrorViewModel(statusCode);
    return res.status(statusCode).render('layout', {
        ...buildPageLayoutLocals(res, {
            title: viewModel.title,
            bodyPartial: 'pages/error',
            statusCode,
            errorTitle: viewModel.errorTitle,
            errorMessage: viewModel.errorMessage
        })
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
const realtimeService = require('./services/realtimeService');

const PORT = process.env.PORT || 5000;
const start = async () => {
    try {
        await i18n.initI18n();
        await seedDefaults();
        await ensureAdminSchema();
        await seedLegalPages();
        startOrderExpiryJob();
    } catch (err) {
        console.error('Seed error:', err && err.message ? err.message : err);
    }

    const server = http.createServer(app);
    realtimeService.attach(server);
    server.listen(PORT, () => {
        console.log(`: ${PORT}`);
    });
};

module.exports = app;

if (require.main === module) {
    start();
}
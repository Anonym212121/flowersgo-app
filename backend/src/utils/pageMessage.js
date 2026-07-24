const buildPageLayoutLocals = require('./pageLayoutLocals');

const wantsJsonResponse = (req) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        return true;
    }
    const accept = String(req.headers.accept || '').toLowerCase();
    if (accept.includes('application/json')) {
        return true;
    }
    const xhr = String(req.headers['x-requested-with'] || '').toLowerCase();
    if (xhr === 'xmlhttprequest') {
        return true;
    }
    return false;
};

const defaultCatalogActions = () => [
    { label: 'До каталогу', href: '/', primary: true },
    { label: 'У кошик', href: '/cart' }
];

const defaultCheckoutActions = () => [
    { label: 'Повернутися до оформлення', href: '/checkout', primary: true },
    { label: 'До каталогу', href: '/' }
];

const defaultHomeActions = () => [
    { label: 'На головну', href: '/', primary: true }
];

const defaultOrderActions = () => [
    { label: 'Особистий кабінет', href: '/cabinet', primary: true },
    { label: 'На головну', href: '/' }
];

const defaultWarehouseActions = () => [
    { label: 'До замовлень складу', href: '/warehouse/orders', primary: true }
];

const defaultCourierActions = () => [
    { label: 'До моїх доставок', href: '/courier/orders', primary: true }
];

const defaultWishlistActions = () => [
    { label: 'До обраного', href: '/wishlist', primary: true },
    { label: 'До каталогу', href: '/' }
];

const defaultProductActions = (productId) => {
    const actions = defaultCatalogActions();
    if (Number.isFinite(productId) && productId > 0) {
        actions.unshift({ label: 'До товару', href: '/product/' + productId, primary: true });
    }
    return actions;
};

const respondServerError = (req, res, options) => {
    const opts = options || {};
    return respondWithMessage(req, res, 500, opts.message || 'Спробуйте оновити сторінку або поверніться пізніше.', {
        title: opts.title || 'Помилка',
        messageTitle: opts.messageTitle || 'Щось пішло не так',
        icon: 'error',
        actions: opts.actions || defaultHomeActions()
    });
};

const deliveryHintForMessage = (message) => {
    const text = typeof message === 'string' ? message.toLowerCase() : '';
    if (!text) {
        return '';
    }
    if (text.includes('експрес') || text.includes('доставк') || text.includes('сьогодні')) {
        return 'Спробуйте іншу дату, стандартну доставку або самовивіз.';
    }
    return '';
};

const renderPageMessage = (req, res, options) => {
    const opts = options || {};
    const statusCode = Number(opts.statusCode) || 400;
    const messageText = typeof opts.message === 'string' ? opts.message : '';
    const messageTitle = opts.messageTitle || opts.title || 'Повідомлення';
    const messageHint = opts.hint || deliveryHintForMessage(messageText);
    const messageIcon = opts.icon || (statusCode >= 500 ? 'error' : 'warn');
    const messageActions =
        Array.isArray(opts.actions) && opts.actions.length > 0 ? opts.actions : defaultCatalogActions();

    const pageTitle = typeof opts.title === 'string' ? opts.title : messageTitle;

    return res.status(statusCode).render('layout', {
        title: pageTitle,
        bodyPartial: 'pages/message',
        statusCode,
        messageTitle,
        messageText,
        messageHint,
        messageIcon,
        messageActions,
        ...buildPageLayoutLocals(res, opts.extraLocals || {})
    });
};

const respondWithMessage = (req, res, statusCode, message, options) => {
    if (wantsJsonResponse(req)) {
        return res.status(statusCode).json({ ok: false, message: message });
    }
    return renderPageMessage(req, res, {
        statusCode,
        message,
        ...(options || {})
    });
};

module.exports = {
    wantsJsonResponse,
    defaultCatalogActions,
    defaultCheckoutActions,
    defaultHomeActions,
    defaultOrderActions,
    defaultWarehouseActions,
    defaultCourierActions,
    defaultWishlistActions,
    defaultProductActions,
    deliveryHintForMessage,
    renderPageMessage,
    respondWithMessage,
    respondServerError
};

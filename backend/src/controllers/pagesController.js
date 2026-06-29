const UserModel = require('../models/User');
const { getPageUserId } = require('../utils/pageUser');
const CategoryModel = require('../models/Category');
const ProductModel = require('../models/Product');
const ReviewModel = require('../models/Review');
const OrderModel = require('../models/Order');
const StatusModel = require('../models/Status');
const cartService = require('../services/cartService');
const constructorService = require('../services/constructorService');
const bouquetPreviewService = require('../services/bouquetPreviewService');
const deliveryService = require('../services/deliveryService');
const paymentService = require('../services/paymentService');
const orderCancelService = require('../services/orderCancelService');
const formatDelivery = require('../utils/formatDelivery');
const orderDeliveryFields = require('../utils/orderDeliveryFields');
const { mapOrderForWarehouse, buildWarehouseStats, filterWarehouseOrdersByTab, LOW_STOCK_LIMIT } = require('../utils/warehouseOrderView');
const OrderStatusLogModel = require('../models/OrderStatusLog');
const paymentToken = require('../utils/paymentToken');
const paymentSyncService = require('../services/paymentSyncService');
const DeliverySettings = require('../models/DeliverySettings');
const LegalPageModel = require('../models/LegalPage');
const { renderLegalBody } = require('../services/legalPageRender');
const sanitizeLegalHtml = require('../utils/sanitizeLegalHtml');
const homeCatalogService = require('../services/homeCatalogService');
const recentDeliveryService = require('../services/recentDeliveryService');
const buildPageLayoutLocals = require('../utils/pageLayoutLocals');

const renderLayout = (res, title, bodyPartial, extraLocals = {}) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        ...buildPageLayoutLocals(res, extraLocals)
    });
};

const home = async (req, res) => {
    try {
        const selectedCategoryId = req.query.category_id ? Number(req.query.category_id) : null;

        let searchQuery = '';
        const rawQ = req.query.q;
        if (rawQ !== undefined && rawQ !== null && rawQ !== '') {
            if (Array.isArray(rawQ)) {
                searchQuery = String(rawQ[0] ?? '').trim();
            } else {
                searchQuery = String(rawQ).trim();
            }
        }

        const categories = await CategoryModel.allCategories();

        const showHomeSections = !selectedCategoryId && !searchQuery;
        let hitProducts = [];
        let homeSections = [];
        let products = [];

        if (showHomeSections) {
            const homeData = await homeCatalogService.loadHomeCatalogData(categories);
            hitProducts = homeData.hitProducts;
            homeSections = homeData.homeSections;
            products = homeData.products;
        } else {
            products = await ProductModel.allProducts(selectedCategoryId, searchQuery);
        }

        const recentDelivery = await recentDeliveryService.loadRecentDeliveryHighlight();

        return renderLayout(res, 'Каталог товарів', 'pages/home', {
            categories,
            products,
            hitProducts,
            homeSections,
            recentDelivery,
            selectedCategoryId,
            searchQuery
        });
    } catch (err) {
        console.error('homePage:', err && err.message ? err.message : err);
        return res.status(500).send('помилка');
    }
};

const loginPage = (req, res) => {
    if (res.locals.currentUser) {
        return res.redirect('/');
    }
    const next = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '';
    return renderLayout(res, 'Вхід', 'pages/login', {
        authNext: next,
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
};

const accountBlockedPage = (req, res) => {
    return renderLayout(res, 'Блокування акаунта', 'pages/account-blocked');
};

const registerPage = (req, res) => {
    if (res.locals.currentUser) {
        return res.redirect('/');
    }
    const next = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '';
    return renderLayout(res, 'Реєстрація', 'pages/register', {
        authNext: next,
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
};

const renderLegalPublicPage = async (res, slug) => {
    const page = await LegalPageModel.getBySlug(slug);
    if (!page) {
        return res.status(404).send('Сторінку не знайдено');
    }

    let delivery = deliveryService.buildConfig(null);
    if (slug === 'delivery-terms') {
        const row = await DeliverySettings.get();
        delivery = deliveryService.buildConfig(row);
    }

    const safeBody = sanitizeLegalHtml(page.body_html);
    const renderedBody = renderLegalBody(safeBody, slug, {
        delivery,
        paymentWindowMin: paymentService.PAYMENT_WINDOW_MINUTES
    });

    return renderLayout(res, page.title, 'pages/legal-page', {
        legalPage: page,
        renderedBody
    });
};

const privacyPage = async (req, res) => {
    try {
        return await renderLegalPublicPage(res, 'privacy');
    } catch (err) {
        console.error('privacyPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const deliveryTermsPage = async (req, res) => {
    try {
        return await renderLegalPublicPage(res, 'delivery-terms');
    } catch (err) {
        console.error('deliveryTermsPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const logout = (req, res) => {
    res.clearCookie('token');
    return res.redirect('/');
};



const cabinetPage = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        const profile = await UserModel.getUserid(current.user_id);

        if (!profile) {
            return res.redirect('/login');
        }

        const myReviews = await ReviewModel.listByUserId(current.user_id);
        let rawOrders = await OrderModel.listByUserId(current.user_id);
        for (const row of rawOrders) {
            if (row.payment_status === 'unpaid') {
                await paymentSyncService.syncOrderPaymentFromLiqpay(row.id);
            }
        }
        rawOrders = await OrderModel.listByUserId(current.user_id);
        const orders = rawOrders.map((row) => {
            const secondsLeft = paymentService.getSecondsLeftForOrder(row);
            const blockReason = orderCancelService.getCancelBlockReason(row);
            return {
                ...row,
                can_pay_online: paymentService.canPayOnline(row),
                pay_block_reason: paymentService.getPaymentBlockReason(row),
                pay_token: paymentToken.makeForOrder(row.id, current.user_id),
                pay_deadline_iso: paymentService.getPaymentDeadlineIsoForOrder(row),
                pay_seconds_left: secondsLeft,
                pay_time_left_label: paymentService.formatTimeLeft(secondsLeft),
                can_request_cancel: orderCancelService.canCustomerRequestCancel(row),
                cancel_block_message: orderCancelService.getCancelBlockMessage(blockReason),
                cancel_refund_hint: orderCancelService.getRefundHintForCustomer(row),
                has_cancel_request: !!row.cancel_request_at,
                delivery_info: orderDeliveryFields.formatOrderDeliveryDisplay(row),
                ...formatDelivery.withDeliveryDisplay(row)
            };
        });
        const okCode = typeof req.query.ok === 'string' ? req.query.ok.trim() : '';
        const errCode = typeof req.query.err === 'string' ? req.query.err.trim() : '';

        const okMap = {
            profile_saved: 'Профіль успішно оновлено',
            avatar_saved: 'Аватар оновлено',
            email_code_sent: 'Код підтвердження відправлено на вашу пошту',
            password_changed: 'Пароль успішно змінено',
            order_created: 'Замовлення оформлено. Очікує підтвердження адміністратора.',
            payment_paid: 'Оплату зафіксовано. Замовлення перейшло в статус «Підтверджено».',
            order_archived: 'Замовлення переміщено в архів',
            review_edit_sent: 'Запит на редагування відгуку надіслано адміну',
            review_delete_sent: 'Запит на видалення відгуку надіслано адміну',
            cancel_request_sent: 'Запит на скасування надіслано адміну'
        };

        const errMap = {
            bad_first_name: "Ім'я має бути не менше 2 символів",
            bad_last_name: 'Прізвище має бути не менше 2 символів',
            bad_email: 'Вкажіть коректний email',
            bad_phone: 'Номер телефону має бути від 10 до 20 цифр',
            bad_address: 'Перевір збережену адресу доставки (потрібні вулиця і будинок)',
            email_exists: 'Такий email вже використовується',
            avatar_empty: 'Оберіть файл для аватара',
            avatar_not_saved: 'Не вдалося зберегти аватар',
            profile_not_updated: 'Не вдалося оновити профіль',
            email_required_for_password_reset: 'У профілі має бути вказана пошта',
            email_not_sent: 'Не вдалося відправити лист з кодом',
            email_code_not_saved: 'Не вдалося створити код підтвердження',
            bad_email_code_format: 'Код з листа має містити 6 цифр',
            bad_new_password: 'Новий пароль має бути не менше 6 символів',
            password_confirm_mismatch: 'Підтвердження пароля не збігається',
            email_code_expired: 'Код протермінований або неактивний',
            email_attempts_over: 'Вичерпано спроби введення коду',
            bad_email_code: 'Невірний код з листа',
            password_not_updated: 'Не вдалося змінити пароль',
            payment_expired: 'Час на оплату вичерпано. Зверніться до підтримки.',
            payment_rejected: 'Це замовлення відхилено адміністратором — оплатити його не можна. Оформіть нове.',
            payment_not_needed: 'Це замовлення не потребує онлайн-оплати.',
            payment_access_denied:
                'Немає доступу до оплати цього замовлення. Перевірте email у кабінеті (має збігатися з акаунтом оформлення) або створіть нове замовлення.',
            archive_failed: 'Не вдалося архівувати замовлення',
            review_request_pending: 'Запит вже очікує рішення адміна',
            review_edit_failed: 'Не вдалося надіслати запит на редагування',
            review_delete_failed: 'Не вдалося надіслати запит на видалення',
            cancel_not_allowed: 'Скасування зараз недоступне для цього замовлення',
            cancel_request_failed: 'Не вдалося надіслати запит на скасування',
            order_not_found: 'Замовлення не знайдено',
            cancel_pending: 'Очікує рішення адміна щодо скасування — оплата недоступна',
            server: 'Сталася помилка сервера'
        };

        return renderLayout(res, 'Мій кабінет', 'pages/cabinet', {
            profile,
            myReviews,
            orders,
            cabinetSuccessMessage: okMap[okCode] || '',
            cabinetErrorMessage: errMap[errCode] || '',
            cabinetPasswordVerifyStep:
                req.query.pw_step === 'verify' ||
                okCode === 'email_code_sent' ||
                errCode === 'bad_email_code' ||
                errCode === 'bad_email_code_format'
        });
    } catch (err) {
        console.error('cabinetPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const cartPage = async (req, res) => {
    try {
        const items = cartService.getCartFromRequest(req);
        const details = await cartService.buildCartDetails(items);
        const constructorNote = constructorService.getNoteFromRequest(req);
        const constructorPreview = bouquetPreviewService.getPreviewFromRequest(req);
        return renderLayout(res, 'Кошик', 'pages/cart', {
            cartLines: details.lines,
            cartTotal: details.total,
            cartCount: details.lines.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
            constructorNote,
            constructorPreview
        });
    } catch (err) {
        return res.status(500).send('помилка');
    }
};

const checkoutPage = async (req, res) => {
    try {
        const deliverySettingsRow = await DeliverySettings.get();
        const deliveryConfig = deliveryService.buildConfig(deliverySettingsRow);
        const currentUserId = getPageUserId(res);
        let checkoutProfile = null;
        if (currentUserId) {
            checkoutProfile = await UserModel.getUserid(currentUserId);
        }

        if (String(req.query.cart || '') === '1') {
            const cartItems = cartService.getCartFromRequest(req);
            const cartDetails = await cartService.buildCartDetails(cartItems);
            if (cartDetails.lines.length === 0) {
                return res.redirect('/cart');
            }

            return renderLayout(res, 'Оформлення замовлення', 'pages/checkout', {
                product: cartDetails.lines[0].product,
                upsells: [],
                cartMode: true,
                checkoutLines: cartDetails.lines,
                checkoutTotal: cartDetails.total,
                constructorNote: constructorService.getNoteFromRequest(req),
                constructorPreview: bouquetPreviewService.getPreviewFromRequest(req),
                googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
                deliveryConfig: deliveryConfig,
                checkoutProfile,
                turboVisitControl: 'reload'
            });
        }

        const rawId = req.query.product_id;
        let id = null;
        if (rawId !== undefined && rawId !== null && rawId !== '') {
            id = Number(rawId);
        }
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).send('помилка');
        }

        const product = await ProductModel.findById(id);
        if (!product || Number(product.is_active) === 0) {
            return res.status(404).send('Товар не знайдено');
        }

        if (Number(product.stock_quantity) <= 0) {
            return res.status(400).send('Товар недоступний для замовлення');
        }

        const rawUpsell = process.env.CHECKOUT_UPSELL_PRODUCT_IDS || '';
        const upsellIdList = rawUpsell
            .split(',')
            .map((s) => Number(String(s).trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        const upsells = await ProductModel.listForCheckoutUpsells(id, upsellIdList);

        return renderLayout(res, 'Оформлення замовлення', 'pages/checkout', {
            product,
            upsells,
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
            deliveryConfig: deliveryConfig,
            checkoutProfile,
            turboVisitControl: 'reload'
        });
    } catch (err) {
        console.error('checkoutPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const orderSuccessPage = async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        if (!orderId || orderId <= 0) {
            return res.status(404).send('Замовлення не знайдено');
        }

        const order = await OrderModel.getSummaryById(orderId);
        if (!order) {
            return res.status(404).send('Замовлення не знайдено');
        }

        let canSee = false;
        const currentUserId = getPageUserId(res);
        if (currentUserId && (await OrderModel.belongsToUser(orderId, currentUserId))) {
            canSee = true;
        } else {
            const tokenInfo = paymentToken.verify(req.query.t, orderId);
            const orderUid = order.user_id == null ? 0 : Number(order.user_id);
            if (tokenInfo && tokenInfo.userId === orderUid) {
                canSee = true;
            }
        }

        if (!canSee) {
            return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/'));
        }

        const tokenUid = order.user_id == null ? 0 : Number(order.user_id);
        const payToken = paymentToken.makeForOrder(order.id, tokenUid);

        let canCancel = false;
        const cancelRow = await OrderModel.getByIdForCancelCheck(orderId);
        if (cancelRow) {
            canCancel = orderCancelService.canCustomerRequestCancel(cancelRow);
        }

        return renderLayout(res, 'Замовлення прийнято', 'pages/order-success', {
            order: order,
            payToken: payToken,
            okFlag: req.query.ok || '',
            isGuestOrder: order.user_id == null,
            canCancel: canCancel
        });
    } catch (err) {
        console.error('orderSuccessPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const productPage = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(404).send('Товар не знайдено');
        }

        const product = await ProductModel.findById(id);
        if (!product || Number(product.is_active) === 0) {
            return res.status(404).send('Товар не знайдено');
        }

        if (Number(product.is_constructor) === 1) {
            return res.redirect('/constructor');
        }

        const reviews = await ReviewModel.listVisibleByProductId(id);

        await ReviewModel.syncAverageForProduct(id);
        const productFresh = await ProductModel.findById(id);

        return renderLayout(res, productFresh.name, 'pages/product', {
            product: productFresh,
            reviews
        });
    } catch (err) {
        return res.status(500).send('помилка');
    }
};

const adminDashboard = (req, res) => {
    return renderLayout(res, 'Адмін-панель', 'pages/admin/dashboard');
};

const warehouseOrdersPage = async (req, res) => {
    try {
        const day = typeof req.query.day === 'string' ? req.query.day.trim() : '';
        const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';
        const status_id = statusRaw !== '' ? Number(statusRaw) : null;
        const filterTab = typeof req.query.tab === 'string' ? req.query.tab.trim() : '';
        const viewRaw = typeof req.query.view === 'string' ? req.query.view.trim() : 'active';
        const isHistory = viewRaw === 'history';
        const historyFilter = typeof req.query.history === 'string' ? req.query.history.trim() : 'done';

        let rawOrders;
        if (isHistory) {
            rawOrders = await OrderModel.listForWarehouseHistory({
                day: day,
                history_filter: historyFilter
            });
        } else {
            rawOrders = await OrderModel.listForWarehouse({
                day: day,
                status_id: status_id
            });
        }
        const orders = filterWarehouseOrdersByTab(
            rawOrders.map((row) => mapOrderForWarehouse(row)),
            isHistory ? '' : filterTab
        );

        const statsRows = await OrderModel.listForWarehouseStats();
        const warehouseStats = buildWarehouseStats(statsRows);

        let filteredMaxId = 0;
        for (const row of orders) {
            const id = Number(row.id);
            if (Number.isFinite(id) && id > filteredMaxId) {
                filteredMaxId = id;
            }
        }

        const statuses = await StatusModel.listForWarehouse();
        const statusTransitions = await StatusModel.listTransitionsMap();
        const okCode = req.query.ok === '1' ? 'status_saved' : '';
        const errCode = typeof req.query.err === 'string' ? req.query.err.trim() : '';

        let successMessage = '';
        if (okCode === 'status_saved') {
            successMessage = 'Статус замовлення оновлено';
        } else if (req.query.ok === 'pickup_done') {
            successMessage = 'Самовивіз завершено';
        }

        const errorMap = {
            bad_order: 'Невірне замовлення',
            bad_status: 'Невірний статус',
            not_found: 'Замовлення не знайдено',
            status_unavailable: 'Статус недоступний',
            invalid_transition: 'Недопустимий перехід статусу',
            no_courier: 'Спочатку призначте кур\'єра (авто або адмін)',
            cancel_pending: 'Замовлення на скасуванні — чекайте рішення адміна',
            pickup_not_ready: 'Самовивіз можна завершити лише для готового замовлення',
            pickup_need_cod: 'Підтвердіть отримання оплати при видачі',
            pickup_not_paid: 'Замовлення не оплачене',
            use_pickup_complete: 'Для самовивозу скористайтеся кнопкою «Видано клієнту — завершити»',
            update_failed: 'Не вдалося оновити статус',
            server: 'Помилка сервера'
        };
        const errorMessage = errorMap[errCode] || '';

        return renderLayout(res, isHistory ? 'Історія замовлень складу' : 'Замовлення складу', 'pages/warehouse/orders', {
            orders,
            statuses,
            statusTransitions,
            successMessage,
            errorMessage,
            filterDay: day,
            filterStatus: statusRaw,
            filterTab: isHistory ? '' : filterTab,
            listView: isHistory ? 'history' : 'active',
            historyFilter: historyFilter,
            warehouseStats,
            pollListCount: orders.length,
            pollMaxOrderId: filteredMaxId
        });
    } catch (err) {
        console.error('warehouseOrdersPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const warehouseOrdersPoll = async (req, res) => {
    try {
        const day = typeof req.query.day === 'string' ? req.query.day.trim() : '';
        const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';
        const status_id = statusRaw !== '' ? Number(statusRaw) : null;
        const filterTab = typeof req.query.tab === 'string' ? req.query.tab.trim() : '';

        const statsRows = await OrderModel.listForWarehouseStats();
        const warehouseStats = buildWarehouseStats(statsRows);

        const filteredRows = filterWarehouseOrdersByTab(
            (await OrderModel.listForWarehouse({
                day: day,
                status_id: status_id
            })).map((row) => mapOrderForWarehouse(row)),
            filterTab
        );

        let filteredMaxId = 0;
        for (const row of filteredRows) {
            const id = Number(row.id);
            if (Number.isFinite(id) && id > filteredMaxId) {
                filteredMaxId = id;
            }
        }

        return res.json({
            stats: warehouseStats,
            list_count: filteredRows.length,
            max_order_id: filteredMaxId
        });
    } catch (err) {
        console.error('warehouseOrdersPoll:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const warehouseOrderDetailPage = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.status(404).send('Замовлення не знайдено');
        }

        const data = await OrderModel.getDetailForWarehouse(orderId);
        if (!data) {
            return res.status(404).send('Замовлення не знайдено');
        }

        const order = mapOrderForWarehouse(data.order);
        const statuses = await StatusModel.listForWarehouse();
        const statusTransitions = await StatusModel.listTransitionsMap();
        const statusLogs = await OrderStatusLogModel.listByOrderId(orderId);
        const errCode = typeof req.query.err === 'string' ? req.query.err.trim() : '';

        const host = req.get('host') || 'localhost:5000';
        const orderPageUrl = req.protocol + '://' + host + '/warehouse/orders/' + orderId;
        const qrImageUrl =
            'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(orderPageUrl);

        const errorMap = {
            bad_order: 'Невірне замовлення',
            bad_status: 'Невірний статус',
            status_unavailable: 'Статус недоступний',
            invalid_transition: 'Недопустимий перехід статусу',
            no_courier: 'Спочатку призначте кур\'єра (авто або адмін)',
            cancel_pending: 'Замовлення на скасуванні — чекайте рішення адміна',
            pickup_not_ready: 'Самовивіз можна завершити лише для готового замовлення',
            pickup_need_cod: 'Підтвердіть отримання оплати при видачі',
            pickup_not_paid: 'Замовлення не оплачене',
            use_pickup_complete: 'Для самовивозу скористайтеся кнопкою «Видано клієнту — завершити»',
            update_failed: 'Не вдалося оновити статус',
            server: 'Помилка сервера'
        };

        let successMessage = '';
        if (req.query.ok === '1') {
            successMessage = 'Статус оновлено';
        } else if (req.query.ok === 'pickup_done') {
            successMessage = 'Самовивіз завершено';
        }

        return renderLayout(res, 'Замовлення №' + orderId, 'pages/warehouse/order-detail', {
            order,
            items: data.items || [],
            statuses,
            statusTransitions,
            statusLogs,
            qrImageUrl,
            errorMessage: errorMap[errCode] || '',
            successMessage: successMessage
        });
    } catch (err) {
        console.error('warehouseOrderDetailPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const adminProductsList = async (req, res) => {
    try {
        const products = await ProductModel.allForAdmin();
        return renderLayout(res, 'Товари', 'pages/admin/products-list', {
            products
        });
    } catch (err) {
        console.error('adminProductsList:', err.message);
        return res.status(500).send('помилка');
    }
};

const catalogProductsJson = async (req, res) => {
    try {
        const rawCat = req.query.category_id;
        let selectedCategoryId = null;
        if (rawCat !== undefined && rawCat !== null && rawCat !== '') {
            const n = Number(rawCat);
            if (Number.isFinite(n) && n > 0) {
                selectedCategoryId = n;
            }
        }

        let searchQuery = '';
        const rawQ = req.query.q;
        if (rawQ !== undefined && rawQ !== null && rawQ !== '') {
            if (Array.isArray(rawQ)) {
                searchQuery = String(rawQ[0] ?? '').trim();
            } else {
                searchQuery = String(rawQ).trim();
            }
        }

        const categories = await CategoryModel.allCategories();

        const showHomeSections = !selectedCategoryId && !searchQuery;
        let hitProducts = [];
        let homeSections = [];
        let products = [];

        if (showHomeSections) {
            const homeData = await homeCatalogService.loadHomeCatalogData(categories);
            hitProducts = homeData.hitProducts;
            homeSections = homeData.homeSections;
            products = homeData.products;
        } else {
            products = await ProductModel.allProducts(selectedCategoryId, searchQuery);
        }

        return res.json({ products, hitProducts, homeSections });
    } catch (err) {
        return res.status(500).json({ message: 'Не вдалося завантажити товари' });
    }
};

module.exports = {
    home,
    catalogProductsJson,
    productPage,
    loginPage,
    accountBlockedPage,
    registerPage,
    privacyPage,
    deliveryTermsPage,
    logout,
    cabinetPage,
    cartPage,
    checkoutPage,
    orderSuccessPage,
    adminDashboard,
    adminProductsList,
    warehouseOrdersPage,
    warehouseOrdersPoll,
    warehouseOrderDetailPage
};

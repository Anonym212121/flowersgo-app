(function () {
    var ADMIN_VIEW_KEY = 'flowersgo_admin_view';

    var viewToBtnId = {
        dashboard: 'admin-show-dashboard',
        statistics: 'admin-show-statistics',
        'products-list': 'admin-show-list',
        'product-create': 'admin-show-create',
        'product-edit': 'admin-show-create',
        categories: 'admin-show-categories',
        'orders-pending': 'admin-show-orders-pending',
        'orders-awaiting': 'admin-show-orders-awaiting-payment',
        'orders-all': 'admin-show-orders-all',
        reviews: 'admin-show-reviews',
        users: 'admin-show-users',
        couriers: 'admin-show-couriers',
        delivery: 'admin-show-delivery',
        constructor: 'admin-show-constructor',
        legal: 'admin-show-legal',
        support: 'admin-show-support'
    };

    var viewToMenuMode = {
        dashboard: 'dashboard',
        statistics: 'statistics',
        'products-list': 'list',
        'product-create': 'create',
        'product-edit': 'create',
        categories: 'categories',
        'orders-pending': 'orders',
        'orders-awaiting': 'orders-awaiting',
        'orders-all': 'ordersAll',
        reviews: 'reviews',
        users: 'users',
        couriers: 'couriers',
        delivery: 'delivery',
        constructor: 'constructor',
        legal: 'legal',
        support: 'support'
    };

    window.getAdminSavedMenuMode = function () {
        if (typeof window.loadFormDraftView !== 'function') {
            return null;
        }
        var state = window.loadFormDraftView(ADMIN_VIEW_KEY);
        if (!state || !state.view) {
            return null;
        }
        return viewToMenuMode[state.view] || null;
    };

    window.applyAdminMenuHighlightFromStorage = function () {
        if (typeof window.loadFormDraftView !== 'function') {
            return;
        }
        var state = window.loadFormDraftView(ADMIN_VIEW_KEY);
        if (!state || !state.view) {
            return;
        }
        var mode = viewToMenuMode[state.view];
        if (window.adminNav && typeof window.adminNav.highlight === 'function' && mode) {
            window.adminNav.highlight(mode);
            return;
        }
        var btnId = viewToBtnId[state.view];
        if (!btnId) {
            return;
        }
        var btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.add('active');
        }
    };

    window.applyAdminMenuHighlightFromStorage();
})();

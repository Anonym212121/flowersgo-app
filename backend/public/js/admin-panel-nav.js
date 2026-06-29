(function () {
    var NAV_GROUPS_KEY = 'flowersgo_admin_nav_groups';

    var titles = {
        dashboard: { title: 'Огляд', subtitle: 'Статистика та швидкі дії' },
        statistics: { title: 'Статистика', subtitle: 'Аналітика продажів, замовлень і клієнтів' },
        list: { title: 'Товари', subtitle: 'Каталог, ціни та склад' },
        create: { title: 'Новий товар', subtitle: 'Додавання позиції в каталог' },
        categories: { title: 'Категорії', subtitle: 'Структура каталогу' },
        constructor: { title: 'Конструктор', subtitle: 'Квіти, кольори та шаблони букетів' },
        orders: { title: 'Модерація замовлень', subtitle: 'Нові замовлення на підтвердження' },
        'orders-awaiting': { title: 'Очікують оплату', subtitle: 'Замовлення без оплати в термін' },
        ordersAll: { title: 'Усі замовлення', subtitle: 'Повний список замовлень' },
        reviews: { title: 'Відгуки', subtitle: 'Модерація відгуків клієнтів' },
        users: { title: 'Користувачі', subtitle: 'Облікові записи та блокування' },
        support: { title: 'Підтримка', subtitle: 'Чати з клієнтами' },
        delivery: { title: 'Доставка', subtitle: 'Тарифи та правила доставки' },
        couriers: { title: "Кур'єри", subtitle: 'Команда доставки' },
        legal: { title: 'Юридичні сторінки', subtitle: 'Політика конфіденційності та умови' }
    };

    var groupByMode = {
        list: 'catalog',
        create: 'catalog',
        categories: 'catalog',
        constructor: 'catalog',
        orders: 'orders',
        'orders-awaiting': 'orders',
        ordersAll: 'orders',
        reviews: 'clients',
        users: 'clients',
        support: 'clients',
        delivery: 'settings',
        couriers: 'settings',
        legal: 'settings'
    };

    function readGroupState() {
        try {
            var raw = localStorage.getItem(NAV_GROUPS_KEY);
            if (!raw) {
                return {};
            }
            return JSON.parse(raw) || {};
        } catch (err) {
            return {};
        }
    }

    function saveGroupState(state) {
        try {
            localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(state));
        } catch (err) {
        }
    }

    function setBadge(id, count, warn) {
        var el = document.getElementById(id);
        if (!el) {
            return;
        }
        var n = Number(count);
        if (!Number.isFinite(n) || n <= 0) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = n > 99 ? '99+' : String(n);
        el.classList.toggle('admin-nav-badge--warn', !!warn);
    }

    function openGroup(name) {
        var group = document.querySelector('.admin-nav-group[data-nav-group="' + name + '"]');
        if (!group) {
            return;
        }
        group.classList.add('is-open');
        var toggle = group.querySelector('.admin-nav-group__toggle');
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'true');
        }
        var state = readGroupState();
        state[name] = true;
        saveGroupState(state);
    }

    function initNavGroups() {
        var saved = readGroupState();
        var groups = document.querySelectorAll('.admin-nav-group');

        for (var i = 0; i < groups.length; i += 1) {
            var group = groups[i];
            var key = group.getAttribute('data-nav-group');
            var toggle = group.querySelector('.admin-nav-group__toggle');
            if (!toggle || !key) {
                continue;
            }

            if (saved[key] === true) {
                group.classList.add('is-open');
                toggle.setAttribute('aria-expanded', 'true');
            } else if (saved[key] === false) {
                group.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
            }

            toggle.addEventListener('click', function () {
                var g = this.closest('.admin-nav-group');
                if (!g) {
                    return;
                }
                var k = g.getAttribute('data-nav-group');
                var open = !g.classList.contains('is-open');
                g.classList.toggle('is-open', open);
                this.setAttribute('aria-expanded', open ? 'true' : 'false');
                if (k) {
                    var st = readGroupState();
                    st[k] = open;
                    saveGroupState(st);
                }
            });
        }
    }

    function setWorkspaceHeader(mode) {
        var titleEl = document.getElementById('adminWorkspaceTitle');
        var subEl = document.getElementById('adminWorkspaceSubtitle');
        var info = titles[mode] || { title: 'Панель адміністратора', subtitle: '' };
        if (titleEl) {
            titleEl.textContent = info.title;
        }
        if (subEl) {
            subEl.textContent = info.subtitle;
        }
        setCrumb('');
    }

    function setCrumb(text) {
        var el = document.getElementById('adminWorkspaceCrumb');
        if (!el) {
            return;
        }
        var value = String(text || '').trim();
        if (!value) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = value;
    }

    function highlightNav(mode) {
        var nodes = document.querySelectorAll('[data-nav-mode]');
        for (var i = 0; i < nodes.length; i += 1) {
            var node = nodes[i];
            var active = node.getAttribute('data-nav-mode') === mode;
            node.classList.toggle('active', active);
        }

        var topDash = document.getElementById('admin-show-dashboard');
        var topStats = document.getElementById('admin-show-statistics');
        if (topDash) {
            topDash.classList.toggle('active', mode === 'dashboard');
        }
        if (topStats) {
            topStats.classList.toggle('active', mode === 'statistics');
        }

        var groupName = groupByMode[mode];
        if (groupName) {
            openGroup(groupName);
        }

        setWorkspaceHeader(mode);
    }

    async function refreshNavBadges(api) {
        if (!api || typeof api.apiFetch !== 'function') {
            return;
        }

        try {
            var dash = await api.apiFetch('/api/admin/dashboard');
            var stats = dash.stats || {};
            setBadge('admin-badge-orders-pending', stats.pending_orders);
            setBadge('admin-badge-orders-awaiting', stats.awaiting_payment);
            setBadge('admin-badge-reviews', stats.pending_reviews);
            setBadge('admin-badge-catalog-low', stats.low_stock_count, true);
            setBadge('admin-badge-orders-cancel', stats.cancel_requests, true);
            setBadge('admin-badge-couriers-unassigned', stats.unassigned_courier, true);
        } catch (err) {
        }

        try {
            var support = await api.apiFetch('/api/admin/support/chats/counts');
            var unread = Number(support.unread_count || support.open_count || 0);
            setBadge('admin-badge-support', unread, true);
        } catch (err) {
        }
    }

    window.adminNav = {
        highlight: highlightNav,
        refreshBadges: refreshNavBadges,
        setWorkspaceHeader: setWorkspaceHeader,
        setCrumb: setCrumb
    };

    initNavGroups();
})();

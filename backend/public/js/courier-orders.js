(function () {
    var page = document.getElementById('courierOrdersPage');
    if (!page) {
        return;
    }

    var dayFilter = page.getAttribute('data-day-filter') || '';
    var savedListCount = Number(page.getAttribute('data-list-count') || 0);
    var savedMaxId = Number(page.getAttribute('data-max-order-id') || 0);
    var listView = page.getAttribute('data-list-view') || 'active';

    if (listView === 'history') {
        return;
    }

    var hintEl = document.getElementById('courierPollHint');
    var pollTimer = null;
    var reloadTimer = null;
    var pollBusy = false;

    function userIsEditing() {
        var active = document.activeElement;
        if (!active) {
            return false;
        }
        var tag = active.tagName ? active.tagName.toLowerCase() : '';
        return tag === 'select' || tag === 'input' || tag === 'textarea';
    }

    function updateStatNumbers(stats) {
        if (!stats) {
            return;
        }
        var keys = ['total', 'today', 'soon', 'overdue'];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var el = document.querySelector('[data-stat="' + key + '"]');
            if (el && stats[key] !== undefined) {
                el.textContent = String(stats[key]);
            }
        }
    }

    function showRefreshHint() {
        if (hintEl) {
            hintEl.hidden = false;
        }
        if (reloadTimer) {
            clearTimeout(reloadTimer);
        }
        reloadTimer = setTimeout(function () {
            if (!userIsEditing() && !document.hidden) {
                window.location.reload();
            }
        }, 4000);
    }

    function pollOnce() {
        if (pollBusy || document.hidden || userIsEditing()) {
            return;
        }
        pollBusy = true;

        var url = '/courier/orders/poll';
        if (dayFilter) {
            url += '?day=' + encodeURIComponent(dayFilter);
        }

        fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'same-origin'
        })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error('poll failed');
                }
                return res.json();
            })
            .then(function (data) {
                if (data && data.stats) {
                    updateStatNumbers(data.stats);
                }

                var newCount = Number(data.list_count || 0);
                var newMaxId = Number(data.max_order_id || 0);

                if (newCount !== savedListCount || newMaxId !== savedMaxId) {
                    showRefreshHint();
                }
            })
            .catch(function () {})
            .finally(function () {
                pollBusy = false;
            });
    }

    document.querySelectorAll('.courier-finish-form').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            var btn = form.querySelector('button[type="submit"]');
            var label = btn ? btn.textContent.trim() : 'дію';
            if (!window.confirm('Підтвердити: ' + label + '?')) {
                e.preventDefault();
            }
        });
    });

    var refreshBtn = document.getElementById('courierPollRefresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            window.location.reload();
        });
    }

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            pollOnce();
        }
    });

    pollTimer = setInterval(pollOnce, 45000);
    setTimeout(pollOnce, 6000);
})();

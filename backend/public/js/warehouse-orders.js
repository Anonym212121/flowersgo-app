(function () {
    var page = document.getElementById('warehouseOrdersPage');
    if (!page) {
        return;
    }

    var dayFilter = page.getAttribute('data-day-filter') || '';
    var statusFilter = page.getAttribute('data-status-filter') || '';
    var tabFilter = page.getAttribute('data-tab-filter') || '';
    var savedListCount = Number(page.getAttribute('data-list-count') || 0);
    var savedMaxId = Number(page.getAttribute('data-max-order-id') || 0);

    var hintEl = document.getElementById('warehousePollHint');
    var refreshBtn = document.getElementById('warehousePollRefresh');
    var pollTimer = null;
    var reloadTimer = null;
    var pollBusy = false;

    function userIsEditing() {
        var active = document.activeElement;
        if (!active) {
            return false;
        }
        var tag = active.tagName ? active.tagName.toLowerCase() : '';
        if (tag === 'select' || tag === 'input' || tag === 'textarea') {
            return true;
        }
        return false;
    }

    function updateStatNumbers(stats) {
        if (!stats) {
            return;
        }
        var keys = ['total', 'today', 'express', 'soon', 'overdue', 'cancel_pending', 'unassigned_courier'];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var el = document.querySelector('[data-stat="' + key + '"]');
            if (el && stats[key] !== undefined) {
                el.textContent = String(stats[key]);
            }
        }
    }

    function showRefreshHint(autoReload) {
        if (!hintEl) {
            if (autoReload) {
                window.location.reload();
            }
            return;
        }
        hintEl.hidden = false;
        if (autoReload && !userIsEditing()) {
            hintEl.innerHTML =
                'Є нові зміни — оновлюю список… ' +
                '<button type="button" class="warehouse-poll-refresh" id="warehousePollRefresh">зараз</button>';
            var btn = document.getElementById('warehousePollRefresh');
            if (btn) {
                btn.addEventListener('click', function () {
                    window.location.reload();
                });
            }
            if (reloadTimer) {
                clearTimeout(reloadTimer);
            }
            reloadTimer = setTimeout(function () {
                if (!userIsEditing()) {
                    window.location.reload();
                }
            }, 3500);
        }
    }

    function buildPollUrl() {
        var parts = [];
        if (dayFilter) {
            parts.push('day=' + encodeURIComponent(dayFilter));
        }
        if (statusFilter) {
            parts.push('status=' + encodeURIComponent(statusFilter));
        }
        if (tabFilter) {
            parts.push('tab=' + encodeURIComponent(tabFilter));
        }
        var url = '/warehouse/orders/poll';
        if (parts.length > 0) {
            url += '?' + parts.join('&');
        }
        return url;
    }

    function pollOnce() {
        if (pollBusy || document.hidden || userIsEditing()) {
            return;
        }
        pollBusy = true;

        fetch(buildPollUrl(), {
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
                    showRefreshHint(true);
                }
            })
            .catch(function () {})
            .finally(function () {
                pollBusy = false;
            });
    }

    function startPoll() {
        if (pollTimer) {
            clearInterval(pollTimer);
        }
        pollTimer = setInterval(pollOnce, 30000);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            window.location.reload();
        });
    }

    document.querySelectorAll('.warehouse-handoff-form').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            if (!window.confirm('Підтвердити передачу букета кур\'єру?')) {
                e.preventDefault();
            }
        });
    });

    document.querySelectorAll('.warehouse-handoff-form--pickup').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            if (!window.confirm('Підтвердити видачу замовлення клієнту?')) {
                e.preventDefault();
            }
        });
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            pollOnce();
        }
    });

    startPoll();
    setTimeout(pollOnce, 5000);
})();

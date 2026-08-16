(function () {
    var page = document.getElementById('warehouseStockPage');
    if (!page) {
        return;
    }

    var statsRoot = document.getElementById('warehouseStockStats');
    var pollMs = 60000;
    var timer = null;
    var pollBusy = false;

    function updateStats(summary) {
        if (!statsRoot || !summary) {
            return;
        }
        var keys = ['total', 'low', 'zero', 'shortage', 'reserved'];
        for (var i = 0; i < keys.length; i += 1) {
            var key = keys[i];
            var el = statsRoot.querySelector('[data-stat="' + key + '"]');
            if (el && summary[key] != null) {
                el.textContent = String(summary[key]);
            }
        }
    }

    function poll() {
        if (pollBusy || document.hidden) {
            return;
        }
        pollBusy = true;
        fetch('/warehouse/stock/poll', { credentials: 'same-origin' })
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                if (data && data.ok && data.summary) {
                    updateStats(data.summary);
                }
            })
            .catch(function () {})
            .finally(function () {
                pollBusy = false;
            });
    }

    timer = setInterval(poll, pollMs);

    page.addEventListener('submit', function (e) {
        var form = e.target.closest('.warehouse-stock-adjust-form');
        if (!form) {
            return;
        }
        if (form.dataset.busy === '1') {
            e.preventDefault();
            return;
        }
        form.dataset.busy = '1';
        var btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = true;
        }
    });
})();

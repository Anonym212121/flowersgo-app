(function () {
    var page = document.getElementById('warehouseStockPage');
    if (!page) {
        return;
    }

    var statsRoot = document.getElementById('warehouseStockStats');
    var pollMs = 60000;
    var timer = null;

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
        fetch('/warehouse/stock/poll', { credentials: 'same-origin' })
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                if (data && data.ok && data.summary) {
                    updateStats(data.summary);
                }
            })
            .catch(function () {});
    }

    timer = setInterval(poll, pollMs);
})();

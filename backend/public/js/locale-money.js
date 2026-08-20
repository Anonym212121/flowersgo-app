(function () {
    window.formatMoney = function (uah) {
        var n = Number(uah);
        if (!Number.isFinite(n)) {
            n = 0;
        }
        var loc = window.__locale || {};
        if (loc.lang === 'en') {
            var rate = Number(loc.usdRate);
            if (!Number.isFinite(rate) || rate <= 0) {
                rate = 41.5;
            }
            return '$' + (n / rate).toFixed(2);
        }
        return n.toLocaleString('uk-UA') + ' грн';
    };

    window.t = function (key, vars) {
        var loc = window.__locale || {};
        var dict = loc.t || {};
        var text = dict[key] ? dict[key] : key;
        if (vars && typeof vars === 'object') {
            var names = Object.keys(vars);
            var i = 0;
            while (i < names.length) {
                var name = names[i];
                text = String(text).split('{{' + name + '}}').join(String(vars[name]));
                i += 1;
            }
        }
        return text;
    };
})();

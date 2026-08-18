(function () {
    var storageKey = 'site-lang';
    var toggle = document.getElementById('langToggle');

    function setCookie(lang) {
        document.cookie = 'site_lang=' + encodeURIComponent(lang) + ';path=/;max-age=31536000;SameSite=Lax';
    }

    function currentLang() {
        try {
            var stored = localStorage.getItem(storageKey);
            if (stored === 'en' || stored === 'uk') {
                return stored;
            }
        } catch (err) {
        }
        return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'uk';
    }

    function apply(lang, reload) {
        var next = lang === 'en' ? 'en' : 'uk';
        try {
            localStorage.setItem(storageKey, next);
        } catch (err) {
        }
        setCookie(next);
        if (toggle) {
            toggle.checked = next === 'en';
        }
        if (reload) {
            window.location.reload();
        }
    }

    if (toggle) {
        toggle.checked = currentLang() === 'en';
        toggle.addEventListener('change', function () {
            apply(toggle.checked ? 'en' : 'uk', true);
        });
    }
})();

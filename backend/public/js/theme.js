(function () {
    var storageKey = 'site-theme';
    var root = document.documentElement;
    var toggle = document.getElementById('themeToggle');

    function setLight(on) {
        if (on) {
            root.classList.add('theme-light');
        } else {
            root.classList.remove('theme-light');
        }

        try {
            localStorage.setItem(storageKey, on ? 'light' : 'dark');
        } catch (err) {
        }

        if (toggle) {
            toggle.checked = !!on;
        }
    }

    if (toggle) {
        toggle.checked = root.classList.contains('theme-light');
        toggle.addEventListener('change', function () {
            setLight(toggle.checked);
        });
    }
})();

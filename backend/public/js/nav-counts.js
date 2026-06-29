(function () {
    function formatCount(value) {
        var n = Number(value);
        if (!Number.isFinite(n) || n <= 0) {
            return '';
        }
        if (n > 99) {
            return '99+';
        }
        return String(n);
    }

    function setBadge(id, count) {
        var el = document.getElementById(id);
        if (!el) {
            return;
        }
        var label = formatCount(count);
        if (!label) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = label;
    }

    window.updateNavCartCount = function (count) {
        setBadge('navCartBadge', count);
    };

    window.updateNavWishlistCount = function (count) {
        setBadge('navWishlistBadge', count);
    };

    window.updateNavCounts = function (data) {
        if (!data) {
            return;
        }
        if (data.cart != null) {
            window.updateNavCartCount(data.cart);
        }
        if (data.wishlist != null) {
            window.updateNavWishlistCount(data.wishlist);
        }
    };
})();

(function () {
    function getRedirectUrl(roleName, authNext) {
        if (authNext && authNext.startsWith('/')) {
            return authNext;
        }
        if (roleName === 'admin') {
            return '/admin';
        }
        if (roleName === 'warehouse_worker') {
            return '/warehouse/orders';
        }
        if (roleName === 'courier') {
            return '/courier/orders';
        }
        return '/';
    }

    function showAuthError(text, isHtml) {
        var el = document.getElementById('authError');
        if (!el) {
            return;
        }
        if (isHtml) {
            el.innerHTML = text;
        } else {
            el.textContent = text;
        }
    }

    window.initGoogleAuthButton = function (options) {
        var cfg = options || {};
        var clientId = cfg.clientId || '';
        var authNext = cfg.authNext || '';
        var container = document.getElementById(cfg.containerId || 'googleSignInBtn');
        if (!clientId || !container) {
            return;
        }

        var start = function () {
            if (!window.google || !google.accounts || !google.accounts.id) {
                return;
            }

            google.accounts.id.initialize({
                client_id: clientId,
                callback: function (response) {
                    var credential = response && response.credential ? response.credential : '';
                    if (!credential) {
                        showAuthError('Google не повернув дані для входу');
                        return;
                    }

                    fetch('/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ credential: credential })
                    })
                        .then(function (res) {
                            return res.json().then(function (data) {
                                if (!res.ok) {
                                    throw data;
                                }
                                return data;
                            });
                        })
                        .then(function (data) {
                            var roleName =
                                data && data.user && data.user.role_name ? data.user.role_name : '';
                            window.location.href = getRedirectUrl(roleName, authNext);
                        })
                        .catch(function (err) {
                            var msg =
                                err && err.message ? err.message : 'Не вдалося увійти через Google';
                            if (err && err.blocked) {
                                showAuthError(
                                    msg +
                                        ' <a href="/account-blocked" class="auth-error-link">Дізнатися причину</a>',
                                    true
                                );
                                return;
                            }
                            showAuthError(msg, false);
                        });
                }
            });

            google.accounts.id.renderButton(container, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                width: 320
            });
        };

        if (window.google && google.accounts && google.accounts.id) {
            start();
            return;
        }

        var existing = document.getElementById('google-gsi-script');
        if (existing) {
            existing.addEventListener('load', start);
            return;
        }

        var script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = start;
        document.head.appendChild(script);
    };
})();

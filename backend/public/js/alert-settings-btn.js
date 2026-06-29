(function () {
    const renderToggleRow = (id, title, hint, checked, disabled) => {
        const disabledAttr = disabled ? ' disabled' : '';
        const checkedAttr = checked ? ' checked' : '';
        return (
            '<label class="alert-toggle" for="' + id + '">' +
            '<span class="alert-toggle__text">' +
            '<span class="alert-toggle__title">' + title + '</span>' +
            '<span class="alert-toggle__hint">' + hint + '</span>' +
            '</span>' +
            '<input type="checkbox" class="alert-toggle__input" id="' + id + '"' + checkedAttr + disabledAttr + '>' +
            '<span class="alert-toggle__ui" aria-hidden="true"></span>' +
            '</label>'
        );
    };

    const renderAlertSettings = (container) => {
        if (!container || !window.SiteAlerts) {
            return;
        }

        const prefix = container.id ? container.id : 'alert-settings';
        const soundId = prefix + '-sound';
        const pushId = prefix + '-push';

        const soundOn = window.SiteAlerts.isSoundOn();
        const pushOn = window.SiteAlerts.isPushOn();
        const perm = window.SiteAlerts.pushPermission();
        const pushBlocked = perm === 'denied';
        const pushChecked = perm === 'granted' && pushOn;

        let noteHtml = '';
        if (pushBlocked) {
            noteHtml = '<p class="alert-toggles__note">Push заблоковано в браузері. Дозвольте сповіщення в налаштуваннях сайту.</p>';
        } else if (perm !== 'granted') {
            noteHtml = '<p class="alert-toggles__note">Увімкніть push — браузер запитає дозвіл.</p>';
        }

        container.innerHTML =
            '<div class="alert-toggles">' +
            renderToggleRow(soundId, 'Звук', 'Короткий сигнал на сайті', soundOn, false) +
            renderToggleRow(pushId, 'Push', 'Сповіщення на пристрій', pushChecked, pushBlocked) +
            noteHtml +
            '</div>';

        const soundInput = container.querySelector('#' + soundId);
        const pushInput = container.querySelector('#' + pushId);

        if (soundInput) {
            soundInput.addEventListener('change', () => {
                window.SiteAlerts.setSoundOn(soundInput.checked);
                if (soundInput.checked && typeof window.SiteAlerts.playSound === 'function') {
                    window.SiteAlerts.playSound();
                }
            });
        }

        if (pushInput) {
            pushInput.addEventListener('change', async () => {
                if (!pushInput.checked) {
                    window.SiteAlerts.setPushOn(false);
                    renderAlertSettings(container);
                    return;
                }

                if (window.SiteAlerts.pushPermission() !== 'granted') {
                    const ok = await window.SiteAlerts.requestPushPermission();
                    if (!ok) {
                        pushInput.checked = false;
                        window.SiteAlerts.setPushOn(false);
                        renderAlertSettings(container);
                        if (typeof window.showToast === 'function') {
                            window.showToast('Push не увімкнено — перевірте дозволи браузера', 'error');
                        }
                        return;
                    }
                }

                window.SiteAlerts.setPushOn(true);
                renderAlertSettings(container);
                if (typeof window.showToast === 'function') {
                    window.showToast('Push-сповіщення увімкнено', 'ok');
                }
            });
        }
    };

    window.renderAlertSettingsBtn = renderAlertSettings;
})();

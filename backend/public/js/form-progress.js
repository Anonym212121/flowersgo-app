(function () {
    function markCurrentStep(el, keepMs) {
        if (!el) {
            return;
        }
        el.classList.add('form-step-current');
        window.setTimeout(function () {
            el.classList.remove('form-step-current');
        }, keepMs || 2800);
    }

    function markCurrentField(labelEl, inputEl, keepMs) {
        if (!labelEl) {
            return;
        }
        labelEl.classList.add('form-field-current');
        window.setTimeout(function () {
            labelEl.classList.remove('form-field-current');
        }, keepMs || 3500);
        if (inputEl && typeof inputEl.focus === 'function') {
            window.setTimeout(function () {
                try {
                    inputEl.focus({ preventScroll: true });
                } catch (e) {
                    inputEl.focus();
                }
            }, 180);
        }
    }

    window.highlightFormField = function (labelEl, inputEl, keepMs) {
        markCurrentField(labelEl, inputEl, keepMs);
    };

    window.resumeFormFields = function (opts) {
        if (!opts || !opts.form || !Array.isArray(opts.steps)) {
            return null;
        }

        var form = opts.form;
        var steps = opts.steps;
        var getLabel = opts.getLabel;

        for (var i = 0; i < steps.length; i += 1) {
            var step = steps[i];
            var input = form.elements[step.name];
            if (!input) {
                continue;
            }

            var val = input.type === 'checkbox' ? input.checked : input.value;
            var ok = typeof step.check === 'function' ? step.check(val, form) : !!String(val || '').trim();

            if (!ok) {
                var label =
                    typeof getLabel === 'function'
                        ? getLabel(input, step)
                        : input.closest('.auth-label') ||
                          input.closest('.cabinet-mini-label') ||
                          input.closest('label');
                markCurrentField(label, input.type === 'checkbox' ? input : input, 3500);
                window.setTimeout(function () {
                    if (label) {
                        label.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 120);

                var stepTitle = step.title || step.name;
                var message = opts.message;
                if (!message) {
                    message = (opts.messagePrefix || 'Продовжуй з поля: ') + stepTitle;
                }

                if (typeof window.showToast === 'function') {
                    window.showToast(message, 'info');
                }

                return step;
            }
        }

        return null;
    };

    window.restoreFormProgress = function (opts) {
        if (!opts || !opts.restored) {
            return;
        }

        if (opts.form && opts.steps) {
            window.resumeFormFields(opts);
            return;
        }

        var target = opts.targetEl || null;
        var message = opts.message || 'Продовжуємо — дані відновлено';

        if (target) {
            markCurrentStep(target);
            window.setTimeout(function () {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 120);
        }

        if (typeof window.showToast === 'function') {
            window.showToast(message, 'info');
        }
    };

    window.highlightFirstEmptyInBlock = function (block, opts) {
        if (!block) {
            return null;
        }

        var selector = 'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select, textarea';
        var inputs = block.querySelectorAll(selector);
        var optsSafe = opts || {};

        for (var i = 0; i < inputs.length; i += 1) {
            var input = inputs[i];
            if (input.disabled || input.hidden) {
                continue;
            }
            if (input.closest('[hidden]')) {
                continue;
            }
            if (input.type === 'checkbox') {
                continue;
            }
            if (!input.required) {
                continue;
            }

            var val = String(input.value || '').trim();
            if (val !== '') {
                continue;
            }

            var label = input.closest('.auth-label') || input.closest('label') || input.closest('.cabinet-mini-label');
            markCurrentField(label, input, 3500);
            window.setTimeout(function () {
                if (label) {
                    label.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 120);

            if (typeof window.showToast === 'function') {
                var msg = optsSafe.message;
                if (!msg && label) {
                    var text = label.querySelector('span, .checkout-step-heading');
                    msg = 'Заповни: ' + (text ? text.textContent.trim() : 'наступне поле');
                }
                window.showToast(msg || 'Продовжуй заповнення форми', 'info');
            }

            return input;
        }

        return null;
    };

    var SKIP_FIELD_TYPES = { file: true, password: true };
    var SKIP_FIELD_NAMES = {
        password: true,
        password_confirm: true,
        new_password: true,
        new_password_confirm: true
    };

    function getDraftStorage(type) {
        if (type === 'session') {
            return window.sessionStorage;
        }
        return window.localStorage;
    }

    function defaultDraftExclude(el) {
        if (!el || !el.name) {
            return true;
        }
        if (SKIP_FIELD_TYPES[el.type]) {
            return true;
        }
        if (SKIP_FIELD_NAMES[el.name]) {
            return true;
        }
        return false;
    }

    function collectFormDraft(form, exclude) {
        var data = {};
        var els = form.querySelectorAll('input, select, textarea');
        for (var i = 0; i < els.length; i += 1) {
            var el = els[i];
            if (el.disabled || exclude(el)) {
                continue;
            }
            if (el.type === 'checkbox') {
                data[el.name] = el.checked ? '1' : '';
            } else if (el.type === 'radio') {
                if (el.checked) {
                    data[el.name] = el.value;
                }
            } else {
                data[el.name] = el.value;
            }
        }
        return data;
    }

    function applyFormDraft(form, data, exclude) {
        var names = Object.keys(data);
        for (var n = 0; n < names.length; n += 1) {
            var name = names[n];
            var el = form.elements[name];
            if (!el) {
                continue;
            }

            if (el.length && el[0] && el[0].type === 'radio') {
                for (var r = 0; r < el.length; r += 1) {
                    if (exclude(el[r])) {
                        continue;
                    }
                    el[r].checked = String(el[r].value) === String(data[name]);
                }
                continue;
            }

            if (exclude(el)) {
                continue;
            }
            if (el.type === 'checkbox') {
                el.checked = data[name] === '1' || data[name] === true;
            } else if (el.type !== 'file') {
                el.value = data[name] != null ? String(data[name]) : '';
            }
        }

        var changed = form.querySelectorAll('input, select, textarea');
        for (var j = 0; j < changed.length; j += 1) {
            changed[j].dispatchEvent(new Event('input', { bubbles: true }));
            changed[j].dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function hasDraftData(data) {
        var keys = Object.keys(data || {});
        for (var i = 0; i < keys.length; i += 1) {
            if (String(data[keys[i]] || '').trim() !== '') {
                return true;
            }
        }
        return false;
    }

    window.saveFormDraftView = function (key, state) {
        try {
            window.sessionStorage.setItem(key, JSON.stringify(state));
        } catch (e) {}
    };

    window.loadFormDraftView = function (key) {
        try {
            var raw = window.sessionStorage.getItem(key);
            if (!raw) {
                return null;
            }
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    };

    window.clearFormDraftView = function (key) {
        try {
            window.sessionStorage.removeItem(key);
        } catch (e) {}
    };

    window.bindFormDraft = function (form, opts) {
        if (!form || !opts || !opts.key) {
            return { clear: function () {}, destroy: function () {}, save: function () {}, restored: false };
        }

        if (form._formDraftHandle && typeof form._formDraftHandle.destroy === 'function') {
            form._formDraftHandle.destroy();
        }

        var storage = getDraftStorage(opts.storage || 'local');
        var key = opts.key;
        var exclude = typeof opts.exclude === 'function' ? opts.exclude : defaultDraftExclude;
        var timer = null;

        function save() {
            try {
                var data = collectFormDraft(form, exclude);
                if (!hasDraftData(data)) {
                    storage.removeItem(key);
                    return;
                }
                storage.setItem(key, JSON.stringify(data));
            } catch (e) {}
        }

        function clear() {
            try {
                storage.removeItem(key);
            } catch (e) {}
        }

        function restore() {
            try {
                var raw = storage.getItem(key);
                if (!raw) {
                    return false;
                }
                var data = JSON.parse(raw);
                if (!hasDraftData(data)) {
                    return false;
                }
                applyFormDraft(form, data, exclude);
                if (opts.notify !== false && typeof window.showToast === 'function') {
                    window.showToast(opts.notifyMessage || 'Чернетку форми відновлено', 'info');
                }
                if (typeof opts.onRestore === 'function') {
                    opts.onRestore(data);
                }
                return true;
            } catch (e) {
                return false;
            }
        }

        function onChange() {
            clearTimeout(timer);
            timer = setTimeout(save, 280);
        }

        form.addEventListener('input', onChange);
        form.addEventListener('change', onChange);
        if (opts.clearOnSubmit === true) {
            form.addEventListener('submit', function () {
                clear();
            });
        }

        var restored = false;
        if (opts.restore !== false) {
            restored = restore();
        }

        var handle = {
            clear: clear,
            save: save,
            restore: restore,
            restored: restored,
            destroy: function () {
                clearTimeout(timer);
                form.removeEventListener('input', onChange);
                form.removeEventListener('change', onChange);
                if (form._formDraftHandle === handle) {
                    form._formDraftHandle = null;
                }
            }
        };

        form._formDraftHandle = handle;
        return handle;
    };

    function initAutoDraftForms() {
        var forms = document.querySelectorAll('form[data-form-draft]');
        for (var i = 0; i < forms.length; i += 1) {
            var form = forms[i];
            var key = form.getAttribute('data-form-draft');
            if (!key) {
                continue;
            }
            var storage = form.getAttribute('data-form-draft-storage') || 'local';
            var message = form.getAttribute('data-form-draft-message') || 'Чернетку форми відновлено';
            window.bindFormDraft(form, {
                key: key,
                storage: storage,
                notifyMessage: message,
                clearOnSubmit: true
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAutoDraftForms);
    } else {
        initAutoDraftForms();
    }
})();

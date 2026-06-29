(function () {
    var stack = null;
    var hideMs = 4000;

    function getStack() {
        if (stack) {
            return stack;
        }
        stack = document.getElementById('toastStack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'toastStack';
            stack.className = 'toast-stack';
            stack.setAttribute('aria-live', 'polite');
            document.body.appendChild(stack);
        }
        return stack;
    }

    function closeToast(item) {
        if (!item || !item.parentNode) {
            return;
        }
        item.classList.add('toast-item--hide');
        window.setTimeout(function () {
            if (item.parentNode) {
                item.parentNode.removeChild(item);
            }
        }, 240);
    }

    window.showToast = function (text, type) {
        var msg = String(text || '').trim();
        if (!msg) {
            return;
        }

        var kind = 'ok';
        if (type === 'error') {
            kind = 'error';
        } else if (type === 'info') {
            kind = 'info';
        }

        var box = getStack();
        var item = document.createElement('div');
        item.className = 'toast-item toast-item--' + kind;
        item.setAttribute('role', 'status');

        var iconText = '✓';
        if (kind === 'error') {
            iconText = '!';
        } else if (kind === 'info') {
            iconText = 'i';
        }

        var icon = document.createElement('span');
        icon.className = 'toast-item__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = iconText;

        var body = document.createElement('span');
        body.className = 'toast-item__text';
        body.textContent = msg;

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'toast-item__close';
        closeBtn.setAttribute('aria-label', 'Закрити');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', function () {
            closeToast(item);
        });

        item.appendChild(icon);
        item.appendChild(body);
        item.appendChild(closeBtn);
        box.appendChild(item);

        while (box.children.length > 4) {
            closeToast(box.firstElementChild);
        }

        window.setTimeout(function () {
            closeToast(item);
        }, hideMs);
    };
})();

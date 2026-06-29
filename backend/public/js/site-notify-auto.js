(function () {
    const POLL_MS = 8000;
    const tasks = [];
    let busy = false;
    let timer = null;

    const tick = async () => {
        if (busy || document.hidden) {
            return;
        }
        busy = true;
        try {
            for (let i = 0; i < tasks.length; i += 1) {
                try {
                    await tasks[i].fn();
                } catch (e) {
                }
            }
        } finally {
            busy = false;
        }
    };

    const startTimer = () => {
        if (timer) {
            clearInterval(timer);
        }
        timer = setInterval(tick, POLL_MS);
    };

    window.SiteNotifyAuto = {
        POLL_MS: POLL_MS,
        register: (name, fn) => {
            if (typeof fn !== 'function') {
                return;
            }
            const key = name || 'task-' + tasks.length;
            for (let i = 0; i < tasks.length; i += 1) {
                if (tasks[i].name === key) {
                    tasks[i].fn = fn;
                    return;
                }
            }
            tasks.push({ name: key, fn: fn });
        },
        refresh: tick,
        start: startTimer
    };

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            tick();
        }
    });

    window.addEventListener('focus', tick);

    startTimer();
    setTimeout(tick, 2500);
})();

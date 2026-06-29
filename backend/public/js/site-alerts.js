(function () {
    const KEY_SOUND = 'flowersgo_alert_sound';
    const KEY_PUSH = 'flowersgo_alert_push';
    const KEY_ASKED = 'flowersgo_alert_push_asked';

    let audioCtx = null;
    const prevCounts = {
        notifications: 0,
        support: 0
    };

    const isSoundOn = () => {
        try {
            return localStorage.getItem(KEY_SOUND) !== '0';
        } catch (e) {
            return true;
        }
    };

    const isPushOn = () => {
        try {
            return localStorage.getItem(KEY_PUSH) !== '0';
        } catch (e) {
            return true;
        }
    };

    const setSoundOn = (on) => {
        try {
            localStorage.setItem(KEY_SOUND, on ? '1' : '0');
        } catch (e) {}
    };

    const setPushOn = (on) => {
        try {
            localStorage.setItem(KEY_PUSH, on ? '1' : '0');
        } catch (e) {}
    };

    const playSound = () => {
        if (!isSoundOn()) {
            return;
        }
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) {
                return;
            }
            if (!audioCtx) {
                audioCtx = new Ctx();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.36);
        } catch (e) {
        }
    };

    const canUsePush = () => {
        return typeof window !== 'undefined' && 'Notification' in window;
    };

    const pushPermission = () => {
        if (!canUsePush()) {
            return 'unsupported';
        }
        return Notification.permission;
    };

    const requestPushPermission = async () => {
        if (!canUsePush()) {
            return false;
        }
        if (Notification.permission === 'granted') {
            setPushOn(true);
            return true;
        }
        if (Notification.permission === 'denied') {
            return false;
        }
        try {
            localStorage.setItem(KEY_ASKED, '1');
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                setPushOn(true);
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    };

    const showPush = (title, body, link) => {
        if (!isPushOn() || !canUsePush() || Notification.permission !== 'granted') {
            return;
        }
        try {
            const note = new Notification(title || 'FlowersGo', {
                body: body || '',
                icon: '/favicon.svg',
                tag: 'flowersgo-alert-' + Date.now()
            });
            note.onclick = () => {
                window.focus();
                if (link) {
                    window.location.href = link;
                }
                note.close();
            };
        } catch (e) {
        }
    };

    const notify = (opts) => {
        const title = opts && opts.title ? opts.title : 'FlowersGo';
        const body = opts && opts.body ? opts.body : '';
        const link = opts && opts.link ? opts.link : null;
        const silent = opts && opts.silent;

        if (!silent) {
            playSound();
        }
        showPush(title, body, link);

        if (typeof window.showToast === 'function' && body) {
            window.showToast(body, 'ok');
        }
    };

    const onCountIncrease = (key, newCount, meta) => {
        const old = Number(prevCounts[key]) || 0;
        const next = Number(newCount) || 0;
        prevCounts[key] = next;
        if (next > old && old >= 0) {
            notify({
                title: meta && meta.title ? meta.title : 'FlowersGo',
                body: meta && meta.body ? meta.body : 'Нове сповіщення',
                link: meta && meta.link ? meta.link : null
            });
        }
    };

    const setInitialCount = (key, count) => {
        prevCounts[key] = Number(count) || 0;
    };

    const maybeAskPush = () => {
        if (!canUsePush() || Notification.permission !== 'default') {
            return;
        }
        try {
            if (localStorage.getItem(KEY_ASKED) === '1') {
                return;
            }
        } catch (e) {
            return;
        }
        if (typeof window.showToast === 'function') {
            window.showToast('Увімкніть push-сповіщення в меню підтримки або дзвіночку 🔔', 'ok');
        }
    };

    window.SiteAlerts = {
        notify: notify,
        playSound: playSound,
        onCountIncrease: onCountIncrease,
        setInitialCount: setInitialCount,
        requestPushPermission: requestPushPermission,
        maybeAskPush: maybeAskPush,
        isSoundOn: isSoundOn,
        isPushOn: isPushOn,
        setSoundOn: setSoundOn,
        setPushOn: setPushOn,
        pushPermission: pushPermission,
        canUsePush: canUsePush
    };
})();

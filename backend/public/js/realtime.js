(function () {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + window.location.host + '/ws';
    let socket = null;
    let retry = 0;
    let timer = null;

    const emit = (data) => {
        document.dispatchEvent(new CustomEvent('realtime:message', { detail: data }));
    };

    const connect = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        try {
            socket = new WebSocket(url);
        } catch (err) {
            scheduleReconnect();
            return;
        }

        socket.addEventListener('open', () => {
            retry = 0;
            window.__realtimeLive = true;
        });

        socket.addEventListener('message', (event) => {
            let data = null;
            try {
                data = JSON.parse(event.data);
            } catch (err) {
                return;
            }
            if (data && data.type) {
                emit(data);
            }
        });

        socket.addEventListener('close', () => {
            window.__realtimeLive = false;
            scheduleReconnect();
        });
        socket.addEventListener('error', () => {
            try {
                socket.close();
            } catch (err) {
            }
        });
    };

    const scheduleReconnect = () => {
        if (timer) {
            return;
        }
        retry = Math.min(retry + 1, 8);
        timer = setTimeout(connect, 1000 * retry);
    };

    connect();
})();

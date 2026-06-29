const buildDeliveryTariffsHtml = (delivery) => {
    const cfg = delivery || {};
    const fees = cfg.fees || {};
    const feeStandard = Number(fees.standard) || 0;
    const feeExact = Number(fees.exact) || 0;
    const feeExpress = Number(fees.express) || 0;
    const feePickup = Number(fees.pickup) || 0;
    const workStart = cfg.workStartHour != null ? cfg.workStartHour : 9;
    const workEnd = cfg.workEndHour != null ? cfg.workEndHour : 23;
    const pickupStart = cfg.pickupStartHour != null ? cfg.pickupStartHour : 9;
    const pickupEnd = cfg.pickupEndHour != null ? cfg.pickupEndHour : 19;
    const standardBuffer = cfg.standardBufferMin != null ? cfg.standardBufferMin : 120;
    const expressBuffer = cfg.expressBufferMin != null ? cfg.expressBufferMin : 60;

    const priceLabel = (val, plus) => {
        if (val === 0) {
            return 'Безкоштовно';
        }
        if (plus) {
            return '+' + val + ' грн';
        }
        return val + ' грн';
    };

    return `
        <div class="info-page__cards">
            <div class="info-page__card">
                <h3>Стандартна</h3>
                <p>Двогодинне вікно на обрану дату. Мінімальний час підготовки — ${standardBuffer} хв від моменту замовлення.</p>
                <p class="info-page__price">${priceLabel(feeStandard, false)}</p>
            </div>
            <div class="info-page__card">
                <h3>В точний час</h3>
                <p>Кур'єр намагається приїхати у вказаний час у межах ${workStart}:00–${workEnd}:00.</p>
                <p class="info-page__price">${priceLabel(feeExact, true)}</p>
            </div>
            <div class="info-page__card">
                <h3>Експрес</h3>
                <p>Збираємо і веземо якнайшвидше — орієнтовно протягом ${expressBuffer} хв після підтвердження.</p>
                <p class="info-page__price">${priceLabel(feeExpress, true)}</p>
            </div>
            <div class="info-page__card">
                <h3>Самовивіз</h3>
                <p>Забрати замовлення можна з ${pickupStart}:00 до ${pickupEnd}:00 за попередньою домовленістю.</p>
                <p class="info-page__price">${priceLabel(feePickup, false)}</p>
            </div>
        </div>`;
};

const renderLegalBody = (bodyHtml, slug, context) => {
    let html = typeof bodyHtml === 'string' ? bodyHtml : '';
    const ctx = context || {};

    if (slug === 'delivery-terms') {
        html = html.replace('<!--DELIVERY_TARIFFS-->', buildDeliveryTariffsHtml(ctx.delivery));
        html = html.replace(/\{\{PAYMENT_WINDOW\}\}/g, String(ctx.paymentWindowMin || 30));
        html = html.replace(/\{\{WORK_START\}\}/g, String(ctx.delivery && ctx.delivery.workStartHour != null ? ctx.delivery.workStartHour : 9));
        html = html.replace(/\{\{WORK_END\}\}/g, String(ctx.delivery && ctx.delivery.workEndHour != null ? ctx.delivery.workEndHour : 23));
        html = html.replace(/\{\{SLOT_HOURS\}\}/g, String(ctx.delivery && ctx.delivery.slotHours != null ? ctx.delivery.slotHours : 2));
    }

    return html;
};

module.exports = {
    renderLegalBody,
    buildDeliveryTariffsHtml
};

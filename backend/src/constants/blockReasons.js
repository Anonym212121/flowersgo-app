const BLOCK_REASONS = [
    { key: 'terms_violation', label: 'Порушення правил сервісу' },
    { key: 'fraud', label: 'Підозра в шахрайстві або зловживаннях' },
    { key: 'abusive', label: 'Образи або агресивна поведінка' },
    { key: 'spam', label: 'Спам у відгуках або повідомленнях' },
    { key: 'duplicate_accounts', label: 'Кілька акаунтів однієї людини' },
    { key: 'chargeback', label: 'Спірна оплата або чарджбек' },
    { key: 'unpaid_orders', label: 'Систематичні неоплачені замовлення' },
    { key: 'fake_profile', label: 'Недостовірні дані в профілі' },
    { key: 'delivery_abuse', label: 'Зловживання доставкою або поверненнями' },
    { key: 'other', label: 'Інша причина' }
];

const getBlockReasonText = (key, customText) => {
    if (key === 'other') {
        const t = typeof customText === 'string' ? customText.trim() : '';
        return t || 'Інша причина';
    }

    for (let i = 0; i < BLOCK_REASONS.length; i++) {
        if (BLOCK_REASONS[i].key === key) {
            return BLOCK_REASONS[i].label;
        }
    }

    return 'Акаунт заблоковано';
};

module.exports = {
    BLOCK_REASONS,
    getBlockReasonText
};

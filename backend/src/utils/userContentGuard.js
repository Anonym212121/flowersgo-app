const sanitizeUserText = require('./sanitizeUserText');
const { looksLikeSpam, looksLikeAttack, hasProfanity } = require('./spamText');

const checkUserContent = (raw, options) => {
    const opts = options && typeof options === 'object' ? options : {};
    const maxLen = Number(opts.maxLen) > 0 ? Number(opts.maxLen) : 2000;
    const minLen = Number.isFinite(Number(opts.minLen)) ? Number(opts.minLen) : 0;
    const skipSpam = opts.skipSpam === true;
    const skipProfanity = opts.skipProfanity === true;

    const text = sanitizeUserText(raw, maxLen);

    if (minLen > 0 && text.length < minLen) {
        return {
            ok: false,
            code: 'short',
            message: 'Текст занадто короткий',
            text: text
        };
    }

    if (looksLikeAttack(text)) {
        return {
            ok: false,
            code: 'unsafe',
            message: 'Текст містить заборонені конструкції. Приберіть код і спробуйте ще раз.',
            text: text
        };
    }

    if (!skipSpam && looksLikeSpam(text)) {
        return {
            ok: false,
            code: 'spam',
            message: 'Текст схожий на спам. Приберіть зайві посилання і спробуйте ще раз.',
            text: text
        };
    }

    if (!skipProfanity && hasProfanity(text)) {
        return {
            ok: false,
            code: 'profanity',
            message: 'Приберіть нецензурну лексику і спробуйте ще раз.',
            text: text
        };
    }

    return {
        ok: true,
        code: 'ok',
        message: '',
        text: text
    };
};

module.exports = checkUserContent;

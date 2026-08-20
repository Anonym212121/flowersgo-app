const xss = require('xss');

const xssFilter = new xss.FilterXSS({
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'svg']
});

const sanitizeUserText = (raw, maxLen) => {
    let text = typeof raw === 'string' ? raw : '';
    text = text.replace(/<(?![a-zA-Z\/!?])/g, '\uE000');
    text = xssFilter.process(text);
    text = text.replace(/\uE000/g, '<');
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    text = text.trim();

    const limit = Number(maxLen) > 0 ? Number(maxLen) : 2000;
    if (text.length > limit) {
        text = text.slice(0, limit);
    }

    return text;
};

module.exports = sanitizeUserText;

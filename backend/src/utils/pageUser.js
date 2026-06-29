const getPageUserId = (res) => {
    const raw = res.locals.currentUser && res.locals.currentUser.user_id;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }
    return id;
};

module.exports = {
    getPageUserId
};

const express = require('express');
const router = express.Router();

router.get('/ping', (req, res) => {
    return res.status(200).json({ ok: true });
});

module.exports = router;

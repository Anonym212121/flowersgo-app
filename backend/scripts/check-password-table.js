require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/config/db');

(async () => {
    try {
        const [rows] = await db.execute("SHOW TABLES LIKE 'password_email_codes'");
        console.log(rows.length ? 'password_email_codes: exists' : 'password_email_codes: MISSING');
        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
})();

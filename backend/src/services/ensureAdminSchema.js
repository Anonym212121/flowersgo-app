const db = require('../config/db');
const paymentService = require('./paymentService');

const ensureAdminSchema = async () => {
    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN is_blocked TINYINT NOT NULL DEFAULT 0'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema users:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN block_reason_key VARCHAR(50) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema block_reason_key:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN block_reason_text VARCHAR(500) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema block_reason_text:', err.message);
        }
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS delivery_settings (
                id INT NOT NULL PRIMARY KEY DEFAULT 1,
                work_start_hour INT NOT NULL DEFAULT 9,
                work_end_hour INT NOT NULL DEFAULT 23,
                slot_hours INT NOT NULL DEFAULT 2,
                standard_buffer_min INT NOT NULL DEFAULT 120,
                express_buffer_min INT NOT NULL DEFAULT 60,
                pickup_start_hour INT NOT NULL DEFAULT 9,
                pickup_end_hour INT NOT NULL DEFAULT 19,
                pickup_buffer_min INT NOT NULL DEFAULT 60,
                fee_standard DECIMAL(10,2) NOT NULL DEFAULT 0,
                fee_exact DECIMAL(10,2) NOT NULL DEFAULT 99,
                fee_express DECIMAL(10,2) NOT NULL DEFAULT 99,
                fee_pickup DECIMAL(10,2) NOT NULL DEFAULT 0
            )`
        );
        await db.execute('INSERT IGNORE INTO delivery_settings (id) VALUES (1)');
    } catch (err) {
        console.error('ensureAdminSchema delivery_settings:', err.message);
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS legal_pages (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                slug VARCHAR(50) NOT NULL UNIQUE,
                title VARCHAR(200) NOT NULL,
                lead_text VARCHAR(1000) NULL,
                body_text MEDIUMTEXT NULL,
                body_html MEDIUMTEXT NOT NULL,
                updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema legal_pages:', err.message);
    }

    try {
        await db.execute(
            'ALTER TABLE legal_pages ADD COLUMN body_text MEDIUMTEXT NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema legal_pages body_text:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN liqpay_last_ref VARCHAR(80) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema orders liqpay_last_ref:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN payment_deadline_at DATETIME NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema orders payment_deadline_at:', err.message);
        }
    }

    try {
        await db.execute(
            `UPDATE orders
             SET payment_deadline_at = DATE_ADD(createdAt, INTERVAL ? MINUTE)
             WHERE payment_deadline_at IS NULL`,
            [paymentService.PAYMENT_WINDOW_MINUTES]
        );
    } catch (err) {
        console.error('ensureAdminSchema orders payment_deadline backfill:', err.message);
    }

    try {
        await db.execute('ALTER TABLE orders MODIFY user_id INT NULL');
    } catch (err) {
        if (!err || (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_BAD_FIELD_ERROR')) {
            console.error('ensureAdminSchema orders user_id nullable:', err.message);
        }
    }

    try {
        await db.execute('ALTER TABLE orders ADD COLUMN paid_at DATETIME NULL');
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema orders paid_at:', err.message);
        }
    }

    try {
        await db.execute(
            `UPDATE orders
             SET paid_at = createdAt
             WHERE payment_status = 'paid' AND paid_at IS NULL`
        );
    } catch (err) {
        console.error('ensureAdminSchema orders paid_at backfill:', err.message);
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN saved_delivery_street VARCHAR(255) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema saved_delivery_street:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN saved_delivery_house VARCHAR(50) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema saved_delivery_house:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN saved_delivery_apartment VARCHAR(50) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema saved_delivery_apartment:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN delivery_method VARCHAR(20) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema delivery_method:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN cancel_request_at DATETIME NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema cancel_request_at:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN cancel_request_note VARCHAR(500) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema cancel_request_note:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN refund_status VARCHAR(20) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema refund_status:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN refunded_at DATETIME NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema refunded_at:', err.message);
        }
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS review_requests (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                review_id INT NOT NULL,
                user_id INT NOT NULL,
                request_type VARCHAR(20) NOT NULL,
                new_rating INT NULL,
                new_comment TEXT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema review_requests:', err.message);
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS order_status_log (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                user_id INT NULL,
                from_status_id INT NOT NULL,
                to_status_id INT NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema order_status_log:', err.message);
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS support_chats (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                guest_token VARCHAR(64) NULL,
                guest_name VARCHAR(120) NULL,
                guest_email VARCHAR(255) NULL,
                guest_phone VARCHAR(40) NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                assigned_admin_id INT NULL,
                assigned_at DATETIME NULL,
                closed_at DATETIME NULL,
                closed_by_admin_id INT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_support_chats_status (status),
                INDEX idx_support_chats_user (user_id),
                INDEX idx_support_chats_guest (guest_token),
                INDEX idx_support_chats_admin (assigned_admin_id)
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema support_chats:', err.message);
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS support_messages (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                chat_id INT NOT NULL,
                sender_type VARCHAR(20) NOT NULL,
                sender_user_id INT NULL,
                body TEXT NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_support_messages_chat (chat_id),
                CONSTRAINT fk_support_messages_chat
                    FOREIGN KEY (chat_id) REFERENCES support_chats(id) ON DELETE CASCADE
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema support_messages:', err.message);
    }

    try {
        await db.execute(
            'ALTER TABLE support_chats ADD COLUMN client_last_read_message_id INT NOT NULL DEFAULT 0'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema support client_last_read:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE support_chats ADD COLUMN admin_last_read_message_id INT NOT NULL DEFAULT 0'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema support admin_last_read:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE statuses ADD COLUMN show_in_courier TINYINT NOT NULL DEFAULT 0'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema show_in_courier:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN courier_id INT NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema courier_id:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE orders ADD COLUMN assigned_at DATETIME NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema assigned_at:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN courier_on_shift TINYINT NOT NULL DEFAULT 0'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema courier_on_shift:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN courier_work_email VARCHAR(255) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema courier_work_email:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE categories ADD COLUMN image_url VARCHAR(255) NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema categories image_url:', err.message);
        }
    }

    let sortColNew = false;
    try {
        await db.execute(
            'ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0'
        );
        sortColNew = true;
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema categories sort_order:', err.message);
        }
    }

    if (sortColNew) {
        try {
            const [rows] = await db.execute(
                'SELECT id, parent_id FROM categories ORDER BY parent_id IS NULL DESC, parent_id ASC, name ASC'
            );
            let lastKey = '';
            let order = 0;
            for (let i = 0; i < rows.length; i += 1) {
                const row = rows[i];
                const key = row.parent_id == null ? 'root' : String(row.parent_id);
                if (key !== lastKey) {
                    order = 0;
                    lastKey = key;
                }
                await db.execute('UPDATE categories SET sort_order = ? WHERE id = ?', [order, row.id]);
                order += 1;
            }
        } catch (err) {
            console.error('ensureAdminSchema categories sort_order backfill:', err.message);
        }
    } else {
        try {
            const [check] = await db.execute(
                `SELECT COUNT(*) AS total,
                        SUM(CASE WHEN sort_order = 0 THEN 1 ELSE 0 END) AS zeros
                 FROM categories`
            );
            const total = Number(check[0].total);
            const zeros = Number(check[0].zeros);
            if (total > 1 && zeros === total) {
                const [rows] = await db.execute(
                    'SELECT id, parent_id FROM categories ORDER BY parent_id IS NULL DESC, parent_id ASC, name ASC'
                );
                let lastKey = '';
                let order = 0;
                for (let i = 0; i < rows.length; i += 1) {
                    const row = rows[i];
                    const key = row.parent_id == null ? 'root' : String(row.parent_id);
                    if (key !== lastKey) {
                        order = 0;
                        lastKey = key;
                    }
                    await db.execute('UPDATE categories SET sort_order = ? WHERE id = ?', [order, row.id]);
                    order += 1;
                }
            }
        } catch (err) {
            console.error('ensureAdminSchema categories sort_order fix:', err.message);
        }
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS user_notifications (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                order_id INT NULL,
                ntype VARCHAR(50) NOT NULL,
                title VARCHAR(200) NOT NULL,
                body VARCHAR(500) NULL,
                link_url VARCHAR(255) NULL,
                is_read TINYINT NOT NULL DEFAULT 0,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_read (user_id, is_read),
                INDEX idx_user_created (user_id, createdAt)
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema user_notifications:', err.message);
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS stock_adjustments (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                color_variant_id INT NULL,
                user_id INT NOT NULL,
                delta_qty INT NOT NULL,
                stock_before INT NOT NULL,
                stock_after INT NOT NULL,
                note VARCHAR(255) NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_stock_adj_created (createdAt),
                INDEX idx_stock_adj_product (product_id)
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema stock_adjustments:', err.message);
    }

    try {
        await db.execute(
            'ALTER TABLE products ADD COLUMN is_constructor TINYINT NOT NULL DEFAULT 0'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema products is_constructor:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE categories ADD COLUMN is_packaging TINYINT NOT NULL DEFAULT 0'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema categories is_packaging:', err.message);
        }
    }

    try {
        await db.execute(
            "UPDATE categories SET is_packaging = 1 WHERE name = 'Упаковка' AND parent_id IS NULL"
        );
    } catch (err) {
        console.error('ensureAdminSchema categories packaging flag:', err.message);
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS product_color_variants (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                flower_color VARCHAR(50) NOT NULL,
                color_hex VARCHAR(7) NOT NULL DEFAULT '#94a3b8',
                image_url VARCHAR(255) NULL DEFAULT NULL,
                stock_quantity INT NOT NULL DEFAULT 0,
                is_active TINYINT NOT NULL DEFAULT 1,
                sort_order INT NOT NULL DEFAULT 0,
                INDEX idx_product_color_variants_product (product_id)
            ) ENGINE=InnoDB`
        );
    } catch (err) {
        console.error('ensureAdminSchema product_color_variants:', err.message);
    }

    try {
        await db.execute(
            'ALTER TABLE order_items ADD COLUMN color_variant_id INT NULL DEFAULT NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema order_items color_variant_id:', err.message);
        }
    }

    try {
        await migrateConstructorColorsToVariants();
    } catch (err) {
        console.error('ensureAdminSchema migrate constructor colors:', err.message);
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS bouquet_templates (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                slug VARCHAR(220) NOT NULL,
                description TEXT NULL,
                image_url VARCHAR(255) NULL DEFAULT NULL,
                packaging_product_id INT NULL DEFAULT NULL,
                is_active TINYINT NOT NULL DEFAULT 1,
                sort_order INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_bouquet_templates_slug (slug),
                INDEX idx_bouquet_templates_active (is_active, sort_order)
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema bouquet_templates:', err.message);
    }

    try {
        await db.execute(
            `CREATE TABLE IF NOT EXISTS bouquet_template_items (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                template_id INT NOT NULL,
                product_id INT NOT NULL,
                color_variant_id INT NULL DEFAULT NULL,
                quantity INT NOT NULL DEFAULT 1,
                sort_order INT NOT NULL DEFAULT 0,
                INDEX idx_bouquet_template_items_template (template_id),
                INDEX idx_bouquet_template_items_product (product_id)
            )`
        );
    } catch (err) {
        console.error('ensureAdminSchema bouquet_template_items:', err.message);
    }

    try {
        const seedBouquetTemplates = require('./seedBouquetTemplates');
        await seedBouquetTemplates();
    } catch (err) {
        console.error('ensureAdminSchema seed bouquet templates:', err.message);
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL DEFAULT NULL'
        );
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema users google_id:', err.message);
        }
    }

    try {
        await db.execute(
            'ALTER TABLE users ADD UNIQUE INDEX idx_users_google_id (google_id)'
        );
    } catch (err) {
        if (!err || (err.code !== 'ER_DUP_KEYNAME' && err.code !== 'ER_DUP_ENTRY')) {
            console.error('ensureAdminSchema users google_id unique:', err.message);
        }
    }

    try {
        await db.execute('ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL');
    } catch (err) {
        console.error('ensureAdminSchema users password_hash nullable:', err.message);
    }

    await dropObsoleteTables();
    await upgradeOrdersTable();
    await dropProductLegacyColorColumns();
    await ensureInnoDbForForeignKeys();
    await ensureForeignKeys();
    await backfillConstructorVariants();
    await syncConstructorVariantStock();
};

const dropObsoleteTables = async () => {
    const tables = ['password_sms_codes', 'block_support_messages', 'constructor_settings'];
    for (let i = 0; i < tables.length; i += 1) {
        const table = tables[i];
        try {
            await db.execute('DROP TABLE IF EXISTS `' + table + '`');
        } catch (err) {
            console.error('dropObsoleteTables ' + table + ':', err.message);
        }
    }
};

const addColumnIfMissing = async (table, columnSql, label) => {
    try {
        await db.execute('ALTER TABLE `' + table + '` ADD COLUMN ' + columnSql);
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            console.error('ensureAdminSchema ' + label + ':', err.message);
        }
    }
};

const dropColumnIfExists = async (table, column, label) => {
    try {
        await db.execute('ALTER TABLE `' + table + '` DROP COLUMN `' + column + '`');
    } catch (err) {
        if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
            console.error('ensureAdminSchema drop ' + label + ':', err.message);
        }
    }
};

const upgradeOrdersTable = async () => {
    await addColumnIfMissing('orders', 'customer_first_name VARCHAR(100) NULL', 'orders customer_first_name');
    await addColumnIfMissing('orders', 'customer_last_name VARCHAR(100) NULL', 'orders customer_last_name');
    await addColumnIfMissing('orders', 'customer_phone VARCHAR(20) NULL', 'orders customer_phone');
    await addColumnIfMissing('orders', 'customer_email VARCHAR(255) NULL', 'orders customer_email');
    await addColumnIfMissing('orders', 'delivery_street VARCHAR(255) NULL', 'orders delivery_street');
    await addColumnIfMissing('orders', 'delivery_house VARCHAR(50) NULL', 'orders delivery_house');
    await addColumnIfMissing('orders', 'delivery_apartment VARCHAR(50) NULL', 'orders delivery_apartment');
    await addColumnIfMissing('orders', 'recipient_note VARCHAR(500) NULL', 'orders recipient_note');
    await addColumnIfMissing('orders', 'bouquet_note TEXT NULL', 'orders bouquet_note');

    const deadOrderColumns = [
        'order_number',
        'greeting_card_text',
        'ai_generated_image_url',
        'guest_email',
        'guest_phone',
        'admin_notes'
    ];
    for (let i = 0; i < deadOrderColumns.length; i += 1) {
        await dropColumnIfExists('orders', deadOrderColumns[i], 'orders.' + deadOrderColumns[i]);
    }
};

const dropProductLegacyColorColumns = async () => {
    await dropColumnIfExists('products', 'flower_color', 'products.flower_color');
    await dropColumnIfExists('products', 'color_hex', 'products.color_hex');
};

const ensureInnoDbForForeignKeys = async () => {
    const tables = [
        'product_color_variants',
        'bouquet_templates',
        'bouquet_template_items',
        'order_status_log',
        'user_notifications'
    ];

    for (let i = 0; i < tables.length; i += 1) {
        const table = tables[i];
        try {
            await db.execute('ALTER TABLE `' + table + '` ENGINE=InnoDB');
        } catch (err) {
            if (!err || err.code !== 'ER_NO_SUCH_TABLE') {
                console.error('ensureAdminSchema InnoDB ' + table + ':', err.message);
            }
        }
    }
};

const addForeignKeyIfMissing = async (sql, label) => {
    try {
        await db.execute(sql);
    } catch (err) {
        if (!err || (err.code !== 'ER_DUP_KEYNAME' && err.code !== 'ER_CANT_CREATE_TABLE' && err.code !== 'ER_FK_INCOMPATIBLE_COLUMNS')) {
            console.error('ensureAdminSchema FK ' + label + ':', err.message);
        }
    }
};

const ensureForeignKeys = async () => {
    await addForeignKeyIfMissing(
        `ALTER TABLE product_color_variants
         ADD CONSTRAINT fk_pcv_product
         FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE`,
        'product_color_variants.product_id'
    );
    await addForeignKeyIfMissing(
        `ALTER TABLE order_items
         ADD CONSTRAINT fk_order_items_variant
         FOREIGN KEY (color_variant_id) REFERENCES product_color_variants(id) ON DELETE SET NULL`,
        'order_items.color_variant_id'
    );
    await addForeignKeyIfMissing(
        `ALTER TABLE bouquet_template_items
         ADD CONSTRAINT fk_bti_template
         FOREIGN KEY (template_id) REFERENCES bouquet_templates(id) ON DELETE CASCADE`,
        'bouquet_template_items.template_id'
    );
    await addForeignKeyIfMissing(
        `ALTER TABLE bouquet_template_items
         ADD CONSTRAINT fk_bti_product
         FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT`,
        'bouquet_template_items.product_id'
    );
    await addForeignKeyIfMissing(
        `ALTER TABLE order_status_log
         ADD CONSTRAINT fk_order_status_log_order
         FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`,
        'order_status_log.order_id'
    );
    await addForeignKeyIfMissing(
        `ALTER TABLE user_notifications
         ADD CONSTRAINT fk_user_notifications_user
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
        'user_notifications.user_id'
    );
    await addForeignKeyIfMissing(
        `ALTER TABLE orders
         ADD CONSTRAINT fk_orders_courier
         FOREIGN KEY (courier_id) REFERENCES users(id) ON DELETE SET NULL`,
        'orders.courier_id'
    );
};

const backfillConstructorVariants = async () => {
    const [rows] = await db.execute(
        `SELECT p.id, p.stock_quantity, p.image_url
         FROM products p
         WHERE IFNULL(p.is_constructor, 0) = 1
           AND p.is_active = 1
           AND NOT EXISTS (
               SELECT 1 FROM product_color_variants pcv WHERE pcv.product_id = p.id
           )`
    );

    const list = rows || [];
    for (let i = 0; i < list.length; i += 1) {
        const row = list[i];
        const pid = Number(row.id);
        const stock = Number(row.stock_quantity || 0);

        await db.execute(
            `INSERT INTO product_color_variants
                (product_id, flower_color, color_hex, image_url, stock_quantity, is_active, sort_order)
             VALUES (?, 'Стандарт', '#94a3b8', ?, ?, 1, 0)`,
            [pid, row.image_url || null, stock]
        );

        if (stock > 0) {
            await db.execute('UPDATE products SET stock_quantity = 0 WHERE id = ?', [pid]);
        }
    }
};

const syncConstructorVariantStock = async () => {
    const [rows] = await db.execute(
        `SELECT p.id, p.stock_quantity,
                (
                    SELECT COALESCE(SUM(v.stock_quantity), 0)
                    FROM product_color_variants v
                    WHERE v.product_id = p.id
                ) AS variant_stock,
                (
                    SELECT MIN(v.id)
                    FROM product_color_variants v
                    WHERE v.product_id = p.id
                ) AS first_variant_id
         FROM products p
         WHERE IFNULL(p.is_constructor, 0) = 1
           AND p.is_active = 1
           AND p.stock_quantity > 0`
    );

    const list = rows || [];
    for (let i = 0; i < list.length; i += 1) {
        const row = list[i];
        if (Number(row.variant_stock) > 0) {
            continue;
        }
        const variantId = Number(row.first_variant_id);
        if (!Number.isFinite(variantId) || variantId <= 0) {
            continue;
        }
        await db.execute('UPDATE product_color_variants SET stock_quantity = ? WHERE id = ?', [
            Number(row.stock_quantity || 0),
            variantId
        ]);
        await db.execute('UPDATE products SET stock_quantity = 0 WHERE id = ?', [Number(row.id)]);
    }
};

const migrateConstructorColorsToVariants = async () => {
    const [countRows] = await db.execute('SELECT COUNT(*) AS n FROM product_color_variants');
    if (Number(countRows[0].n) > 0) {
        return;
    }

    let products = [];
    try {
        const [rows] = await db.execute(
            `SELECT id, category_id, stock_quantity, image_url, flower_color, color_hex
             FROM products
             WHERE IFNULL(is_constructor, 0) = 1
             ORDER BY category_id ASC, id ASC`
        );
        products = rows || [];
    } catch (err) {
        if (err && err.code === 'ER_BAD_FIELD_ERROR') {
            return;
        }
        throw err;
    }

    if (!products || products.length === 0) {
        return;
    }

    const byCategory = {};
    for (let i = 0; i < products.length; i += 1) {
        const row = products[i];
        const catId = Number(row.category_id);
        if (!byCategory[catId]) {
            byCategory[catId] = [];
        }
        byCategory[catId].push(row);
    }

    const categoryKeys = Object.keys(byCategory);
    for (let c = 0; c < categoryKeys.length; c += 1) {
        const group = byCategory[categoryKeys[c]];
        const master = group[0];
        const masterId = Number(master.id);

        for (let i = 0; i < group.length; i += 1) {
            const p = group[i];
            const colorName =
                typeof p.flower_color === 'string' && p.flower_color.trim()
                    ? p.flower_color.trim()
                    : group.length > 1
                      ? 'Колір ' + (i + 1)
                      : 'Стандарт';

            await db.execute(
                `INSERT INTO product_color_variants
                    (product_id, flower_color, color_hex, image_url, stock_quantity, is_active, sort_order)
                 VALUES (?, ?, ?, ?, ?, 1, ?)`,
                [
                    masterId,
                    colorName,
                    p.color_hex || '#94a3b8',
                    p.image_url || null,
                    Number(p.stock_quantity || 0),
                    i
                ]
            );

            if (Number(p.id) !== masterId) {
                await db.execute(
                    'UPDATE products SET is_active = 0, stock_quantity = 0 WHERE id = ?',
                    [Number(p.id)]
                );
            }
        }

        await db.execute(
            'UPDATE products SET stock_quantity = 0 WHERE id = ?',
            [masterId]
        );
    }
};

module.exports = ensureAdminSchema;

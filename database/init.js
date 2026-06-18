const runMigrations =
    require("./migrations");

const pool =
    require("./db");

async function initDatabase() {

    const dbName =
        process.env.DB_NAME;

    try {

        await pool.query(`
            CREATE DATABASE IF NOT EXISTS ${dbName}
            CHARACTER SET utf8mb4
            COLLATE utf8mb4_unicode_ci
        `);

        console.log(
            "✅ Database ready"
        );

        await pool.query(
            `USE ${dbName}`
        );

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                google_id VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                display_name VARCHAR(255),
                photo_url TEXT,
                created_at DATETIME
                DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
            );
        `);


        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (

                id BIGINT AUTO_INCREMENT PRIMARY KEY,

                user_id BIGINT,

                created_at DATETIME
                DEFAULT CURRENT_TIMESTAMP,

                lid VARCHAR(100),

                nohp VARCHAR(30),

                nama VARCHAR(255),

                produk VARCHAR(255),

                harga INT,

                qty INT,

                subtotal INT,

                pesan TEXT,

                photo_path TEXT,

                message_id VARCHAR(255),

                invoice_no VARCHAR(50),

                status VARCHAR(50)

                DEFAULT 'draft',
                customer_msg_id VARCHAR(255),

                image_msg_id VARCHAR(255),

                direct_path TEXT,
                media_key VARCHAR(255),
                image_data LONGTEXT,


                INDEX idx_user_id (user_id),
                INDEX idx_lid (lid),

                INDEX idx_invoice (invoice_no),

                INDEX idx_status (status)

            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoices
            (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,

                user_id BIGINT,

                invoice_no VARCHAR(50) NOT NULL UNIQUE,

                nohp VARCHAR(30),

                nama VARCHAR(255),

                total_item INT DEFAULT 0,

                total_qty INT DEFAULT 0,

                grand_total INT DEFAULT 0,

                status VARCHAR(30) DEFAULT 'unpaid',

                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                INDEX idx_invoice_user_id (user_id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoice_items (

            id BIGINT AUTO_INCREMENT PRIMARY KEY,

            user_id BIGINT,

            invoice_no VARCHAR(50),

            produk VARCHAR(255),

            harga INT,

            qty INT,

            subtotal INT,

            INDEX idx_invoice_items_user_id (user_id)

        );
        `);
        
        await pool.query(`
           CREATE TABLE IF NOT EXISTS settings (

                id INT AUTO_INCREMENT PRIMARY KEY,

                user_id BIGINT,

                setting_key VARCHAR(100) UNIQUE,

                setting_value TEXT

            );
        `);

        await pool.query(`
           CREATE TABLE IF NOT EXISTS customers (

                id BIGINT AUTO_INCREMENT PRIMARY KEY,

                user_id BIGINT,

                lid VARCHAR(100) UNIQUE,

                nohp VARCHAR(30),

                nama VARCHAR(255),

                total_order INT DEFAULT 0,

                total_belanja BIGINT DEFAULT 0,

                created_at DATETIME
                DEFAULT CURRENT_TIMESTAMP

            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_groups (

                id INT AUTO_INCREMENT PRIMARY KEY,

                user_id BIGINT,

                group_id VARCHAR(100),

                group_name VARCHAR(255),

                is_active TINYINT DEFAULT 1,

                created_at DATETIME
                DEFAULT CURRENT_TIMESTAMP

            )
        `);
            
        await runMigrations();
        console.log(
            "✅ Tables ready"
        );

    } catch (err) {

        console.log(
            "❌ Database init error"
        );

        console.log(err);

    }

}

module.exports =
    initDatabase;

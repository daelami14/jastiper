const pool =
    require("./db");

async function addColumnIfNotExists(
    table,
    column,
    definition
) {

    const [rows] =
        await pool.query(
            `
            SHOW COLUMNS
            FROM ${table}
            LIKE ?
            `,
            [column]
        );

    if (rows.length === 0) {

        console.log(
            `➕ Add column ${table}.${column}`
        );

        await pool.query(
            `
            ALTER TABLE ${table}
            ADD COLUMN ${column}
            ${definition}
            `
        );

    }

}

async function runMigrations() {

    try {

        await addColumnIfNotExists(
            "orders",
            "user_id",
            "BIGINT"
        );

        await addColumnIfNotExists(
            "orders",
            "customer_msg_id",
            "VARCHAR(255)"
        );

        await addColumnIfNotExists(
            "orders",
            "image_msg_id",
            "VARCHAR(255)"
        );

        await addColumnIfNotExists(
            "orders",
            "direct_path",
            "TEXT"
        );

        await addColumnIfNotExists(
            "orders",
            "media_key",
            "VARCHAR(255)"
        );

        await addColumnIfNotExists(
            "orders",
            "image_data",
            "LONGTEXT"
        );
        await addColumnIfNotExists(
            "invoices",
            "user_id",
            "BIGINT"
        );

        await addColumnIfNotExists(
            "invoices",
            "wa_sent",
            "TINYINT(1) DEFAULT 0"
        );

        await addColumnIfNotExists(
            "invoice_items",
            "user_id",
            "BIGINT"
        );

        await addColumnIfNotExists(
            "whatsapp_groups",
            "user_id",
            "BIGINT"
        );

        await addColumnIfNotExists(
            "customers",
            "user_id",
            "BIGINT"
        );

        await addColumnIfNotExists(
            "settings",
            "user_id",
            "BIGINT"
        );

        console.log(
            "✅ Migration selesai"
        );

    } catch (err) {

        console.log(
            "❌ Migration Error"
        );

        console.log(err);

    }

}

module.exports =
    runMigrations;

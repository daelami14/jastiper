const pool =
    require("./database/db");
const {
    ensureWhatsAppSession
} = require("./whatsapp/baileys");

async function main() {

    const userId =
        process.env.TEST_USER_ID;

    if (!userId) {
        throw new Error(
            "Set TEST_USER_ID untuk menjalankan test WhatsApp."
        );
    }

    const [[user]] =
        await pool.query(
            `
            SELECT
                id,
                email,
                display_name
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [userId]
        );

    if (!user) {
        throw new Error(
            "User tidak ditemukan."
        );
    }

    await ensureWhatsAppSession({
        id: user.id,
        email: user.email,
        displayName:
            user.display_name
    });

}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

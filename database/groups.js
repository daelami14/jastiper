const pool =
    require("./db");

async function isAllowedGroup(
    userId,
    groupId
) {

    const [[configuredGroupCount]] =
        await pool.query(
            `
            SELECT COUNT(*) total
            FROM whatsapp_groups
            WHERE user_id = ?
            AND is_active = 1
            `,
            [userId]
        );

    if (
        Number(configuredGroupCount.total) === 0
    ) {
        return true;
    }

    const [rows] =
        await pool.query(
            `
            SELECT id
            FROM whatsapp_groups
            WHERE user_id = ?
            AND group_id = ?
            AND is_active = 1
            LIMIT 1
            `,
            [
                userId,
                groupId
            ]
        );

    return rows.length > 0;

}

async function getUserGroups(
    userId
) {

    const [rows] =
        await pool.query(
            `
            SELECT *
            FROM whatsapp_groups
            WHERE user_id = ?
            ORDER BY created_at DESC
            `,
            [userId]
        );

    return rows;

}

module.exports = {
    isAllowedGroup,
    getUserGroups
};

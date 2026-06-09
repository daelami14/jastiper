const pool =
    require("./db");

async function isAllowedGroup(
    groupId
) {

    const [rows] =
        await pool.query(
            `
            SELECT id
            FROM whatsapp_groups
            WHERE group_id = ?
            AND is_active = 1
            LIMIT 1
            `,
            [groupId]
        );

    return rows.length > 0;

}

module.exports = {
    isAllowedGroup
};
const pool =
    require("../database/db");

async function saveOrder(data) {

    await pool.query(
        `
        INSERT INTO orders
        (
            user_id,
            lid,
            nohp,
            nama,
            produk,
            harga,
            qty,
            subtotal,
            pesan,
            status,
            customer_msg_id,
            image_msg_id,
            direct_path,
            media_key,
            image_data,
            photo_path

        )
        VALUES
        (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
        `,
        [
            data.userId,
            data.lid,
            data.nohp,
            data.nama,
            data.produk,
            data.harga,
            data.qty,
            data.subtotal,
            data.pesan,
            "draft",
            data.customerMsgID,
            data.imageMsgID,
            data.directPath,
            data.mediaKey,
            data.imageData,
            data.photoPath
        ]
    );

}

async function approveOrder(
    userId,
    customerMsgID,
    photoPath
) {

    const values = [userId];
    let query = `
        UPDATE orders
        SET status='approved'
    `;

    if (photoPath) {

        query += `,
        photo_path=?`;
        values.unshift(photoPath);

    }

    query += `
        WHERE user_id=?
        AND customer_msg_id=?
    `;
    values.push(customerMsgID);

    const [result] =
        await pool.query(
            query,
            values
        );

    return result;

}

async function getOrderByCustomerMsgID(
    userId,
    customerMsgID
) {

    const [rows] =
        await pool.query(
            `
            SELECT *
            FROM orders
            WHERE user_id = ?
            AND customer_msg_id = ?
            LIMIT 1
            `,
            [
                userId,
                customerMsgID
            ]
        );

    return rows[0];

}

async function orderExists(
    userId,
    customerMsgID
) {

    const [rows] =
        await pool.query(
            `
            SELECT id
            FROM orders
            WHERE user_id = ?
            AND customer_msg_id = ?
            LIMIT 1
            `,
            [
                userId,
                customerMsgID
            ]
        );

    return rows.length > 0;

}



module.exports = {
    saveOrder,
    approveOrder,
    getOrderByCustomerMsgID,
    orderExists
};

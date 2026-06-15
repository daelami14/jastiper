const pool =
    require("../database/db");

async function saveOrder(data) {

    await pool.query(
        `
        INSERT INTO orders
        (
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
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
        `,
        [
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
    customerMsgID,
    photoPath
) {

    const [result] =
    await pool.query(
        `
        UPDATE orders
        SET status='approved',
        photo_path=?
        WHERE customer_msg_id=?
        `,
        [
            photoPath,
            customerMsgID
        ]
    );
    return result;

}

async function getOrderByCustomerMsgID(
    customerMsgID
) {

    const [rows] =
        await pool.query(
            `
            SELECT *
            FROM orders
            WHERE customer_msg_id = ?
            LIMIT 1
            `,
            [customerMsgID]
        );

    return rows[0];

}

async function orderExists(
    customerMsgID
) {

    const [rows] =
        await pool.query(
            `
            SELECT id
            FROM orders
            WHERE customer_msg_id = ?
            LIMIT 1
            `,
            [customerMsgID]
        );

    return rows.length > 0;

}



module.exports = {
    saveOrder,
    approveOrder,
    getOrderByCustomerMsgID,
    orderExists
};
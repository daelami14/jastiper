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
        )
        VALUES
        (
            ?,?,?,?,?,?,?,?,?,?,?
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
            data.imageMsgID
        ]
    );

}

async function approveOrder(
    customerMsgID
) {

    const [result] =
    await pool.query(
        `
        UPDATE orders
        SET status='approved'
        WHERE customer_msg_id=?
        `,
        [
            customerMsgID
        ]
    );
    return result;

}

module.exports = {
    saveOrder,
    approveOrder
};
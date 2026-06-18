const pool =
    require("../database/db");

async function generateInvoice(
    nohp,
    userId
) {

    const [orders] =
        await pool.query(
            `
            SELECT *
            FROM orders
            WHERE user_id = ?
            AND nohp = ?
            AND status='approved'
            AND invoice_no IS NULL
            `,
            [
                userId,
                nohp
            ]
        );

    if (
        orders.length === 0
    ) {

        return null;

    }

    const invoiceNo =
        "INV" +
        Date.now();

    let totalItem =
        orders.length;

    let totalQty =
        0;

    let grandTotal =
        0;

    for (
        const order
        of orders
    ) {

        totalQty +=
            order.qty;

        grandTotal +=
            order.subtotal;

    }

    await pool.query(
        `
        INSERT INTO invoices
        (
            user_id,
            invoice_no,
            nohp,
            nama,
            total_item,
            total_qty,
            grand_total
        )
        VALUES
        (
            ?,?,?,?,?,?,?
        )
        `,
        [
            userId,
            invoiceNo,
            orders[0].nohp,
            orders[0].nama,
            totalItem,
            totalQty,
            grandTotal
        ]
    );

    for (
        const order
        of orders
    ) {

        await pool.query(
            `
            INSERT INTO invoice_items
            (
                user_id,
                invoice_no,
                produk,
                harga,
                qty,
                subtotal
            )
            VALUES
            (
                ?,?,?,?,?,?
            )
            `,
            [
                userId,
                invoiceNo,
                order.produk,
                order.harga,
                order.qty,
                order.subtotal
            ]
        );

    }

    await pool.query(
        `
        UPDATE orders
        SET invoice_no=?
        WHERE user_id=?
        AND nohp=?
        AND status='approved'
        AND invoice_no IS NULL
        `,
        [
            invoiceNo,
            userId,
            nohp
        ]
    );

    return invoiceNo;

}

module.exports = {
    generateInvoice
};

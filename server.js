require("dotenv").config();

const initDatabase =
    require("./database/init");

const startWhatsApp =
    require("./whatsapp/baileys");

const express =
    require("express");

const {
    generateInvoice
} = require(
    "./whatsapp/invoiceHandler"
);

const {
    getSocket
} = require(
    "./whatsapp/socketStore"
);
const {
    sendInvoiceWA
} = require(
    "./whatsapp/sendInvoice"
);

const path =
    require("path");

const app =
    express();

const PORT =
    process.env.PORT || 3000;

const expressLayouts =
    require(
        "express-ejs-layouts"
    );

app.use(
    expressLayouts
);

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.json()
);

/*
|--------------------------------------------------------------------------
| EJS CONFIG
|--------------------------------------------------------------------------
*/

app.set(
    "view engine",
    "ejs"
);

app.set(
    "views",
    path.join(
        __dirname,
        "views"
    )
);
app.set(
    "layout",
    "layouts/main"
)

app.use(
    "/tabler",
    express.static(
        path.join(
            __dirname,
            "node_modules",
            "@tabler",
            "core"
        )
    )
);

app.use(
    "/images",
    express.static(
        path.join(
            __dirname,
            "images"
        )
    )
);

app.use(
    "/uploads",
    express.static(
        path.join(
            __dirname,
            "public",
            "uploads"
        )
    )
);

/*
|--------------------------------------------------------------------------
| ROUTES
|--------------------------------------------------------------------------
*/

app.get(
    "/",
    (req, res) => {

        res.render(
            "dashboard",
            {
                totalOrders: 0,
                totalCustomers: 0,
                pendingInvoices: 0,
                totalInvoices: 0,
                revenue: 0
            }
        );

    }
);

app.get(
    "/interest-orders",
    async (req, res) => {

        const pool =
            require("./database/db");

        const [products] =
            await pool.query(`
                SELECT
                    image_msg_id,
                    produk,
                    photo_path,

                    COUNT(*) total_order,

                    SUM(qty) total_qty

                FROM orders

                WHERE status='draft'

                GROUP BY
                    image_msg_id,
                    produk,
                    photo_path

                ORDER BY
                    MAX(id) DESC
            `);

        res.render(
            "interest-orders",
            {
                products
            }
        );

    }
);

app.get(
    "/interest-orders/:imageMsgId",
    async (req, res) => {

        const pool =
            require("./database/db");

        const imageMsgId =
            req.params.imageMsgId;

        const [orders] =
            await pool.query(
                `
                SELECT *
                FROM orders
                WHERE image_msg_id = ?
                AND status='draft'
                ORDER BY id DESC
                `,
                [imageMsgId]
            );

        if (
            orders.length === 0
        ) {

            return res.redirect(
                "/interest-orders"
            );

        }

        res.render(
            "interest-order-detail",
            {
                product:
                    orders[0],

                orders
            }
        );

    }
);
app.post(
    "/interest-orders/approve",
    async (req, res) => {

        try {

            const pool =
                require("./database/db");

            const ids =
                req.body.ids || [];

            const [orders] =
                await pool.query(
                    `
                    SELECT *
                    FROM orders
                    WHERE id IN (?)
                    `,
                    [ids]
                );

            await pool.query(
                `
                UPDATE orders
                SET status='approved'
                WHERE id IN (?)
                `,
                [ids]
            );

            const sock =
                getSocket();

            for (
                const order
                of orders
            ) {

                try {

                    await sock.sendMessage(
                        `${order.nohp}@s.whatsapp.net`,
                        {
                            text:
`Halo ${order.nama} 👋

Pesanan Anda telah disetujui.

Produk : ${order.produk}
Qty : ${order.qty}

Silakan tunggu invoice dari admin.

Terima kasih 🙏`
                        }
                    );

                } catch (err) {

                    console.log(
                        "Gagal kirim WA:",
                        order.nohp
                    );

                }

            }

            res.json({
                success: true
            });

        } catch (err) {

            console.log(err);

            res.json({
                success: false
            });

        }

    }
);

app.get(
    "/orders",
    async (req, res) => {

        const pool =
            require("./database/db");

        const [orders] =
            await pool.query(`
                SELECT
                id,
                DATE_FORMAT(created_at,'%d-%m-%Y %H:%i') AS tanggal,
                nama,
                nohp,
                produk,
                harga,
                qty,
                subtotal,
                status,
                photo_path
            FROM orders where status != 'draft'
            ORDER BY id DESC;
            `);

        res.render(
            "orders",
            {
                orders
            }
        );

    }
);

app.get(
    "/invoices",
    async (req, res) => {

        const pool =
            require("./database/db");

        const [invoices] =
            await pool.query(`
                SELECT *
                FROM invoices
                ORDER BY id DESC
            `);

        res.render(
            "invoices",
            {
                invoices
            }
        );

    }
);
app.get(
    "/invoices/:invoiceNo",
    async (req, res) => {

        const pool =
            require("./database/db");

        const invoiceNo =
            req.params.invoiceNo;

        const [[invoice]] =
            await pool.query(
                `
                SELECT *
                FROM invoices
                WHERE invoice_no=?
                `,
                [invoiceNo]
            );

        if (!invoice) {

            return res.redirect(
                "/invoices"
            );

        }

        const [items] =
            await pool.query(
                `
                SELECT *
                FROM invoice_items
                WHERE invoice_no=?
                `,
                [invoiceNo]
            );

        res.render(
            "invoice-detail",
            {
                invoice,
                items
            }
        );

    }
);

app.post(
    "/invoices/send/:invoiceNo",
    async (req, res) => {

        try {

            const pool =
                require("./database/db");

            const invoiceNo =
                req.params.invoiceNo;

            const [[invoice]] =
                await pool.query(
                    `
                    SELECT *
                    FROM invoices
                    WHERE invoice_no=?
                    `,
                    [invoiceNo]
                );

            const [items] =
                await pool.query(
                    `
                    SELECT *
                    FROM invoice_items
                    WHERE invoice_no=?
                    `,
                    [invoiceNo]
                );

            await sendInvoiceWA(
                invoice,
                items
            );

            res.json({

                success: true

            });

        } catch (err) {

            console.log(err);

            res.json({

                success: false

            });

        }

    }
);

app.post(
    "/generate-invoice",
    async (req, res) => {

        try {

            const nohps =
                req.body.nohps || [];

            const invoices =
                [];

            for (
                const nohp
                of nohps
            ) {

                const invoiceNo =
                    await generateInvoice(
                        nohp
                    );

                if (
                    invoiceNo
                ) {

                    invoices.push(
                        invoiceNo
                    );

                }

            }

            res.json({

                success: true,

                invoices

            });

        } catch (err) {

            console.log(err);

            res.json({

                success: false

            });

        }

    }
);


app.post(
    "/orders/generate-invoice",
    async (req, res) => {

        try {

            const pool =
                require("./database/db");

            const ids =
                req.body.ids || [];

            const [orders] =
                await pool.query(
                    `
                    SELECT *
                    FROM orders
                    WHERE id IN (?)
                    `,
                    [ids]
                );

            const groups =
                {};

            for (
                const order
                of orders
            ) {

                if (
                    !groups[
                        order.nohp
                    ]
                ) {

                    groups[
                        order.nohp
                    ] = [];

                }

                groups[
                    order.nohp
                ].push(
                    order
                );

            }

            for (
                const nohp
                in groups
            ) {

                const invoiceNo =
                    generateInvoiceNo();

                const orderIds =
                    groups[
                        nohp
                    ].map(
                        x => x.id
                    );

                await pool.query(
                    `
                    UPDATE orders
                    SET invoice_no = ?
                    WHERE id IN (?)
                    `,
                    [
                        invoiceNo,
                        orderIds
                    ]
                );

            }

            res.json({

                success: true,

                message:
                    "Invoice berhasil dibuat"

            });

        } catch (err) {

            console.log(err);

            res.json({

                success: false,

                message:
                    "Terjadi kesalahan"

            });

        }

    }
);


const QRCode =
    require("qrcode");

const whatsappState =
    require(
        "./whatsapp/state"
    );

app.get(
    "/whatsapp",
    async (req, res) => {

        try {

            let qrImage = null;

            if (whatsappState.qr) {

                qrImage =
                    await QRCode.toDataURL(
                        whatsappState.qr
                    );

            }

            res.render(
                "whatsapp",
                {
                    status:
                        whatsappState.connected
                            ? "Connected"
                            : "Disconnected",

                    phone:
                        whatsappState.phone ||
                        "-",

                    qr:
                        qrImage
                }
            );

        } catch (err) {

            console.log(err);

            res.render(
                "whatsapp",
                {
                    status:
                        "Disconnected",

                    phone:
                        "-",

                    qr:
                        null
                }
            );

        }

    }
);

app.get(
    "/api/whatsapp",
    (req, res) => {

        res.json({

            connected:
                whatsappState.connected,

            phone:
                whatsappState.phone,

            qr:
                whatsappState.qr,

            lastConnected:
                whatsappState.lastConnected

        });

    }
);

/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/
console.log(
    path.join(
        __dirname,
        "node_modules",
        "@tabler",
        "core"
    )
);
// app.listen(
//     PORT,
//     async () => {

//         await initDatabase();

//         console.log(
//             `🚀 Server running on port ${PORT}`
//         );

//         await startWhatsApp();

//     }
// );
function generateInvoiceNo() {

    const now =
        new Date();

    const y =
        now.getFullYear();

    const m =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const d =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );

    return `INV-${y}${m}${d}-${Date.now()}`;

}

async function bootstrap() {

    try {

        await initDatabase();

        console.log(
            "✅ Database Ready"
        );

        await startWhatsApp();

        console.log(
            "✅ WhatsApp Ready"
        );

        app.listen(
            PORT,
            () => {

                console.log(
                    `🚀 Server running on port ${PORT}`
                );

            }
        );

    } catch (err) {

        console.error(
            "❌ Startup Error"
        );

        console.error(err);

        process.exit(1);

    }

}

bootstrap();
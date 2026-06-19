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
// Dashboard
// app.get(
//     "/",
//     async (req, res) => {

//         const pool =
//             require("./database/db");

//         const [[totalOrders]] =
//             await pool.query(
//                 `
//                 SELECT COUNT(*) total
//                 FROM orders
//                 WHERE status='approved'
//                 `
//             );

//         const [[totalCustomers]] =
//             await pool.query(
//                 `
//                 SELECT COUNT(
//                     DISTINCT nohp
//                 ) total
//                 FROM orders
//                 `
//             );

//         const [[pendingInvoices]] =
//             await pool.query(
//                 `
//                 SELECT COUNT(*) total
//                 FROM invoices
//                 WHERE status='unpaid'
//                 `
//             );

//         const [[totalInvoices]] =
//             await pool.query(
//                 `
//                 SELECT COUNT(*) total
//                 FROM invoices
//                 `
//             );

//         const [[revenue]] =
//             await pool.query(
//                 `
//                 SELECT
//                     COALESCE(
//                         SUM(grand_total),
//                         0
//                     ) total
//                 FROM invoices
//                 WHERE status='paid'
//                 `
//             );

//         const [recentInvoices] =
//             await pool.query(
//                 `
//                 SELECT *
//                 FROM invoices
//                 ORDER BY id DESC
//                 LIMIT 10
//                 `
//             );

//         res.render(
//             "dashboard",
//             {
//                 activePage:
//                     "dashboard",
//                 pageTitle:
//                     "Dashboard",

//                 pageDescription:
//                     "Ringkasan aktivitas jastip",

//                 totalOrders:
//                     totalOrders.total,

//                 totalCustomers:
//                     totalCustomers.total,

//                 pendingInvoices:
//                     pendingInvoices.total,

//                 totalInvoices:
//                     totalInvoices.total,

//                 revenue:
//                     revenue.total,

//                 recentInvoices :
//                     recentInvoices

//             }
//         );

//     }
// );
app.get(
    "/",
    async (req,res) => {

        const pool =
            require("./database/db");

        const {
            startDate = "",
            endDate = ""
        } = req.query;

        const dateParams = [];
        const dateConditions = [];

        if(startDate){
            dateConditions.push(
                "DATE(created_at) >= ?"
            );
            dateParams.push(startDate);
        }

        if(endDate){
            dateConditions.push(
                "DATE(created_at) <= ?"
            );
            dateParams.push(endDate);
        }

        const orderWhereSql =
            dateConditions.length
                ? `WHERE ${dateConditions.join(" AND ")}`
                : "";

        const invoiceWhereSql =
            dateConditions.length
                ? `WHERE ${dateConditions.join(" AND ")}`
                : "";

        const paidInvoiceWhereSql =
            ["status='paid'", ...dateConditions]
                .length
                    ? `WHERE ${[
                        "status='paid'",
                        ...dateConditions
                    ].join(" AND ")}`
                    : "";

        const chartLimitSql =
            startDate || endDate
                ? ""
                : "LIMIT 30";

        const [[orderStat]] =
            await pool.query(`
                SELECT
                    COUNT(*) total_order
                FROM orders
                ${orderWhereSql}
            `, dateParams);

        const [[customerStat]] =
            await pool.query(`
                SELECT
                    COUNT(DISTINCT nohp)
                    total_customer
                FROM orders
                ${orderWhereSql}
            `, dateParams);

        const [[invoiceStat]] =
            await pool.query(`
                SELECT
                    COUNT(*) total_invoice
                FROM invoices
                ${invoiceWhereSql}
            `, dateParams);

        const [[revenueStat]] =
            await pool.query(`
                SELECT
                    IFNULL(
                        SUM(grand_total),
                        0
                    ) revenue
                FROM invoices
                ${paidInvoiceWhereSql}
            `, dateParams);

        const [topProducts] =
            await pool.query(`
                SELECT
                    produk,
                    SUM(qty) total_qty
                FROM orders
                ${orderWhereSql}
                GROUP BY produk
                ORDER BY total_qty DESC
                LIMIT 10
            `, dateParams);

        const [topCustomers] =
            await pool.query(`
                SELECT
                    MAX(nama) nama,
                    nohp,
                    SUM(subtotal)
                    total_belanja
                FROM orders
                ${orderWhereSql}
                GROUP BY nohp
                ORDER BY total_belanja DESC
                LIMIT 10
            `, dateParams);

        const [dailyOrders] =
        await pool.query(`
            SELECT

                DATE(created_at) tanggal ,

                COUNT(*) total

            FROM orders

            ${orderWhereSql}

            GROUP BY DATE(created_at)

            ORDER BY tanggal ASC

            ${chartLimitSql}
        `, dateParams);

        const [dailyRevenue] =
        await pool.query(`
            SELECT

                DATE(created_at) tanggal,

                SUM(grand_total) total

            FROM invoices

            ${paidInvoiceWhereSql}

            GROUP BY DATE(created_at)

            ORDER BY tanggal ASC

            ${chartLimitSql}
        `, dateParams);

        res.render(
            "dashboard",
            {
                activePage:
                    "dashboard",

                pageTitle:
                    "Dashboard",

                pageDescription:
                    "Overview Bisnis",

                startDate,
                endDate,

                orderStat,
                customerStat,
                invoiceStat,
                revenueStat,

                topProducts,
                topCustomers,

                dailyOrders,
                dailyRevenue
            }
        );

    }
);

// Interest Orders
app.get(
    "/interest-orders",
    async (req, res) => {

        const pool =
            require("./database/db");

       const [products] =
        await pool.query(`
            SELECT

                image_msg_id,

                MAX(produk) produk,

                MAX(photo_path) photo_path,

                COUNT(*) total_order,

                SUM(qty) total_qty

            FROM orders

            WHERE status='draft'

            GROUP BY image_msg_id

            ORDER BY MAX(created_at) DESC
        `);

        res.render(
            "interest-orders",
            {
                activePage:
                "interest-orders",

                pageTitle:
                    "Interest Orders",

                pageDescription:
                    "Daftar Produk Yang Dicari Customer",

                products,
            }
        );

    }
);

// Interest Order Detail
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

        const [[summary]] =
            await pool.query(
                `
                SELECT
                    COUNT(*) AS total_customer,
                    SUM(qty) AS total_qty,
                    SUM(subtotal) AS total_nominal
                FROM orders
                WHERE image_msg_id = ?
                AND status='draft'
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
                activePage:
                    "interest-order-detail",

                pageTitle:
                    "Interest Order Detail",

                pageDescription:
                    "Detail Produk Yang Dicari Customer",

                product:
                    orders[0],

                orders,
                summary,
            }
        );

    }
);

// Approve Interest Order
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

// Orders
app.get(
    "/orders",
    async (req, res) => {

        const pool =
            require("./database/db");

        const [orders] =
            await pool.query(`
            SELECT

                lid,

                MAX(nama) nama,

                MAX(nohp) nohp,

                COUNT(*) total_produk,

                SUM(qty) total_qty,

                SUM(subtotal) grand_total,

                MAX(created_at) created_at

            FROM orders

            WHERE status='approved' and invoice_no is null

            GROUP BY lid

            ORDER BY MAX(created_at) DESC
            `);

        res.render(
            "orders",
            {
                activePage:
                    "orders",

                pageTitle:
                "Orders",

                pageDescription:
                "Daftar Produk Yang Berhasil di Dapatkan",

                orders
            }
        );

    }
);

// Order Detail
// app.get(
//     "/orders/:lid",
//     async (req,res) => {

//         const pool =
//             require("./database/db");

//         const [orders] =
//             await pool.query(
//                 `
//                 SELECT *
//                 FROM orders
//                 WHERE lid=?
//                 AND status='approved' and invoice_no is null
//                 `,
//                 [req.params.lid]
//             );

//         res.render(
//             "order-detail",
//             {
//                 activePage:
//                     "orders",

//                 pageTitle:
//                     "Order Detail",

//                 orders
//             }
//         );

//     }
// );
app.get(
    "/orders/:nohp",
    async (req,res) => {

        const pool =
            require("./database/db");

        const nohp =
            req.params.nohp;

        const [orders] =
            await pool.query(
                `
                SELECT *
                FROM orders
                WHERE nohp=?
                AND status='approved' 
                AND invoice_no is null
                ORDER BY id DESC
                `,
                [nohp]
            );

        const [[summary]] =
            await pool.query(
                `
                SELECT

                    COUNT(*) total_produk,

                    SUM(qty) total_qty,

                    SUM(subtotal) grand_total

                FROM orders

                WHERE nohp=?
                AND status='approved' 
                AND invoice_no is null
                `,
                [nohp]
            );

        res.render(
            "order-detail",
            {                
                activePage: "orders",

                pageTitle: "Order Detail",

                pageDescription: "Detail Produk Yang Berhasil di Dapatkan",

                orders,

                summary
            }
        );

    }
);

// Invoices
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
                activePage:
                    "invoices",

                pageTitle:
                    "Invoices",

                pageDescription:
                    "Invoice dan status pembayaran",

                invoices
            }
        );

    }
);

// Invoice Detail
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
               SELECT

                    ii.*,

                    o.photo_path

                FROM invoice_items ii

                LEFT JOIN orders o
                    ON o.invoice_no = ii.invoice_no
                    AND o.produk = ii.produk

                WHERE ii.invoice_no = ?
                `,
                [invoiceNo]
            );
            

        res.render(
            "invoice-detail",
            {
                activePage:
                    "invoice-detail",

                pageTitle:
                    "Invoice Detail",

                pageDescription:
                    "Detail invoice dan item",

                invoice,
                items
            }
        );

    }
);

// Send Invoice
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
            await pool.query(
                `
                UPDATE invoices
                SET wa_sent = 1
                WHERE invoice_no = ?
                `,
                [invoiceNo]
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

// Invoice Paid
app.post(
    "/invoices/paid/:invoiceNo",
    async (req, res) => {

        try {

            const pool =
                require("./database/db");

            await pool.query(
                `
                UPDATE invoices
                SET status='paid'
                WHERE invoice_no=?
                `,
                [
                    req.params.invoiceNo
                ]
            );

            return res.json({

                success: true

            });

        } catch (err) {

            console.log(err);

            return res.status(500).json({

                success: false

            });

        }

    }
);

// Generate Invoice
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

// // Generate Invoice for Orders
// app.post(
//     "/orders/generate-invoice",
//     async (req, res) => {

//         try {

//             const pool =
//                 require("./database/db");

//             const ids =
//                 req.body.ids || [];

//             const [orders] =
//                 await pool.query(
//                     `
//                     SELECT *
//                     FROM orders
//                     WHERE id IN (?)
//                     `,
//                     [ids]
//                 );

//             const groups =
//                 {};

//             for (
//                 const order
//                 of orders
//             ) {

//                 if (
//                     !groups[
//                         order.nohp
//                     ]
//                 ) {

//                     groups[
//                         order.nohp
//                     ] = [];

//                 }

//                 groups[
//                     order.nohp
//                 ].push(
//                     order
//                 );

//             }

//             for (
//                 const nohp
//                 in groups
//             ) {

//                 const invoiceNo =
//                     generateInvoiceNo();

//                 const orderIds =
//                     groups[
//                         nohp
//                     ].map(
//                         x => x.id
//                     );

//                 await pool.query(
//                     `
//                     UPDATE orders
//                     SET invoice_no = ?
//                     WHERE id IN (?)
//                     `,
//                     [
//                         invoiceNo,
//                         orderIds
//                     ]
//                 );

//             }

//             res.json({

//                 success: true,

//                 message:
//                     "Invoice berhasil dibuat"

//             });

//         } catch (err) {

//             console.log(err);

//             res.json({

//                 success: false,

//                 message:
//                     "Terjadi kesalahan"

//             });

//         }

//     }
// );
app.post(
    "/orders/generate-invoice/:nohp",
    async (req,res) => {

        try{

            const pool =
                require("./database/db");

            const nohp =
                req.params.nohp;

            const [orders] =
                await pool.query(
                    `
                    SELECT *
                    FROM orders
                    WHERE nohp=?
                    AND status='approved'
                    `,
                    [nohp]
                );

            if(
                orders.length === 0
            ){
                return res.json({
                    success:false
                });
            }

            const invoiceNo =
                generateInvoiceNo();

            const nama =
                orders[0].nama;

            const totalItem =
                orders.length;

            const totalQty =
                orders.reduce(
                    (a,b)=>
                    a + Number(b.qty),
                    0
                );

            const grandTotal =
                orders.reduce(
                    (a,b)=>
                    a + Number(b.subtotal),
                    0
                );

            await pool.query(
                `
                INSERT INTO invoices
                (
                    invoice_no,
                    nohp,
                    nama,
                    total_item,
                    total_qty,
                    grand_total,
                    status
                )
                VALUES
                (
                    ?,?,?,?,?,?,'unpaid'
                )
                `,
                [
                    invoiceNo,
                    nohp,
                    nama,
                    totalItem,
                    totalQty,
                    grandTotal
                ]
            );

            for(
                const item
                of orders
            ){

                await pool.query(
                    `
                    INSERT INTO invoice_items
                    (
                        invoice_no,
                        produk,
                        harga,
                        qty,
                        subtotal
                    )
                    VALUES
                    (?,?,?,?,?)
                    `,
                    [
                        invoiceNo,
                        item.produk,
                        item.harga,
                        item.qty,
                        item.subtotal
                    ]
                );

            }

            await pool.query(
                `
                UPDATE orders
                SET invoice_no=?
                WHERE nohp=?
                AND status='approved'
                `,
                [
                    invoiceNo,
                    nohp
                ]
            );

            res.json({

                success:true,

                invoiceNo

            });

        }catch(err){

            console.log(err);

            res.json({

                success:false

            });

        }

    }
);

//customer
app.get(
    "/customers",
    async (req,res) => {

        const pool =
            require("./database/db");

        const [customers] =
            await pool.query(
                `
                SELECT

                    nohp,

                    MAX(nama) nama,

                    COUNT(*) total_order,

                    SUM(qty) total_qty,

                    SUM(subtotal) total_belanja,

                    MAX(created_at) last_order

                FROM orders

                GROUP BY nohp

                ORDER BY total_belanja DESC
                `
            );

        res.render(
            "customers",
            {
                activePage:
                    "customers",

                pageTitle:
                    "Customers",

                pageDescription:
                    "Daftar Customer",

                customers
            }
        );

    }
);

//customer detail
app.get(
    "/customers/:nohp",
    async (req,res) => {

        const pool =
            require("./database/db");

        const nohp =
            req.params.nohp;

        const [orders] =
        await pool.query(
            `
            SELECT
                id,
                nama,
                nohp,
                produk,
                harga,
                qty,
                subtotal,
                status,
                invoice_no,
                photo_path,
                created_at
            FROM orders
            WHERE nohp=?
            ORDER BY id DESC
            `,
            [nohp]
        );

        if(
            orders.length === 0
        ){

            return res.redirect(
                "/customers"
            );

        }

        res.render(
            "customer-detail",
            {
                activePage:
                    "customers",

                pageTitle:
                    "Customer Detail",

                pageDescription:
                    "Riwayat Customer",

                customer:
                    orders[0],

                orders
            }
        );

    }
);


const QRCode =
    require("qrcode");

const whatsappState =
    require(
        "./whatsapp/state"
    );

 // WhatsApp Status
app.get(
    "/whatsapp",
    async (req, res) => {
        const pool =
            require("./database/db");
        try {
            const [[orderToday]] =
            await pool.query(`
                SELECT
                    COUNT(*) total
                FROM orders
                WHERE DATE(created_at)=CURDATE()
            `);

            const [[interestToday]] =
            await pool.query(`
                SELECT
                    COUNT(*) total
                FROM orders
                WHERE DATE(created_at)=CURDATE()
            `);

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
                    activePage:
                        "whatsapp",
                    pageTitle:
                        "WhatsApp",

                    pageDescription:
                        "Status koneksi WhatsApp",

                    status:
                        whatsappState.connected
                            ? "Connected"
                            : "Disconnected",

                    phone:
                        whatsappState.phone ||
                        "-",

                    qr:
                        qrImage,

                    orderToday:
                        orderToday.total,
                    interestToday:
                        interestToday.total
                }
            );

        } catch (err) {

            console.log(err);

            res.render(
                "whatsapp",
                {
                    activePage:
                        "whatsapp",
                    pageTitle:
                        "WhatsApp",

                    pageDescription:
                        "Status koneksi WhatsApp",

                    status:
                        "Disconnected",

                    phone:
                        "-",

                    qr:
                        null,

                    orderToday:
                        0,
                    interestToday:
                        0
                }
            );

        }

    }
);

// WhatsApp API


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
require("dotenv").config();

const initDatabase =
    require("./database/init");
const pool =
    require("./database/db");
const {
    ensureWhatsAppSession,
    getWhatsAppState,
    bootstrapWhatsAppSessions
} = require("./whatsapp/baileys");

const express =
    require("express");
const session =
    require("express-session");
const passport =
    require("passport");
const GoogleStrategy =
    require(
        "passport-google-oauth20"
    ).Strategy;

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

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "jastiper-google-login",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            maxAge:
                1000 * 60 * 60 * 24
        }
    })
);

app.use(
    passport.initialize()
);
app.use(
    passport.session()
);

function mapUserRow(user) {

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        googleId:
            user.google_id,
        email: user.email,
        displayName:
            user.display_name,
        photo:
            user.photo_url || ""
    };

}

async function upsertGoogleUser(
    profile
) {

    const email =
        profile.emails?.[0]?.value || "";

    if (!email) {
        return null;
    }

    await pool.query(
        `
        INSERT INTO users
        (
            google_id,
            email,
            display_name,
            photo_url
        )
        VALUES
        (
            ?,?,?,?
        )
        ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            display_name = VALUES(display_name),
            photo_url = VALUES(photo_url)
        `,
        [
            profile.id,
            email,
            profile.displayName ||
                email,
            profile.photos?.[0]?.value ||
                ""
        ]
    );

    const [[user]] =
        await pool.query(
            `
            SELECT *
            FROM users
            WHERE google_id = ?
            LIMIT 1
            `,
            [profile.id]
        );

    return mapUserRow(user);

}

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

passport.serializeUser(
    (user, done) =>
        done(null, user.id)
);
passport.deserializeUser(
    async (userId, done) => {
        try {
            const [[user]] =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [userId]
                );

            done(
                null,
                mapUserRow(user)
            );
        } catch (err) {
            done(err);
        }
    }
);

passport.use(
    new GoogleStrategy(
        {
            clientID:
                process.env.GOOGLE_CLIENT_ID,
            clientSecret:
                process.env.GOOGLE_CLIENT_SECRET,
            callbackURL:
                process.env.GOOGLE_CALLBACK_URL
        },
        async (
            accessToken,
            refreshToken,
            profile,
            done
        ) => {
            try {
                const user =
                    await upsertGoogleUser(
                        profile
                    );

                return done(
                    null,
                    user
                );
            } catch (err) {
                return done(err);
            }
        }
    )
);

function getUserId(req) {

    return req.user.id;

}

app.use(
    (req, res, next) => {
        res.locals.currentUser =
            req.user || null;
        next();
    }
);

app.get(
    "/login",
    (req, res) => {
        if(
            req.isAuthenticated &&
            req.isAuthenticated()
        ) {
            return res.redirect("/");
        }

        res.render(
            "login",
            {
                layout: false,
                pageTitle: "Login",
                error:
                    req.query.error || ""
            }
        );
    }
);

app.get(
    "/auth/google",
    passport.authenticate(
        "google",
        {
            scope: ["profile", "email"],
            prompt: "select_account"
        }
    )
);

app.get(
    "/auth/google/callback",
    (req, res, next) => {
        passport.authenticate(
            "google",
            (err, user) => {
                if(err){
                    return next(err);
                }

                if(!user){
                    return res.redirect(
                        "/login?error=login_failed"
                    );
                }

                req.logIn(
                    user,
                    loginErr => {
                        if(loginErr){
                            return next(loginErr);
                        }

                        ensureWhatsAppSession(
                            user
                        ).catch(err => {
                            console.log(err);
                        });

                        return res.redirect("/");
                    }
                );
            }
        )(req, res, next);
    }
);

app.use(
    (req, res, next) => {
        const publicPaths = [
            "/login",
            "/auth/google",
            "/auth/google/callback"
        ];

        if(publicPaths.includes(req.path)){
            return next();
        }

        if(
            req.isAuthenticated &&
            req.isAuthenticated()
        ) {
            return next();
        }

        return res.redirect("/login");
    }
);

app.get(
    "/logout",
    (req, res, next) => {
        req.logout(err => {
            if(err){
                return next(err);
            }

            req.session.destroy(() => {
                res.clearCookie("connect.sid");
                res.redirect("/login");
            });
        });
    }
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
        const userId =
            getUserId(req);

        const {
            startDate = "",
            endDate = ""
        } = req.query;

        const orderConditions = [
            "user_id = ?"
        ];
        const orderParams = [userId];
        const invoiceConditions = [
            "user_id = ?"
        ];
        const invoiceParams = [userId];
        const paidInvoiceConditions = [
            "user_id = ?",
            "status='paid'"
        ];
        const paidInvoiceParams = [userId];

        if(startDate){
            orderConditions.push(
                "DATE(created_at) >= ?"
            );
            orderParams.push(startDate);
            invoiceConditions.push(
                "DATE(created_at) >= ?"
            );
            invoiceParams.push(startDate);
            paidInvoiceConditions.push(
                "DATE(created_at) >= ?"
            );
            paidInvoiceParams.push(startDate);
        }

        if(endDate){
            orderConditions.push(
                "DATE(created_at) <= ?"
            );
            orderParams.push(endDate);
            invoiceConditions.push(
                "DATE(created_at) <= ?"
            );
            invoiceParams.push(endDate);
            paidInvoiceConditions.push(
                "DATE(created_at) <= ?"
            );
            paidInvoiceParams.push(endDate);
        }

        const orderWhereSql =
            `WHERE ${orderConditions.join(" AND ")}`;

        const invoiceWhereSql =
            `WHERE ${invoiceConditions.join(" AND ")}`;

        const paidInvoiceWhereSql =
            `WHERE ${paidInvoiceConditions.join(" AND ")}`;

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
            `, orderParams);

        const [[customerStat]] =
            await pool.query(`
                SELECT
                    COUNT(DISTINCT nohp)
                    total_customer
                FROM orders
                ${orderWhereSql}
            `, orderParams);

        const [[invoiceStat]] =
            await pool.query(`
                SELECT
                    COUNT(*) total_invoice
                FROM invoices
                ${invoiceWhereSql}
            `, invoiceParams);

        const [[revenueStat]] =
            await pool.query(`
                SELECT
                    IFNULL(
                        SUM(grand_total),
                        0
                    ) revenue
                FROM invoices
                ${paidInvoiceWhereSql}
            `, paidInvoiceParams);

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
            `, orderParams);

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
            `, orderParams);

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
        `, orderParams);

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
        `, paidInvoiceParams);

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
        const userId =
            getUserId(req);

       const [products] =
        await pool.query(`
            SELECT

                image_msg_id,

                MAX(produk) produk,

                MAX(photo_path) photo_path,

                COUNT(*) total_order,

                SUM(qty) total_qty

            FROM orders

            WHERE user_id = ?
            AND status='draft'

            GROUP BY image_msg_id

            ORDER BY MAX(created_at) DESC
        `, [userId]);

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
        const userId =
            getUserId(req);

        const imageMsgId =
            req.params.imageMsgId;

        const [orders] =
            await pool.query(
                `
                SELECT *
                FROM orders
                WHERE user_id = ?
                AND image_msg_id = ?
                AND status='draft'
                ORDER BY id DESC
                `,
                [
                    userId,
                    imageMsgId
                ]
            );

        const [[summary]] =
            await pool.query(
                `
                SELECT
                    COUNT(*) AS total_customer,
                    SUM(qty) AS total_qty,
                    SUM(subtotal) AS total_nominal
                FROM orders
                WHERE user_id = ?
                AND image_msg_id = ?
                AND status='draft'
                `,
                [
                    userId,
                    imageMsgId
                ]
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
            const userId =
                getUserId(req);

            const ids =
                req.body.ids || [];

            const [orders] =
                await pool.query(
                    `
                    SELECT *
                    FROM orders
                    WHERE user_id = ?
                    AND id IN (?)
                    `,
                    [
                        userId,
                        ids
                    ]
                );

            await pool.query(
                `
                UPDATE orders
                SET status='approved'
                WHERE user_id = ?
                AND id IN (?)
                `,
                [
                    userId,
                    ids
                ]
            );

            const sock =
                getSocket(userId);

            for (
                const order
                of orders
            ) {

                try {

                    if (sock) {
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
                    }

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
        const userId =
            getUserId(req);

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

            WHERE user_id = ?
            AND status='approved'
            AND invoice_no is null

            GROUP BY lid

            ORDER BY MAX(created_at) DESC
            `, [userId]);

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
        const userId =
            getUserId(req);

        const nohp =
            req.params.nohp;

        const [orders] =
            await pool.query(
                `
                SELECT *
                FROM orders
                WHERE user_id = ?
                AND nohp=?
                AND status='approved' 
                AND invoice_no is null
                ORDER BY id DESC
                `,
                [
                    userId,
                    nohp
                ]
            );

        const [[summary]] =
            await pool.query(
                `
                SELECT

                    COUNT(*) total_produk,

                    SUM(qty) total_qty,

                    SUM(subtotal) grand_total

                FROM orders

                WHERE user_id = ?
                AND nohp=?
                AND status='approved' 
                AND invoice_no is null
                `,
                [
                    userId,
                    nohp
                ]
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
        const userId =
            getUserId(req);

        const [invoices] =
            await pool.query(`
                SELECT *
                FROM invoices
                WHERE user_id = ?
                ORDER BY id DESC
            `, [userId]);

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
        const userId =
            getUserId(req);

        const invoiceNo =
            req.params.invoiceNo;

        const [[invoice]] =
            await pool.query(
                `
                SELECT *
                FROM invoices
                WHERE user_id = ?
                AND invoice_no=?
                `,
                [
                    userId,
                    invoiceNo
                ]
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
                    ON o.user_id = ii.user_id
                    AND o.invoice_no = ii.invoice_no
                    AND o.produk = ii.produk

                WHERE ii.user_id = ?
                AND ii.invoice_no = ?
                `,
                [
                    userId,
                    invoiceNo
                ]
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
            const userId =
                getUserId(req);

            const invoiceNo =
                req.params.invoiceNo;

            const [[invoice]] =
                await pool.query(
                    `
                    SELECT *
                    FROM invoices
                    WHERE user_id = ?
                    AND invoice_no=?
                    `,
                    [
                        userId,
                        invoiceNo
                    ]
                );

            const [items] =
                await pool.query(
                    `
                    SELECT *
                    FROM invoice_items
                    WHERE user_id = ?
                    AND invoice_no=?
                    `,
                    [
                        userId,
                        invoiceNo
                    ]
                );

            await sendInvoiceWA(
                userId,
                invoice,
                items
            );
            await pool.query(
                `
                UPDATE invoices
                SET wa_sent = 1
                WHERE user_id = ?
                AND invoice_no = ?
                `,
                [
                    userId,
                    invoiceNo
                ]
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
            const userId =
                getUserId(req);

            await pool.query(
                `
                UPDATE invoices
                SET status='paid'
                WHERE user_id = ?
                AND invoice_no=?
                `,
                [
                    userId,
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
            const userId =
                getUserId(req);

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
                        nohp,
                        userId
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
            const userId =
                getUserId(req);

            const nohp =
                req.params.nohp;

            const invoiceNo =
                await generateInvoice(
                    nohp,
                    userId
                );

            if(!invoiceNo){
                return res.json({
                    success:false
                });
            }

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
        const userId =
            getUserId(req);

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

                WHERE user_id = ?

                GROUP BY nohp

                ORDER BY total_belanja DESC
                `
                ,
                [userId]
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
        const userId =
            getUserId(req);

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
            WHERE user_id = ?
            AND nohp=?
            ORDER BY id DESC
            `,
            [
                userId,
                nohp
            ]
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

 // WhatsApp Status
app.get(
    "/whatsapp",
    async (req, res) => {

        try {
            const userId =
                getUserId(req);

            await ensureWhatsAppSession(
                req.user
            );

            const whatsappState =
                getWhatsAppState(userId);
            const [[orderToday]] =
            await pool.query(`
                SELECT
                    COUNT(*) total
                FROM orders
                WHERE user_id = ?
                AND DATE(created_at)=CURDATE()
            `, [userId]);

            const [[interestToday]] =
            await pool.query(`
                SELECT
                    COUNT(*) total
                FROM orders
                WHERE user_id = ?
                AND status='draft'
                AND DATE(created_at)=CURDATE()
            `, [userId]);

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
        const whatsappState =
            getWhatsAppState(
                getUserId(req)
            );

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

        await bootstrapWhatsAppSessions();

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

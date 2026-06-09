require("dotenv").config();

const startWhatsApp =
    require("./whatsapp/baileys");

const express =
    require("express");

const initDatabase =
    require("./database/init");

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
    (req, res) => {

        res.render(
            "invoices"
        );

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
app.listen(
    PORT,
    async () => {

        await initDatabase();

        console.log(
            `🚀 Server running on port ${PORT}`
        );

        await startWhatsApp();

    }
);
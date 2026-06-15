const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");


const P = require("pino");

const {
    saveOrder,
    approveOrder,   
    getOrderByCustomerMsgID,
    orderExists
} = require("./orderHandler");

const fs =
    require("fs");

const path =
    require("path");

const {
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const state = require("./state");

const {
    setSocket
} = require(
    "./socketStore"
);

const ALLOWED_GROUPS = [

    "120363403061057636@g.us",
    "120363212854284513@g.us"

];

const ADMINS = [

    "6281808385596@s.whatsapp.net",
    "222591159693354@s.whatsapp.net", //audi
    "274006129287259@s.whatsapp.net", //gw
    "222591159693354@lid"


];

async function startWhatsApp() {

    try {

        console.log("🚀 Starting WhatsApp...");

        const {
            state: authState,
            saveCreds
        } = await useMultiFileAuthState("./auth");

        const {
            version
        } = await fetchLatestBaileysVersion();

        console.log(
            "Baileys Version:",
            version
        );

        const sock = makeWASocket({

            version,

            auth: authState,

            logger: P({
                level: "silent"
            })

        });
        setSocket(sock);

        sock.ev.on(
            "creds.update",
            saveCreds
        );

        const orderState =
        require("./orderState");

        sock.ev.on(
            "messages.upsert",
            async ({ messages }) => {

                try {

                    const msg =
                        messages[0];

                    if (!msg)
                        return;

                    //membaca group tertentu
                    const chatId =
                        msg.key.remoteJid;

                    if (
                        !ALLOWED_GROUPS.includes(
                            chatId
                        )
                    ) {
                        return;
                    }

                    const ext =
                        msg.message?.extendedTextMessage;

                   if (
                        ext?.contextInfo?.quotedMessage?.imageMessage
                    ) {

                        const imageMessage =
                        ext.contextInfo
                            .quotedMessage
                            .imageMessage;

                        const quotedSender =
                            ext.contextInfo.participantAlt ||
                            ext.contextInfo.participant;

                        console.log(
                            "Quoted Sender:",
                            quotedSender
                        );

                        if (
                            !ADMINS.includes(
                                quotedSender
                            )
                        ) {

                            console.log(
                                "⛔ Bukan gambar admin"
                            );

                            return;

                        }

                        const imageData =
                            JSON.stringify(
                                imageMessage
                            );
                        console.log(
                            "Image loaded from DB"
                        );

                        const imageMsgID =
                            ext.contextInfo
                                .stanzaId;

                        const fileName =
                            `product_${imageMsgID}.jpg`;

                        const photoPath =
                            `/uploads/${fileName}`;

                        const savePath =
                            path.join(
                                __dirname,
                                "../public/uploads",
                                fileName
                            );

                        if (
                            !fs.existsSync(
                                savePath
                            )
                        ) {

                            console.log(
                                "📥 Download foto produk..."
                            );

                        }
                        const buffer =
                                await downloadMediaMessage(
                                    {
                                        message: {
                                            imageMessage
                                        }
                                    },
                                    "buffer",
                                    {},
                                    {
                                        logger: P({
                                            level: "silent"
                                        }),
                                        reuploadRequest:
                                            sock.updateMediaMessage
                                    }
                                );

                            fs.writeFileSync(
                                savePath,
                                buffer
                            );

                            console.log(
                                "✅ Foto produk disimpan:",
                                savePath
                            );

                       

                        const directPath =
                            imageMessage.directPath;

                        const mediaKey =
                            Buffer
                                .from(imageMessage.mediaKey)
                                .toString("base64");

                        const caption =
                            ext.contextInfo
                                .quotedMessage
                                .imageMessage
                                .caption || "";

                        const lines =
                            caption.split("\n");

                        const produk =
                            lines[0]?.trim() || "";

                        let harga = 0;

                        const hargaText =
                            lines[1]
                                ?.toLowerCase()
                                .replace(/k/g, "")
                                .replace(/\s+/g, "")
                                || "";

                        if (
                            hargaText.includes("+")
                        ) {

                            const parts =
                                hargaText.split("+");

                                    harga =
                                        parts.reduce(
                                            (sum, item) =>
                                                sum + parseInt(item || 0),
                                            0
                                        ) * 1000;

                                }
                                else {

                                    harga =
                                        parseInt(
                                            hargaText || 0
                                        ) * 1000;

                                }

                                console.log(
                                    "Produk:",
                                    produk,
                                    "Harga:",
                                    harga
                                );

                        let qty = 1;

                        const qtyMatch =
                            ext.text?.match(
                                /(\d+)/
                            );

                        if (qtyMatch) {

                            qty =
                                parseInt(
                                    qtyMatch[1]
                                );

                        }

                        const subtotal =
                            harga * qty;

                        const nohp =
                            (
                                msg.key.participantAlt ||
                                ""
                            )
                                .replace(
                                    "@s.whatsapp.net",
                                    ""
                                );
                        const exists =
                            await orderExists(
                                msg.key.id
                            );

                        if (exists) {

                            console.log(
                                "⚠️ Order sudah ada"
                            );

                            return;

                        }
                        const customerText =
                            (ext.text || "")
                                .toLowerCase()
                                .trim();

                        const isOrder =
                        /\bmau\b/i.test(
                            customerText
                        );

                        if (!isOrder) {

                            console.log(
                                "⛔ Bukan order"
                            );

                            return;

                        }

                        await saveOrder({

                            lid:
                                msg.key.participant,

                            nohp,

                            nama:
                                msg.pushName,

                            produk,

                            harga,

                            qty,

                            subtotal,

                            pesan:
                                ext.text,

                            customerMsgID:
                                msg.key.id,

                            imageMsgID:
                                ext.contextInfo
                                    .stanzaId,
                            directPath,

                            mediaKey,

                            imageData,
                            photoPath

                        });

                        console.log(
                            "📝 Draft Order Saved"
                        );

                    }

                } catch (err) {

                    console.log(
                        err
                    );

                }

            }
        );

       sock.ev.on(
            "messages.reaction",
            async (reactions) => {

                try {


                    const reaction =
                        reactions[0];

                     const groupId =
                            reaction.key.remoteJid;

                        if (
                            !ALLOWED_GROUPS.includes(
                                groupId
                            )
                        ) {

                            // console.log(
                            //     "⛔ Group tidak diizinkan:",
                            //     groupId
                            // );

                            return;

                        }

                    if (!reaction)
                        return;
                    console.dir(
                        reaction,
                        { depth: null }
                    );
                    const emoji =
                        reaction.reaction?.text;

                    if (
                        emoji !== "✅"
                    )
                        return;
                    
                    const sender =
                        reaction.reaction.key.participantAlt;

                    console.log(
                        "Reaction by:",
                        sender
                    );

                    // if (
                    //     !ADMINS.includes(sender)
                    // ) {

                    //     console.log(
                    //         "⛔ Bukan admin"
                    //     );

                    //     return;

                    // }

                    const customerMsgID =
                        reaction.key.id;

                    const order =
                        await getOrderByCustomerMsgID(
                            customerMsgID
                        );

                    if (!order) {

                        console.log(
                            "Order tidak ditemukan"
                        );

                        return;

                    }
                    console.log(
                        "Order ditemukan:",
                        order.id
                    );  
                    const imageMessage =
                    JSON.parse(
                        order.image_data
                    );

                    const fileName =
                        `order_${order.id}.jpg`;

                    const savePath =
                        path.join(
                            __dirname,
                            "../public/uploads",
                            fileName
                        );
                    console.log(
                        "Image data loaded"
                    );
                    const buffer =
                    await downloadMediaMessage(
                        {
                            message: {
                                imageMessage
                            }
                        },
                        "buffer",
                        {},
                        {
                            logger: P({
                                level: "silent"
                            }),
                            reuploadRequest:
                                sock.updateMediaMessage
                        }
                    );

                    console.log(
                        "Buffer size:",
                        buffer.length
                    );
                    fs.writeFileSync(
                        savePath,
                        buffer
                    );

                    console.log(
                        "📸 Foto tersimpan:",
                        savePath
                    );

                    console.dir(
                        imageMessage,
                        { depth: null }
                    );

                    console.log(
                        "✅ APPROVED:",
                        customerMsgID
                    );

                    await approveOrder(
                        customerMsgID
                    );

                    console.log(
                        "📝 Order Updated"
                    );

                } catch (err) {

                    console.log(err);

                }

            }
        );

        sock.ev.on(
            "connection.update",
            async (update) => {

                console.log(
                    "UPDATE:",
                    update
                );

                const {
                    connection,
                    lastDisconnect,
                    qr
                } = update;

                if (qr) {

                    console.log(
                        "📱 QR Generated"
                    );

                    state.qr = qr;
                }

                if (
                    connection === "open"
                ) {

                    console.log(
                        "✅ WhatsApp Connected"
                    );

                    state.connected = true;
                    state.qr = null;
                    state.phone = sock.user?.id || null;
                    state.lastConnected = new Date();

                    const groups =
                        await sock.groupFetchAllParticipating();

                    // console.log(
                    //     "\n===== GROUP LIST =====\n"
                    // );

                    // Object.values(groups).forEach(
                    //     group => {

                    //         console.log(
                    //             `${group.subject} => ${group.id}`
                    //         );

                    //     }
                    // );

                }

                if (
                    connection === "close"
                ) {

                    console.log(
                        "❌ WhatsApp Disconnected"
                    );

                    console.dir(
                        lastDisconnect,
                        { depth: null }
                    );

                    state.connected = false;
                    state.phone = null;

                    const shouldReconnect =
                        lastDisconnect?.error?.output?.statusCode !==
                        DisconnectReason.loggedOut;

                    if (
                        shouldReconnect
                    ) {

                        console.log(
                            "🔄 Reconnect in 5 sec..."
                        );

                        setTimeout(
                            () => {
                                startWhatsApp();
                            },
                            5000
                        );

                    }

                }

            }
        );

        return sock;

    } catch (err) {

        console.log(
            "❌ WhatsApp Startup Error"
        );

        console.error(err);

    }

}

module.exports =
    startWhatsApp;
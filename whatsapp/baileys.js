const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");

const {
    saveOrder,
    approveOrder
} = require("./orderHandler");

const fs =
    require("fs");

const path =
    require("path");

const {
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const state = require("./state");

const ALLOWED_GROUPS = [

    "120363403061057636@g.us"

];

const ADMINS = [

    "6281808385596@s.whatsapp.net"

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

                        const hargaMatch =
                            caption.match(
                                /(\d+)\s*k/i
                            );

                        if (hargaMatch) {

                            harga =
                                parseInt(
                                    hargaMatch[1]
                                ) * 1000;

                        }

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
                                    .stanzaId

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

                    if (
                        !ADMINS.includes(sender)
                    ) {

                        console.log(
                            "⛔ Bukan admin"
                        );

                        return;

                    }

                    const customerMsgID =
                        reaction.key.id;

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

                    console.log(
                        "\n===== GROUP LIST =====\n"
                    );

                    Object.values(groups).forEach(
                        group => {

                            console.log(
                                `${group.subject} => ${group.id}`
                            );

                        }
                    );

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
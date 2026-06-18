const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    downloadMediaMessage,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const P =
    require("pino");
const fs =
    require("fs");
const path =
    require("path");
const pool =
    require("../database/db");

const {
    saveOrder,
    approveOrder,
    getOrderByCustomerMsgID,
    orderExists
} = require("./orderHandler");
const {
    isAllowedGroup
} = require("../database/groups");
const {
    setSocket,
    getSocket,
    removeSocket
} = require("./socketStore");
const {
    getState,
    setState
} = require("./state");

const startPromises =
    new Map();

function normalizeJid(jid = "") {

    return String(jid)
        .split("@")[0]
        .split(":")[0];

}

function getAuthDir(userId) {

    return path.join(
        __dirname,
        "../auth",
        String(userId)
    );

}

function hasWhatsAppAuth(userId) {

    const authDir =
        getAuthDir(userId);

    if (
        !fs.existsSync(authDir)
    ) {
        return false;
    }

    const files =
        fs.readdirSync(authDir);

    return files.length > 0;

}

function parseHarga(captionLine = "") {

    const hargaText =
        captionLine
            .toLowerCase()
            .replace(/rp/gi, "")
            .replace(/\./g, "")
            .replace(/\s+/g, "")
            .replace(/k/g, "");

    if (!hargaText) {
        return 0;
    }

    if (
        hargaText.includes("+")
    ) {
        return hargaText
            .split("+")
            .reduce(
                (sum, item) =>
                    sum +
                    parseInt(item || 0, 10),
                0
            ) * 1000;
    }

    return (
        parseInt(hargaText || 0, 10) *
        1000
    );

}

async function saveQuotedImage({
    sock,
    imageMessage,
    fileName
}) {

    const uploadDir =
        path.join(
            __dirname,
            "../public/uploads"
        );
    const savePath =
        path.join(
            uploadDir,
            fileName
        );

    fs.mkdirSync(
        uploadDir,
        { recursive: true }
    );

    if (
        !fs.existsSync(savePath)
    ) {
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
    }

    return `/uploads/${fileName}`;

}

async function handleIncomingOrder({
    sock,
    userId,
    msg
}) {

    const chatId =
        msg.key.remoteJid || "";

    if (
        !chatId.endsWith("@g.us")
    ) {
        return;
    }

    const allowed =
        await isAllowedGroup(
            userId,
            chatId
        );

    if (!allowed) {
        return;
    }

    const ext =
        msg.message?.extendedTextMessage;

    if (
        !ext?.contextInfo?.quotedMessage?.imageMessage
    ) {
        return;
    }

    const ownerJid =
        normalizeJid(
            sock.user?.id || ""
        );
    const quotedSender =
        normalizeJid(
            ext.contextInfo.participantAlt ||
            ext.contextInfo.participant ||
            ""
        );

    if (
        ownerJid !== quotedSender
    ) {
        return;
    }

    const customerText =
        (ext.text || "")
            .toLowerCase()
            .trim();

    if (
        !/\bmau\b/i.test(customerText)
    ) {
        return;
    }

    const exists =
        await orderExists(
            userId,
            msg.key.id
        );

    if (exists) {
        return;
    }

    const imageMessage =
        ext.contextInfo
            .quotedMessage
            .imageMessage;
    const imageMsgID =
        ext.contextInfo.stanzaId ||
        msg.key.id;
    const caption =
        imageMessage.caption || "";
    const lines =
        caption.split("\n");
    const produk =
        lines[0]?.trim() || "";
    const harga =
        parseHarga(lines[1] || "");
    const qtyMatch =
        ext.text?.match(/(\d+)/);
    const qty =
        qtyMatch
            ? parseInt(
                qtyMatch[1],
                10
            )
            : 1;
    const subtotal =
        harga * qty;
    const nohp =
        normalizeJid(
            msg.key.participantAlt ||
            msg.key.participant ||
            ""
        );
    const photoPath =
        await saveQuotedImage({
            sock,
            imageMessage,
            fileName:
                `product_${userId}_${imageMsgID}.jpg`
        });

    await saveOrder({
        userId,
        lid:
            msg.key.participant ||
            msg.key.participantAlt ||
            null,
        nohp,
        nama:
            msg.pushName || nohp,
        produk,
        harga,
        qty,
        subtotal,
        pesan: ext.text,
        customerMsgID:
            msg.key.id,
        imageMsgID,
        directPath:
            imageMessage.directPath || null,
        mediaKey:
            imageMessage.mediaKey
                ? Buffer
                    .from(
                        imageMessage.mediaKey
                    )
                    .toString("base64")
                : null,
        imageData:
            JSON.stringify(
                imageMessage
            ),
        photoPath
    });

}

async function handleReactionApproval({
    sock,
    userId,
    reaction
}) {

    const groupId =
        reaction.key.remoteJid || "";

    if (
        !groupId.endsWith("@g.us")
    ) {
        return;
    }

    const allowed =
        await isAllowedGroup(
            userId,
            groupId
        );

    if (!allowed) {
        return;
    }

    if (
        reaction.reaction?.text !==
        "✅"
    ) {
        return;
    }

    const sender =
        normalizeJid(
            reaction.reaction?.key?.participantAlt ||
            reaction.reaction?.key?.participant ||
            ""
        );
    const ownerJid =
        normalizeJid(
            sock.user?.id || ""
        );

    if (sender !== ownerJid) {
        return;
    }

    const customerMsgID =
        reaction.key.id;
    const order =
        await getOrderByCustomerMsgID(
            userId,
            customerMsgID
        );

    if (!order) {
        return;
    }

    await approveOrder(
        userId,
        customerMsgID
    );

}

async function ensureWhatsAppSession(
    user
) {

    const userId = user.id;

    if (
        startPromises.has(userId)
    ) {
        return startPromises.get(userId);
    }

    const existingSocket =
        getSocket(userId);
    const existingState =
        getState(userId);

    if (
        existingSocket &&
        (
            existingState.connected ||
            existingState.isStarting
        )
    ) {
        return existingSocket;
    }

    const startPromise =
        (async () => {
            try {
                const authDir =
                    getAuthDir(userId);

                fs.mkdirSync(
                    authDir,
                    { recursive: true }
                );

                setState(
                    userId,
                    {
                        isStarting: true
                    }
                );

                const {
                    state: authState,
                    saveCreds
                } =
                    await useMultiFileAuthState(
                        authDir
                    );
                const {
                    version
                } =
                    await fetchLatestBaileysVersion();

                const sock =
                    makeWASocket({
                        version,
                        auth: authState,
                        logger: P({
                            level: "silent"
                        })
                    });

                setSocket(
                    userId,
                    sock
                );

                sock.ev.on(
                    "creds.update",
                    saveCreds
                );

                sock.ev.on(
                    "messages.upsert",
                    async ({ messages }) => {
                        try {
                            const msg =
                                messages[0];

                            if (!msg) {
                                return;
                            }

                            await handleIncomingOrder({
                                sock,
                                userId,
                                msg
                            });
                        } catch (err) {
                            console.log(err);
                        }
                    }
                );

                sock.ev.on(
                    "messages.reaction",
                    async reactions => {
                        try {
                            const reaction =
                                reactions[0];

                            if (!reaction) {
                                return;
                            }

                            await handleReactionApproval({
                                sock,
                                userId,
                                reaction
                            });
                        } catch (err) {
                            console.log(err);
                        }
                    }
                );

                sock.ev.on(
                    "connection.update",
                    update => {
                        const {
                            connection,
                            lastDisconnect,
                            qr
                        } = update;

                        if (qr) {
                            setState(
                                userId,
                                {
                                    qr,
                                    connected: false
                                }
                            );
                        }

                        if (
                            connection === "open"
                        ) {
                            setState(
                                userId,
                                {
                                    connected: true,
                                    qr: null,
                                    phone:
                                        sock.user?.id ||
                                        null,
                                    lastConnected:
                                        new Date(),
                                    isStarting: false
                                }
                            );
                        }

                        if (
                            connection === "close"
                        ) {
                            removeSocket(userId);
                            setState(
                                userId,
                                {
                                    connected: false,
                                    phone: null,
                                    qr: null,
                                    isStarting: false
                                }
                            );

                            const shouldReconnect =
                                lastDisconnect?.error?.output?.statusCode !==
                                DisconnectReason.loggedOut;

                            if (
                                shouldReconnect
                            ) {
                                setTimeout(
                                    () => {
                                        ensureWhatsAppSession(
                                            user
                                        ).catch(
                                            err => {
                                                console.log(
                                                    err
                                                );
                                            }
                                        );
                                    },
                                    5000
                                );
                            }
                        }
                    }
                );

                return sock;
            } catch (err) {
                removeSocket(userId);
                setState(
                    userId,
                    {
                        connected: false,
                        qr: null,
                        isStarting: false
                    }
                );
                throw err;
            } finally {
                setState(
                    userId,
                    {
                        isStarting: false
                    }
                );
                startPromises.delete(
                    userId
                );
            }
        })();

    startPromises.set(
        userId,
        startPromise
    );

    return startPromise;

}

function getWhatsAppState(
    userId
) {

    return getState(userId);

}

async function bootstrapWhatsAppSessions() {

    const [users] =
        await pool.query(
            `
            SELECT
                id,
                email,
                display_name
            FROM users
            ORDER BY id ASC
            `
        );

    for (const user of users) {
        if (
            hasWhatsAppAuth(user.id)
        ) {
            ensureWhatsAppSession({
                id: user.id,
                email: user.email,
                displayName:
                    user.display_name
            }).catch(err => {
                console.log(err);
            });
        }
    }

}

module.exports = {
    ensureWhatsAppSession,
    getWhatsAppState,
    bootstrapWhatsAppSessions,
    hasWhatsAppAuth
};

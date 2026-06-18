const {
    getSocket
} = require(
    "./socketStore"
);

function formatRupiah(
    angka
) {

    return Number(
        angka || 0
    ).toLocaleString(
        "id-ID"
    );

}

async function sendInvoiceWA(
    userId,
    invoice,
    items
) {

    const sock =
        getSocket(userId);

    if (!sock) {

        throw new Error(
            "Socket WhatsApp tidak tersedia"
        );

    }

    let pesan =
`Halo kak ${invoice.nama}, Terimakasih sudah berbelanja di Nitip.MamaZZ! 🥰

Berikut aku share invoice ya ✨

━━━━━━━━━━━━━━━━━━
📋 *INVOICE MAMAZZ*
━━━━━━━━━━━━━━━━━━

🧾 *No Invoice* : ${invoice.invoice_no}

🛍️ *PESANAN*
`;

    items.forEach(
        item => {

            pesan +=
`▪️ ${item.produk}
   ${item.qty} x Rp${formatRupiah(item.harga)}
   Subtotal : Rp${formatRupiah(item.subtotal)}

`;

        }
    );

    pesan +=
`━━━━━━━━━━━━━━━━━━
📦 *RINGKASAN*
━━━━━━━━━━━━━━━━━━

Total Item : ${invoice.total_item}
Total Qty  : ${invoice.total_qty}

━━━━━━━━━━━━━━━━━━
💰 *TOTAL BELANJA*
*Rp${formatRupiah(invoice.grand_total)}*
━━━━━━━━━━━━━━━━━━

🏦 *PAYMENT BCA*
6042703083
a/n Auditya Angguni

⏳ Ditunggu paymentnya ya kak 🤩

Terimakasih sudah berbelanja 💕`;

    console.log(
        "Mengirim invoice ke:",
        invoice.nohp
    );

    await sock.sendMessage(
        `${invoice.nohp}@s.whatsapp.net`,
        {
            text: pesan
        }
    );

    console.log(
        "Invoice berhasil dikirim:",
        invoice.invoice_no
    );

    return true;

}

module.exports = {
    sendInvoiceWA
};

function parsePO(text) {

    const lines =
        text
        .split("\n")
        .map(x => x.trim())
        .filter(x => x);

    let nama = "";

    const products = [];

    for (const line of lines) {

        if (
            line.startsWith("📦") ||
            line.startsWith("💰")
        ) {
            continue;
        }

        // produk
        if (
            line.startsWith("*") ||
            line.startsWith("-")
        ) {

            let produk =
                line.replace(/^[*-]\s*/, "").trim();

            let qty = 1;

            // format x2 x3 x4

            let match =
                produk.match(/\sx(\d+)$/i);

            if(match){

                qty =
                    parseInt(
                        match[1]
                    );

                produk =
                    produk.replace(
                        /\sx\d+$/i,
                        ""
                    ).trim();

            }

            // format 2 3 4 di belakang

            else{

                match =
                    produk.match(/\s(\d+)$/);

                if(match){

                    qty =
                        parseInt(
                            match[1]
                        );

                    produk =
                        produk.replace(
                            /\s\d+$/,
                            ""
                        ).trim();

                }

            }

            products.push({

                nama,

                produk,

                qty

            });

            continue;

        }

        // jika bukan header dan bukan produk
        // maka dianggap nama baru

        nama = line;

    }

    return products;

}

module.exports = {
    parsePO
};
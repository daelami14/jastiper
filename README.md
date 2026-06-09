# Jastiper WhatsApp Order System

## Overview

Jastiper adalah aplikasi pencatatan order WhatsApp Group menggunakan Baileys dan MySQL.

Flow utama:

1. Admin mengirim foto produk ke grup.
2. Customer membalas (reply) foto produk.
3. Sistem membaca pesan reply customer.
4. Order belum dianggap valid.
5. Admin memberikan reaction ✅ pada pesan customer.
6. Sistem menyimpan order ke database.
7. Status order berubah menjadi approved.
8. Foto produk disimpan ke server dan ditampilkan pada halaman Orders.

---

## Features

### WhatsApp Integration

* Multi Device Login
* QR Login
* Auto Reconnect
* Group Restriction
* Admin Restriction

### Order Management

* Reply Foto Produk
* Auto Parsing Produk
* Auto Parsing Harga
* Auto Parsing Qty
* Auto Calculate Subtotal
* Approval menggunakan Reaction ✅
* Simpan ke Database MySQL

### Dashboard

* Daftar Order
* Status Order
* Foto Produk
* Customer Information

---

## Project Structure

```text
project/
│
├── auth/
├── database/
│   ├── db.js
│   └── init.js
│
├── public/
│   └── uploads/
│
├── views/
│
├── whatsapp/
│   ├── baileys.js
│   ├── state.js
│   ├── orderHandler.js
│   └── orderState.js
│
├── server.js
├── .env
└── package.json
```

---

## Installation

### Clone Repository

```bash
git clone <repository-url>
cd jastiper
```

### Install Dependency

```bash
npm install
```

### Environment

Buat file `.env`

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=jastiper
```

---

## Start Application

```bash
node server.js
```

atau

```bash
nodemon server.js
```

---

## WhatsApp Login

Buka:

```text
http://localhost:3000/whatsapp
```

Scan QR menggunakan WhatsApp.

---

## Allowed Groups

Di file:

```text
whatsapp/baileys.js
```

```javascript
const ALLOWED_GROUPS = [
    "1234567891011126@g.us"
];
```

Hanya grup yang terdaftar yang akan diproses.

---

## Admin Approval

```javascript
const ADMINS = [
    "6281234567896@s.whatsapp.net"
];
```

Hanya nomor admin yang dapat memberikan reaction:

```text
✅
```

untuk mengubah status order menjadi approved.

---

## Order Flow

### Admin

Mengirim foto produk:

```text
Taro
22k
```

### Customer

Reply ke foto:

```text
mau 3
```

### System

Menghasilkan:

```text
Produk   : Taro
Harga    : 22000
Qty      : 3
Subtotal : 66000
```

Status:

```text
draft
```

### Admin

Reaction:

```text
✅
```

Status:

```text
approved
```

Order disimpan ke database.

---

## Database Table

### orders

| Field           | Description       |
| --------------- | ----------------- |
| id              | Primary Key       |
| created_at      | Tanggal Order     |
| lid             | WhatsApp LID      |
| nohp            | Nomor HP          |
| nama            | Nama Customer     |
| produk          | Nama Produk       |
| harga           | Harga             |
| qty             | Qty               |
| subtotal        | Total             |
| pesan           | Pesan Customer    |
| photo_path      | Lokasi Foto       |
| customer_msg_id | ID Pesan Customer |
| image_msg_id    | ID Gambar         |
| status          | draft / approved  |

---

## Current Status

### Completed

* WhatsApp Connection
* QR Login
* Group Restriction
* Admin Restriction
* Reply Image Detection
* Auto Product Parsing
* Auto Price Parsing
* Auto Qty Parsing
* Order Save
* Approval Reaction
* Orders Page

### Next Development

* Customer Management
* Invoice Generator
* Invoice Detail
* Dashboard Statistics
* Group Management UI
* Admin Management UI
* Product Catalog
* Auto Invoice Number
* Export Excel
* Payment Tracking
* Shipping Tracking

---

## Tech Stack

* Node.js
* Express.js
* MySQL
* Baileys
* EJS
* Tabler UI

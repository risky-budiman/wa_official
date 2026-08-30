# 📘 Panduan Integrasi API WhatsApp CRM untuk Pemilik Usaha & Pengembang

Selamat datang di Panduan Integrasi Resmi **WhatsApp CRM Platform**. Panduan ini dirancang untuk memudahkan Anda (pemilik usaha, developer, atau tim IT) menghubungkan sistem Anda (Website E-Commerce, Toko Online, Aplikasi Mobile, ERP, POS Kasir, Billing/Invoicing, dan Backend API) ke WhatsApp CRM resmi Meta.

---

## 🌟 Mengapa Menggunakan WhatsApp CRM REST API?

Dengan menghubungkan aplikasi Anda ke WhatsApp CRM, Anda dapat mengotomatiskan seluruh komunikasi pelanggan:
- **Kirim OTP & Kode Verifikasi Instan** saat pelanggan mendaftar atau login.
- **Kirim Notifikasi Pesanan & Invoice Otomatis** saat ada transaksi baru di website Anda.
- **Kirim Nomor Resi & Update Status Pengiriman** ke nomor WhatsApp pembeli.
- **Kirim Pengingat Pembayaran / Tagihan (Payment Reminder)** sebelum jatuh tempo.
- **Sinkronisasi Data Kontak Pelanggan** secara otomatis dari database sistem Anda.

---

## 🚀 Langkah 1: Mendapatkan Kunci Akses (API Key)

1. Masuk (*Login*) ke dashboard **WhatsApp CRM**.
2. Pada menu sidebar sebelah kiri, klik menu **`API Key & Developer`** (di bawah bagian *Administration*).
3. Klik tombol **`+ Buat API Key Baru`**.
4. Masukkan nama aplikasi atau website Anda (contoh: `Website Toko Saya`, `Aplikasi Kasir POS`).
5. Klik **`Generate API Key`**.
6. **PENTING:** Salin (*copy*) kunci API Anda yang muncul di layar (contoh: `wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx`).
   > ⚠️ **Catatan Keamanan:** Kunci API ini hanya ditampilkan **satu kali**. Simpan di tempat yang aman (misalnya file `.env` di server website Anda).

---

## 🔑 Langkah 2: Cara Autentikasi API

Setiap kali aplikasi Anda mengirimkan data ke WhatsApp CRM, sertakan API Key pada **Header HTTP**:

```http
X-API-Key: wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

**Alamat Dasar (*Base URL*) API Anda:**
```text
https://domain-crm-anda.com/api/v1/external
```

---

## 📡 Langkah 3: Daftar Endpoint API Lengkap

---

### 1. Kirim Pesan Template Resmi (OTP / Invoice / Resi / Notifikasi)
Gunakan endpoint ini untuk mengirim template pesan resmi Meta yang sudah berstatus `APPROVED`.

* **Metode:** `POST`
* **URL:** `https://domain-crm-anda.com/api/v1/external/messages/send-template`
* **Header:** `X-API-Key: wacrm_live_xxxxxxxx`

#### Contoh Body Permintaan (JSON):
```json
{
  "to": "081234567890",
  "templateName": "order_confirmation",
  "language": "id",
  "recipientName": "Budi Santoso",
  "bodyParameters": [
    "Budi Santoso",
    "INV-2026-8899",
    "Rp 250.000"
  ],
  "buttonParameters": [
    {
      "index": "0",
      "text": "INV-2026-8899"
    }
  ]
}
```

#### Penjelasan Parameter:
| Nama Field | Tipe | Wajib? | Keterangan |
|---|---|---|---|
| `to` | String | **Wajib** | Nomor WhatsApp tujuan. Sistem otomatis mengenali format `0812...`, `62812...`, atau `+62812...`. |
| `templateName` | String | **Wajib** | Nama template WhatsApp resmi yang sudah disetujui di Meta (contoh: `order_confirmation`, `otp_login`). |
| `language` | String | Opsional | Kode bahasa template (default: `id` untuk Bahasa Indonesia). |
| `recipientName` | String | Opsional | Nama penerima untuk otomatis didaftarkan ke buku kontak CRM. |
| `bodyParameters` | Array String | Opsional | Nilai variabel teks pengganti `{{1}}`, `{{2}}`, `{{3}}` di template Anda. |
| `buttonParameters` | Array Object | Opsional | Parameter teks untuk tombol URL dinamis (misal tautan invoice `https://toko.com/inv/{{1}}`). |

#### Contoh Respon Berhasil (`200 OK`):
```json
{
  "success": true,
  "message": "Template WhatsApp berhasil dikirim ke penerima",
  "data": {
    "messageId": "msg_abc123",
    "wamId": "wamid.HBgMNjI4MTEzMjQ0MzIxFQIAERgSM...",
    "recipient": "6281234567890",
    "templateName": "order_confirmation",
    "sentAt": "2026-08-30T12:00:00.000Z"
  }
}
```

---

### 2. Kirim Pesan Teks Percakapan Live Chat
Gunakan endpoint ini untuk mengirim pesan teks biasa kepada pelanggan yang sedang berada dalam jendela layanan aktif.

* **Metode:** `POST`
* **URL:** `https://domain-crm-anda.com/api/v1/external/messages/send-text`
* **Header:** `X-API-Key: wacrm_live_xxxxxxxx`

#### Contoh Body Permintaan (JSON):
```json
{
  "to": "081234567890",
  "message": "Halo Budi! Pembayaran untuk pesanan #INV-8899 telah kami terima. Paket Anda segera kami kirim."
}
```

---

### 3. Daftarkan / Perbarui Data Kontak Pelanggan (*Upsert*)
Gunakan endpoint ini untuk mendaftarkan kontak pelanggan dari website/aplikasi Anda ke buku kontak WhatsApp CRM.

* **Metode:** `POST`
* **URL:** `https://domain-crm-anda.com/api/v1/external/contacts`
* **Header:** `X-API-Key: wacrm_live_xxxxxxxx`

#### Contoh Body Permintaan (JSON):
```json
{
  "phone": "081234567890",
  "name": "Budi Santoso",
  "email": "budi@gmail.com",
  "customAttributes": {
    "kota": "Surabaya",
    "kategori_pelanggan": "VIP Gold",
    "total_transaksi": 5
  }
}
```

---

### 4. Melihat Daftar Template WhatsApp yang Siap Pakai
* **Metode:** `GET`
* **URL:** `https://domain-crm-anda.com/api/v1/external/templates`
* **Header:** `X-API-Key: wacrm_live_xxxxxxxx`

#### Contoh Respon (`200 OK`):
```json
{
  "success": true,
  "count": 2,
  "templates": [
    {
      "id": "tpl_123",
      "name": "order_confirmation",
      "category": "UTILITY",
      "language": "id",
      "status": "APPROVED"
    }
  ]
}
```

---

### 5. Memeriksa Sisa Kuota Broadcast Meta
* **Metode:** `GET`
* **URL:** `https://domain-crm-anda.com/api/v1/external/quota`
* **Header:** `X-API-Key: wacrm_live_xxxxxxxx`

#### Contoh Respon (`200 OK`):
```json
{
  "success": true,
  "quota": {
    "dailyLimit": 1000,
    "used24h": 4,
    "remaining24h": 996,
    "tier": "TIER_1K (1.000 Chat / 24 Jam)",
    "resetWindow": "Rolling 24 Hours"
  }
}
```

---

## 💻 Contoh Kode Integrasi Siap Pakai

---

### A. Contoh untuk Website PHP / Laravel

Tambahkan konfigurasi di file `.env` Laravel Anda:
```env
WACRM_API_KEY=wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx
WACRM_BASE_URL=https://domain-crm-anda.com/api/v1/external
```

Buat fungsi pengiriman pesan:
```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    /**
     * Kirim Notifikasi Pesanan Otomatis
     */
    public static function sendOrderNotification($customerPhone, $customerName, $invoiceNumber, $totalAmount)
    {
        $apiKey = config('services.wacrm.api_key', env('WACRM_API_KEY'));
        $baseUrl = config('services.wacrm.base_url', env('WACRM_BASE_URL'));

        $response = Http::withHeaders([
            'X-API-Key' => $apiKey,
            'Content-Type' => 'application/json',
        ])->post("{$baseUrl}/messages/send-template", [
            'to' => $customerPhone,
            'templateName' => 'order_confirmation',
            'language' => 'id',
            'recipientName' => $customerName,
            'bodyParameters' => [
                $customerName,
                $invoiceNumber,
                $totalAmount
            ],
            'buttonParameters' => [
                [
                    'index' => '0',
                    'text' => $invoiceNumber
                ]
            ]
        ]);

        if ($response->successful()) {
            Log::info("WhatsApp berhasil dikirim ke {$customerPhone}");
            return $response->json();
        } else {
            Log::error("Gagal kirim WhatsApp: " . $response->body());
            return false;
        }
    }
}
```

---

### B. Contoh untuk PHP Native (cURL)
```php
<?php

function sendWhatsAppNotification($phone, $name, $invoiceNo) {
    $apiKey = "wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx";
    $url = "https://domain-crm-anda.com/api/v1/external/messages/send-template";

    $payload = [
        "to" => $phone,
        "templateName" => "order_confirmation",
        "language" => "id",
        "recipientName" => $name,
        "bodyParameters" => [$name, $invoiceNo],
        "buttonParameters" => [
            ["index" => "0", "text" => $invoiceNo]
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-API-Key: " . $apiKey,
        "Content-Type: application/json"
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

// Contoh Pemanggilan:
$result = sendWhatsAppNotification("081234567890", "Budi Santoso", "INV-2026-001");
print_r($result);
?>
```

---

### C. Contoh untuk Node.js / Express / Next.js
```javascript
import fetch from 'node-fetch';

export async function sendWhatsAppMessage(phone, customerName, otpCode) {
  const apiKey = process.env.WACRM_API_KEY || 'wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx';
  const url = 'https://domain-crm-anda.com/api/v1/external/messages/send-template';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        templateName: 'otp_verification',
        language: 'id',
        recipientName: customerName,
        bodyParameters: [customerName, otpCode],
        buttonParameters: [{ index: '0', text: otpCode }]
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error kirim WhatsApp:', error);
    throw error;
  }
}
```

---

### D. Contoh untuk Python (Django / Flask / FastAPI)
```python
import os
import requests

def send_whatsapp_order(phone: str, customer_name: str, invoice_id: str):
    api_key = os.getenv("WACRM_API_KEY", "wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx")
    url = "https://domain-crm-anda.com/api/v1/external/messages/send-template"

    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json"
    }

    payload = {
        "to": phone,
        "templateName": "order_confirmation",
        "language": "id",
        "recipientName": customer_name,
        "bodyParameters": [customer_name, invoice_id],
        "buttonParameters": [{"index": "0", "text": invoice_id}]
    }

    response = requests.post(url, json=payload, headers=headers)
    return response.json()
```

---

## 🚦 Penjelasan Kode Status HTTP Respon

| Status HTTP | Status JSON | Arti & Penjelasan |
|---|---|---|
| **`200 OK`** | `success: true` | **Berhasil.** Pesan telah diproses dan dikirim langsung ke WhatsApp penerima. |
| **`400 Bad Request`** | `success: false` | **Permintaan Tidak Valid.** Format nomor telepon salah, parameter template kurang, atau nomor WhatsApp tidak aktif. |
| **`401 Unauthorized`** | `success: false` | **Akses Ditolak.** Header `X-API-Key` tidak dikirim, API Key salah, atau API Key telah dihapus/dicabut. |
| **`404 Not Found`** | `success: false` | **Template Tidak Ditemukan.** Nama template yang diminta belum ada di organisasi Anda atau belum disetujui Meta. |
| **`500 Server Error`** | `success: false` | **Kendala Server.** Terjadi gangguan koneksi pada server backend atau Meta Graph API. |

---

## 🛡️ Panduan Praktik Keamanan Terbaik (*Best Practices*)

1. **Jaga Kerahasiaan API Key:**
   * Jangan pernah membagikan atau mengunggah API Key Anda ke repositori publik (seperti GitHub publik).
   * Simpan selalu di file konfigurasi lingkungan server (`.env`).
2. **Kirim dari Sisi Server (*Server-Side Only*):**
   * Selalu lakukan pengiriman dari backend aplikasi Anda (PHP/Laravel, Node.js, Python), **bukan dari Javascript browser pelanggan**, agar API Key Anda tidak dapat diintip oleh pengunjung website.
3. **Pencabutan Kunci Cepat (*Instant Revoke*):**
   * Jika sewaktu-waktu kunci API Anda bocor atau tidak sengaja terekspos, segera buka menu **`API Key & Developer`** di dashboard CRM dan klik tombol **Hapus (🗑️)** untuk menonaktifkannya secara instan.

---

## 💳 Transparansi Tagihan & Biaya Resmi Meta (Billing & Pricing Guide)

> 📢 **PEMBERITAHUAN PENTING:**  
> **Platform WhatsApp CRM ini TIDAK memungut biaya per-pesan ataupun komisi per-percakapan (0% Markup).**  
> Seluruh biaya percakapan WhatsApp Business resmi ditagihkan **LANGSUNG OLEH META (Facebook/Meta Business Manager)** ke metode pembayaran Anda (Kartu Kredit/Debit/Invoice Resmi Meta) secara transparan dan tanpa perantara pihak ketiga.

---

### 1. Bagaimana Cara Perhitungan Tagihan Meta?
Meta WhatsApp Cloud API menggunakan sistem **Percakapan 24 Jam (*Conversation-Based Pricing*)**, **BUKAN dihitung per butir pesan/kata**:

* **Apa itu 1 Sesi Percakapan 24 Jam?**  
  Ketika sebuah sesi percakapan dimulai, Anda dan pelanggan dapat saling berkirim **puluhan hingga ratusan pesan teks, gambar, video, dan dokumen selama 24 jam penuh**, dan Meta **HANYA menagih 1x biaya sesi percakapan tersebut** (tidak dikalikan jumlah pesan yang dikirim).

---

### 2. Kategori Percakapan & Tarif Resmi Meta:

| Kategori Percakapan | Keterangan & Use Case | Skema Tarif Meta |
|---|---|:---:|
| **1. Layanan Pelanggan (*Service / CS*)** | Obrolan langsung (*live chat*) yang dimulai oleh pelanggan saat bertanya ke CS Anda. | **1.000 Percakapan Pertama GRATIS setiap bulan**. Di atas itu ~Rp 250 - Rp 350 / sesi 24 jam. |
| **2. Notifikasi Transaksi (*Utility*)** | Konfirmasi pesanan, invoice tagihan, resi pengiriman, update pembayaran. | Berbayar per sesi 24 jam (~Rp 300 - Rp 450). |
| **3. Keamanan (*Authentication / OTP*)** | Kode verifikasi OTP login dan reset password. | Berbayar per sesi 24 jam (~Rp 300 - Rp 400). |
| **4. Pemasaran (*Marketing / Promo*)** | Broadcast promosi massal, diskon, penawaran produk baru. | Berbayar per sesi 24 jam (~Rp 450 - Rp 600). |

*Catatan: Estimasi tarif di atas mengacu pada tarif resmi Meta untuk nomor tujuan wilayah Indonesia (ID).*

---

### 3. Fasilitas 1.000 Percakapan GRATIS Setiap Bulan (*Free Tier*)
* Setiap bulan, Meta memberikan kuota **1.000 percakapan Layanan Pelanggan (Service Conversations) GRATIS (Rp 0)** untuk setiap Akun WhatsApp Business (WABA).
* Selama total percakapan layanan pelanggan Anda masih berada di bawah 1.000 dalam bulan tersebut, Meta tidak akan membebankan biaya apa pun ke kartu Anda.

---

### 4. Perbedaan: Limit Harian (*1.000 Chat/24 Jam*) vs Jatah Gratis Bulanan
* **Limit 1.000 Chat / 24 Jam (Messaging Tier):** Batas kapasitas/kecepatan pengiriman nomor berbeda per hari yang diizinkan Meta untuk mencegah spam. Tier ini akan naik otomatis ke 10.000, 100.000, hingga Unlimited seiring meningkatnya reputasi pengiriman akun Anda.
* **1.000 Percakapan Gratis / Bulan (Billing Free Tier):** Jatah pembebasan biaya tagihan rupiah setiap bulannya dari Meta.

---

### 5. Di Mana Saya Memeriksa & Mengatur Pembayaran Meta?
Anda dapat memeriksa rincian pemakaian, faktur pajak resmi, dan mengatur kartu pembayaran langsung melalui portal resmi Meta:
1. Kunjungi **[business.facebook.com](https://business.facebook.com/)**.
2. Buka menu **Pengaturan Bisnis (Business Settings) ➔ Pembayaran (Billing & Payments)**.
3. Tambahkan metode pembayaran resmi Anda (Kartu Debit / Kredit Visa & Mastercard). Meta akan mendebit biaya pemakaian secara langsung dan otomatis.


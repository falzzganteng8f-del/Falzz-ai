# FALZZ AI — Web + Android WebView

FALZZ AI adalah proyek starter full-stack: frontend web, backend Node.js/Express, riwayat dan memori per sesi, mode coding, pengaturan kepribadian, pencarian ringkas, serta aplikasi Android WebView.

## Persyaratan

- Node.js 20 atau lebih baru
- npm
- Untuk APK: Android Studio atau AndroidIDE dengan Android SDK dan Gradle yang sesuai
- Koneksi internet untuk API Nexadev dan pencarian

## 1. Jalankan website / backend

```bash
cp .env.example .env
npm install
npm start
```

Buka `http://localhost:3000`.

Di Windows, salin `.env.example` menjadi `.env` secara manual bila perintah `cp` tidak tersedia.

### Konfigurasi API

`.env` memakai endpoint yang diberikan:

```env
NEXA_API_URL=https://api.nexadev.my.id/ai/deepsek/
```

Kode mengirim prompt melalui parameter GET `text`. Path `deepsek` dipertahankan sesuai URL pengguna. Situs dokumentasi Nexa API yang bisa diakses publik menjelaskan contoh fetch dan respons `data.result` untuk endpoint chat lain, tetapi tidak mempublikasikan spesifikasi rinci endpoint `deepsek` pada halaman yang diperiksa. Karena itu parser menerima beberapa bentuk respons umum. Jika API mengembalikan bentuk lain, sesuaikan `extractAnswer()` di `server.js`.

Gunakan HTTPS. Permintaan GET membawa prompt pada query string; jangan masukkan data sensitif. Periksa kebijakan, batas pemakaian, dan izin layanan API sebelum dipublikasikan.

## 2. Fitur

- Chat: `/api/chat`
- Riwayat: disimpan pada `data/chats.json` per ID sesi acak
- Memori: teks yang pengguna masukkan sendiri, dapat diedit/dihapus
- Personality: system instruction yang disisipkan ke prompt
- Mode coding: instruksi tambahan untuk jawaban pemrograman
- Search: DuckDuckGo Instant Answer API melalui `/api/search`; ini bukan pencarian web penuh dan hasil dapat kosong
- Health check: `/api/health`

## 3. Deploy ke server

Deploy folder proyek ke layanan Node.js yang mendukung Node 20+. Jalankan `npm install` lalu `npm start`. Atur environment variables dari dashboard hosting. Pastikan direktori `data/` persisten; filesystem sementara akan menghapus riwayat saat instance diganti. Untuk pemakaian publik, tambahkan autentikasi pengguna dan database terkelola sebelum menyimpan data banyak pengguna.

Jangan mengekspos port development ke internet tanpa HTTPS, autentikasi, dan pembatasan akses. Rate limit dasar sudah aktif, tetapi bukan pengganti sistem autentikasi.

## 4. Build APK Android

Aplikasi Android pada folder `android/` adalah WebView wrapper, bukan runtime Node.js. Artinya backend Node.js harus berjalan pada server yang bisa dijangkau HP.

1. Deploy website/backend sesuai bagian 3.
2. Buka `android/` di Android Studio/AndroidIDE.
3. Edit `android/app/build.gradle` dan ubah `FALZZ_WEB_URL` ke URL HTTPS deployment milikmu.
4. Sync Gradle, lalu Build > Build APK(s).
5. Install APK di perangkat sendiri untuk pengujian.

Untuk uji lokal melalui emulator Android, `10.0.2.2` mengarah ke localhost komputer host. Pada HP fisik, gunakan alamat IP LAN komputer yang menjalankan server (pastikan firewall mengizinkan) atau deploy ke hosting HTTPS.

## 5. Struktur

```text
falzz-ai/
├── server.js
├── package.json
├── .env.example
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── android/
    ├── settings.gradle
    ├── build.gradle
    └── app/
        ├── build.gradle
        └── src/main/
            ├── AndroidManifest.xml
            └── java/id/falzz/ai/MainActivity.java
```

## Batasan versi starter

Memori dan riwayat ini adalah penyimpanan lokal JSON tanpa akun/login; jangan jadikan penyimpanan multi-user publik tanpa autentikasi dan database. Search menggunakan Instant Answer API, bukan crawler atau mesin pencari lengkap. API AI pihak ketiga dapat berubah atau membatasi akses. Kode belum diklaim telah diuji terhadap layanan Nexadev; lakukan tes `/api/health` lalu kirim chat percobaan.

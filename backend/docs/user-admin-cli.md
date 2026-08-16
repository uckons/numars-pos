# Pemulihan password user lewat CLI

CLI ini ditujukan untuk pemilik server yang sudah mempunyai akses ke konfigurasi
database. Perintah ini bukan backdoor: koneksi tetap memakai `DATABASE_URL`, password
disimpan sebagai hash bcrypt, dan sesi lama dicabut apabila kolom `token_version`
tersedia.

Jalankan dari direktori `backend`.

## Langkah lengkap

1. Masuk ke direktori backend dan pasang dependency:

   ```bash
   cd /workspace/numars-pos/backend
   npm install
   ```

2. Pastikan PostgreSQL berjalan. Untuk instalasi service Linux, periksa dengan:

   ```bash
   sudo systemctl status postgresql
   ```

3. Pastikan file `.env` memiliki `DATABASE_URL` yang benar, misalnya
   `postgresql://USER:PASSWORD@127.0.0.1:5432/NAMA_DATABASE`. Jangan kirim nilai
   password database kepada orang lain.

4. Uji koneksi lebih dahulu:

   ```bash
   npm run user-admin -- doctor
   ```

   Jika muncul `ECONNREFUSED`, PostgreSQL belum aktif atau host/port di
   `DATABASE_URL` salah. Jika muncul `28P01`, username/password database salah.

5. Setelah `doctor` berhasil, lanjutkan dengan perintah `list` dan `reset` di
   bawah.

## Melihat user

```bash
npm run user-admin -- list
```

Output tidak menampilkan hash password.

## Mengganti password

Gunakan input tersembunyi agar password tidak masuk ke shell history:

```bash
read -rsp 'Password admin baru: ' ADMIN_NEW_PASSWORD; echo
export ADMIN_NEW_PASSWORD
npm run user-admin -- reset --username admin
unset ADMIN_NEW_PASSWORD
```

Ganti `admin` dengan username yang muncul dari perintah `list`. Password minimal
8 karakter dan harus memuat huruf kecil, huruf besar, angka, dan simbol.

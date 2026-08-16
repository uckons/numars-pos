# Pemulihan password user lewat CLI

CLI ini ditujukan untuk pemilik server yang sudah mempunyai akses ke konfigurasi
database. Perintah ini bukan backdoor: koneksi tetap memakai `DATABASE_URL`, password
disimpan sebagai hash bcrypt, dan sesi lama dicabut apabila kolom `token_version`
tersedia.

Jalankan dari direktori `backend`.

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

# Checklist Operasional Harian — Rekonsiliasi POS vs Jurnal

Tujuan: memberi SOP harian yang bisa langsung dipakai tim operasional di VPS untuk memonitor auto-journal `POS_PAYMENT`.

## 1) Persiapan (awal shift / pagi)

- [ ] Pastikan backend service up (`pm2 status` / service manager lain).
- [ ] Pastikan koneksi DB normal dari VPS.
- [ ] Tentukan tanggal rekonsiliasi (`recon_date`) dan (opsional) `branch_id`.

Contoh:

```bash
cd /workspace/numars-pos
psql "$DATABASE_URL" -v recon_date="$(date +%F)" -v branch_id="1" -f docs/execution-pack/sprint-2/sql-reconciliation-harian.sql
```

## 2) Validasi hasil utama

Dari output query summary:

- [ ] `recon_status = OK` ada dan nilainya dominan.
- [ ] `MISSING_JOURNAL = 0`.
- [ ] `UNBALANCED_JOURNAL = 0`.
- [ ] `AMOUNT_MISMATCH = 0`.
- [ ] `ZERO_TOTAL_WITH_ITEMS = 0` (harus investigasi jika ada).
- [ ] `NO_JOURNAL_EXPECTED_ZERO_TOTAL` boleh ada (informational).

Jika semua mismatch nol (selain `OK` dan `NO_JOURNAL_EXPECTED_ZERO_TOTAL`), tandai **PASS** untuk hari tersebut.

## 3) Jika ada mismatch

- [ ] Simpan hasil query detail mismatch (copy output ke log harian).
- [ ] Kelompokkan masalah:
  - `MISSING_JOURNAL`: order paid (total > 0) belum punya jurnal.
  - `UNBALANCED_JOURNAL`: debit ≠ credit.
  - `AMOUNT_MISMATCH`: total jurnal ≠ total order.
  - `ZERO_TOTAL_WITH_ITEMS`: subtotal item > 0 tapi total order 0 (cek discount/input flow).
- [ ] Jalankan query duplikasi (sudah termasuk di file SQL) dan cek apakah ada `journal_count > 1`.
- [ ] Jika ada duplikasi, jadwalkan eksekusi script dedupe dalam mode dry-run terlebih dahulu.



Contoh repair `MISSING_JOURNAL` (dry-run lalu apply):

```bash
cd /workspace/numars-pos/backend
# Dry-run per tanggal
RECON_DATE="$(date +%F)" BRANCH_ID="1" npm run journal:repair:missing-pos-payment

# Apply per tanggal
RECON_DATE="$(date +%F)" BRANCH_ID="1" APPLY=true npm run journal:repair:missing-pos-payment

# Atau target 1 order
ORDER_ID=247 APPLY=true npm run journal:repair:missing-pos-payment
```


Jika repair missing journal tetap tidak menghilangkan mismatch:

```sql
-- 1) cek rules POS_PAYMENT aktif
SELECT event_code, variant, line_no, direction, account_code, is_active
FROM accounting_posting_rules
WHERE event_code='POS_PAYMENT'
ORDER BY variant, line_no;
-- Catatan: method DEBIT/CC/TRANSFER BANK akan dipetakan ke variant TRANSFER oleh service.

-- 2) cek header jurnal order tertentu
SELECT id, source_ref, idempotency_key, posting_date, status, description
FROM journal_entries
WHERE source_module='POS' AND source_ref='ORDER:248'
ORDER BY id DESC;
```

```
# 3) jalankan repair target order agar output journal_id terlihat
cd /workspace/numars-pos/backend
ORDER_ID=248 APPLY=true npm run journal:repair:missing-pos-payment
```

Contoh repair `ZERO_TOTAL_WITH_ITEMS`:

```bash
cd /workspace/numars-pos/backend
# Dry-run per order
ORDER_ID=244 npm run journal:repair:zero-total

# Dry-run semua anomali pada tanggal tertentu
RECON_DATE="$(date +%F)" npm run journal:repair:zero-total

# Apply per order
ORDER_ID=244 APPLY=true npm run journal:repair:zero-total

# Apply semua anomali pada tanggal tertentu
RECON_DATE="2026-02-24" APPLY=true npm run journal:repair:zero-total
```

Contoh dry-run dedupe:

```bash
cd /workspace/numars-pos/backend
npm run journal:dedupe:pos-payment
```

Contoh apply dedupe (hanya setelah approval):

```bash
cd /workspace/numars-pos/backend
APPLY=true npm run journal:dedupe:pos-payment
```

## 4) Penutupan harian

- [ ] Rekap metrik harian: total order paid, total jurnal OK, total mismatch.
- [ ] Simpan evidence (timestamp + command + output ringkas).
- [ ] Jika ada issue, buat tiket insiden + cantumkan `order_id`/`journal_id` terdampak.
- [ ] Lakukan handover ke shift berikutnya jika mismatch belum selesai.

## Template log harian (copy-paste)

```md
Tanggal: YYYY-MM-DD
Branch: <id / ALL>
Operator: <nama>

Ringkasan:
- OK: <n>
- MISSING_JOURNAL: <n>
- UNBALANCED_JOURNAL: <n>
- AMOUNT_MISMATCH: <n>
- ZERO_TOTAL_WITH_ITEMS: <n>
- NO_JOURNAL_EXPECTED_ZERO_TOTAL: <n>

Tindak lanjut:
- <aksi 1>
- <aksi 2>

Status akhir:
- [ ] PASS (tidak ada mismatch)
- [ ] FOLLOW-UP (ada mismatch)
```


## 5) Otomasi cron + auto-alert

Script siap pakai:

```bash
cd /workspace/numars-pos/backend
RECON_DATE="$(date +%F)" BRANCH_ID="1" bash scripts/cron-recon-alert.sh
```

Template 2-slot cron (03:10 + 09:30) + log retention sederhana:


Setup manual di VPS (disarankan):

```bash
# 1) simpan config di backend/.env (disarankan)
cat >> /workspace/numars-pos/backend/.env <<'EOF'
ALERT_WEBHOOK_URL="https://discord.com/api/webhooks/<id>/<token>"
RECON_BRANCH_ID="1"
RECON_RETENTION_DAYS="14"
RECON_NOTIFY_ON_OK="false"
EOF

# 2) edit crontab user service
crontab -e
```

Untuk Discord, script otomatis kirim payload key `content` jika URL mengandung `discord.com/api/webhooks`.
Notifikasi sudah format human-readable (ringkasan per status) dan branch akan ditampilkan sebagai `Nama Branch (#id)` jika ditemukan dari tabel `branches`.
Catatan keamanan: jika URL webhook sempat terbuka di chat/log, segera rotate webhook di Discord lalu update `.env`.

```cron
# Slot 1: post-operational close check
10 3 * * * cd /workspace/numars-pos/backend && RECON_DATE="$(date +\%F)" BRANCH_ID="1" RETENTION_DAYS="14" bash scripts/cron-recon-alert.sh >> /workspace/numars-pos/backend/logs/reconciliation/cron.log 2>&1

# Slot 2: pre-open sanity check
30 9 * * * cd /workspace/numars-pos/backend && RECON_DATE="$(date +\%F)" BRANCH_ID="1" RETENTION_DAYS="14" bash scripts/cron-recon-alert.sh >> /workspace/numars-pos/backend/logs/reconciliation/cron.log 2>&1
```

Catatan rotate log:
- Script akan menghapus file `recon-*` dan `cron.log*` yang lebih lama dari `RETENTION_DAYS` (default 14 hari).
- Bisa diubah via env `RETENTION_DAYS`.
- Jika ingin kirim notifikasi saat hasil OK juga, set `RECON_NOTIFY_ON_OK=true` (default `false`).

Exit code script:
- `0`: recon OK (tidak ada mismatch)
- `2`: mismatch terdeteksi (alert)
- `!=0/2`: error eksekusi SQL/parser


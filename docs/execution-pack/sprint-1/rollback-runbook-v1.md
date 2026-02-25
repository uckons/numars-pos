# Rollback Runbook v1 (S1-10)

Prinsip: migration Sprint 1 bersifat additive. Rollback utama dilakukan di layer aplikasi/traffic, bukan drop table langsung.

## Trigger Rollback

- Error rate endpoint POS naik signifikan pasca release.
- Latency DB meningkat dan mengganggu kasir.
- Terjadi anomali data kritikal pada flow order/payment.

## Rollback Steps (Operational)

1. **Freeze deployment**
   - Stop release lanjutan.
2. **Feature flags OFF**
   - Pastikan semua flag Sprint 1 tetap OFF.
3. **Route isolation**
   - Nonaktifkan endpoint baru (jika sudah expose) via gateway/app config.
4. **Service restart controlled**
   - Restart backend processes untuk bersihkan state runtime.
5. **DB observe only**
   - Jangan drop tabel 007/008 saat insiden berjalan.
6. **Incident snapshot**
   - Ambil log, query plan, dan sample request untuk RCA.

## Optional DB Rollback (Hanya jika disetujui DBA + change board)

> Tidak direkomendasikan saat jam operasional.

- Disable writes to new tables.
- Backup objek baru.
- Drop index concurrent baru jika terbukti memicu masalah (jarang).
- Drop tabel baru hanya setelah RCA selesai dan disetujui.

## Dry Run Checklist

- [ ] Simulasi toggle flags OFF sukses.
- [ ] Simulasi restart service sukses.
- [ ] POS core smoke test ulang sukses.
- [ ] Evidence log/metric tersimpan.

## Owner Matrix

| Role | Responsibility |
|---|---|
| Incident Commander | keputusan go/no-go rollback |
| Backend Lead | eksekusi langkah aplikasi |
| DBA | observasi DB & tindakan schema-level |
| QA | verifikasi smoke test pasca rollback |
| Product Owner | komunikasi stakeholder |

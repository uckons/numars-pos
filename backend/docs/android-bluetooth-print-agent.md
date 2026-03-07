# Android Bluetooth Print Agent (Kotlin PoC)

Dokumen ini untuk menjalankan PoC Android Bluetooth agent yang kompatibel dengan flow print backend saat ini.

## Scope implementasi yang sudah ditambahkan

- PoC app Android (Kotlin): `backend/agents/android-bluetooth-print-agent`
- API helper di backend untuk generate payload uji Android:
  - `POST /api/printers/android-poc-payload`

## Kenapa non-breaking

Flow backend tidak diubah:

1. `mode=printnode` -> PrintNode.
2. Jika ada `agent_url` / `PRINT_AGENT_URL` -> kirim ke print agent HTTP.
3. Jika tidak ada -> fallback USB lokal backend.

Android agent cukup menjadi target baru dari `PRINT_AGENT_URL`.

## API helper backend (baru)

Endpoint:

`POST /api/printers/android-poc-payload`

Body:

```json
{
  "order_id": 123,
  "printer": {
    "agent_printer_name": "MTP-II"
  }
}
```

Response:

```json
{
  "ok": true,
  "payload": {
    "profile": { "maxDots": 128, "heatTimeUs": 550, "heatIntervalUs": 20, "codePage": 0 },
    "printer_name": "MTP-II",
    "receipt": { "title": "NUMARS POS", "items": [], "total": 0 }
  },
  "hint": "Gunakan payload ini untuk menguji endpoint POST /print/receipt di Android Bluetooth agent."
}
```

## Kontrak endpoint Android agent

Aplikasi PoC Android membuka endpoint lokal:

- `GET /health`
- `POST /print/receipt`

Header auth opsional:

- `x-print-agent-token`

Body yang diterima kompatibel dengan payload dari backend (`profile`, `printer_name`, `receipt`).

## Cara jalan cepat

1. Buka project Android: `backend/agents/android-bluetooth-print-agent`
2. Run ke device Android.
3. Isi config:
   - token,
   - MAC printer Bluetooth,
   - port (default `19000`).
4. Start Agent dari app.
5. Set backend:

```bash
PRINT_AGENT_URL=http://IP-ANDROID:19000
PRINT_AGENT_TOKEN=secret123
PRINT_AGENT_TIMEOUT_MS=45000
```

## Keamanan minimum

- Jalankan di private network (VPN/LAN private).
- Jangan expose port agent ke internet publik.
- Selalu aktifkan token.

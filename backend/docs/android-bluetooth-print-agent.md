# Android Bluetooth Print Agent (Rencana Implementasi)

Dokumen ini menjelaskan cara menambah **agent Android + Bluetooth thermal** tanpa mengganggu flow print yang sudah berjalan (Windows/USB/PrintNode).

## Tujuan

- Backend tetap memakai alur yang sama: kirim HTTP ke `PRINT_AGENT_URL`.
- Android bertindak sebagai **agent lokal** yang kompatibel endpoint existing (`/health`, `/print/receipt`).
- Outlet yang belum pakai Android tidak perlu perubahan konfigurasi.

## Kenapa aman (non-breaking)

Di backend saat ini, urutan print adalah:

1. `mode=printnode` -> PrintNode.
2. Ada `agent_url`/`PRINT_AGENT_URL` -> kirim ke print agent via HTTP.
3. Jika tidak ada keduanya -> fallback USB lokal backend.

Artinya Android agent cukup menggantikan nilai `agent_url` (ke IP Android), tanpa ubah logika core.

## Kontrak endpoint Android agent

Agar plug-and-play dengan backend sekarang, Android agent perlu endpoint berikut:

### 1) Health

`GET /health`

Contoh response:

```json
{
  "ok": true,
  "service": "android-bluetooth-print-agent"
}
```

### 2) Print receipt

`POST /print/receipt`

Header opsional:

- `x-print-agent-token: <token>`

Body minimum yang kompatibel:

```json
{
  "printer_name": "MTP-II",
  "profile": {
    "maxDots": 128,
    "heatTimeUs": 550,
    "heatIntervalUs": 20,
    "codePage": 0
  },
  "receipt": {
    "title": "NUMARS POS",
    "divider": "------------------------",
    "items": [
      {
        "service_name": "Massage 60m",
        "qty": 1,
        "subtotal": 120000,
        "therapist_name": "Sari"
      }
    ],
    "total": 120000,
    "printed_at": "07/03/2026 11:20:00"
  }
}
```

Contoh response sukses:

```json
{
  "success": true
}
```

## Arsitektur Android yang disarankan

- **Foreground service** (stabil, tidak gampang dimatikan OS).
- HTTP server lokal di Android (port default `19000`).
- Transport ke printer:
  - Bluetooth Classic / SPP (`00001101-0000-1000-8000-00805F9B34FB`).
  - Kirim byte ESC/POS (raw) sesuai payload receipt.
- Simpan konfigurasi lokal:
  - token,
  - MAC address printer Bluetooth,
  - optional printer alias (`printer_name`).

## Konfigurasi backend (tetap sama)

Set di VPS / backend:

```bash
PRINT_AGENT_URL=http://IP-ANDROID:19000
PRINT_AGENT_TOKEN=secret123
PRINT_AGENT_TIMEOUT_MS=45000
```

Atau override per request:

```json
{
  "order_id": 123,
  "printer": {
    "agent_url": "http://192.168.1.77:19000",
    "agent_token": "secret123"
  }
}
```

## Keamanan minimum

- Gunakan jaringan private (VPN / LAN private), jangan expose publik.
- Selalu aktifkan token auth (`PRINT_AGENT_TOKEN`).
- Batasi siapa yang bisa akses endpoint agent (allowlist IP jika memungkinkan).

## Rollout bertahap (disarankan)

1. Pilot 1 outlet dengan Android agent.
2. Aktifkan lewat `agent_url` per outlet/per request.
3. Monitor timeout/error print.
4. Jika stabil, baru rollout massal.

Dengan pola ini, flow existing tetap aman karena outlet lain tetap menggunakan jalur lama (Windows agent atau PrintNode).

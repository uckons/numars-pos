# Android Bluetooth Print Agent (Kotlin PoC)

PoC aplikasi Android yang membuka HTTP endpoint lokal kompatibel dengan backend NUMARS:

- `GET /health`
- `POST /print/receipt`

Lalu meneruskan payload receipt menjadi byte ESC/POS ke printer thermal via Bluetooth Classic SPP.

## Fitur PoC

- Foreground service (`PrintAgentService`) untuk menjaga agent tetap hidup.
- Config sederhana di `MainActivity`:
  - token (`x-print-agent-token`),
  - MAC address printer,
  - port listen (default `19000`).
- HTTP server lokal berbasis Ktor CIO (`PrintAgentServer`).
- Mapper payload receipt -> ESC/POS (`ReceiptEscPosMapper`).
- Bluetooth transport SPP UUID standar thermal:
  - `00001101-0000-1000-8000-00805F9B34FB`

## Build singkat

1. Buka folder ini dengan Android Studio.
2. Sync Gradle.
3. Run ke device Android (min SDK 26).
4. Beri permission `BLUETOOTH_CONNECT` saat diminta.
5. Isi token + MAC printer, simpan, lalu Start Agent.

## Integrasi backend

Set backend VPS:

```bash
PRINT_AGENT_URL=http://IP-ANDROID:19000
PRINT_AGENT_TOKEN=secret123
```

Atau gunakan endpoint helper payload:

```bash
POST /api/printers/android-poc-payload
{
  "order_id": 123,
  "printer": {
    "agent_printer_name": "MTP-II"
  }
}
```

Respons endpoint itu bisa langsung dipakai sebagai body ke `POST /print/receipt` di Android agent untuk uji manual.

## Catatan

PoC ini fokus validasi arsitektur dan alur koneksi. Untuk produksi, tambahkan retry policy, queue, observability, dan hardening keamanan jaringan.

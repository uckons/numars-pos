# Local Print Agent (VPS -> Local Device)

Gunakan arsitektur ini jika backend ada di VPS, tetapi printer USB ada di PC kasir lokal.

## Windows quick start (PC kasir)

> Karena PC kasir Windows dan kasir hanya pakai browser, agent ini jalan di background. Browser tetap dipakai seperti biasa.

1. Install **Node.js LTS** (v18/v20) di PC kasir Windows.
2. Buka **Command Prompt** lalu masuk ke folder backend:

```cmd
cd backend
```

3. Install dependency (sekali saja):

```cmd
npm install
```

4. Set env lalu jalankan agent:

```cmd
set PRINT_AGENT_PORT=19000
set PRINT_AGENT_TOKEN=secret123
npm run print-agent:win
```

5. Alternatif paling gampang (double click):

```cmd
backend\scripts\run-print-agent.cmd
```

> Script `.cmd` akan cek Node.js, dan otomatis `npm install` jika `node_modules` belum ada.

6. Health check lokal:

```bash
curl http://127.0.0.1:19000/health
```

## Opsi Android + Bluetooth

Jika ingin pakai perangkat Android sebagai print agent Bluetooth thermal, lihat panduan:

- `backend/docs/android-bluetooth-print-agent.md`

Implementasi ini dirancang tetap kompatibel dengan alur backend saat ini (non-breaking).

## Koneksi dari VPS backend

Set env di backend VPS:

```bash
PRINT_AGENT_URL=http://IP-PC-KASIR:19000
PRINT_AGENT_TOKEN=secret123
PRINT_AGENT_TIMEOUT_MS=45000
```

Backend `POST /api/printers/print-order` otomatis kirim job ke print agent jika `PRINT_AGENT_URL` tersedia.

## Optional override per request

Kirim body:

```json
{
  "order_id": 123,
  "printer": {
    "agent_url": "http://192.168.1.10:19000",
    "agent_token": "secret123"
  }
}
```

Jika `agent_url` tidak diisi, backend fallback ke mode USB lokal (printer harus terpasang langsung di host backend).

## Catatan penting untuk Windows USB thermal

- Pastikan printer terdeteksi di Windows.
- Jika USB tidak terbaca dari Node/escpos-usb, biasanya perlu driver USB generic (WinUSB/libusb) sesuai chipset printer clone.
- Buka firewall inbound untuk port agent (default `19000`) **hanya** dari jaringan terpercaya (VPN/private network).
- Rekomendasi produksi: hubungkan VPS ke PC kasir lewat VPN private (WireGuard/Tailscale/ZeroTier), bukan expose publik langsung.


## Troubleshooting npm di Windows

Jika muncul error seperti:

- `Cannot find module ...\node_modules\npm\bin\npm-cli.js`
- `Cannot find module ...\node_modules\npm\bin\npm-prefix.js`

artinya instalasi Node.js di PC kasir tidak lengkap (npm hilang), biasanya karena folder Node di-copy manual.

Langkah perbaikan:

1. Hapus instalasi Node yang rusak.
2. Install ulang **Node.js LTS v18/v20** dari installer resmi `.msi` di https://nodejs.org/.
3. Tutup dan buka lagi Command Prompt.
4. Verifikasi:

```cmd
node -v
npm -v
```

5. Ulangi dari langkah:

```cmd
cd backend
npm install
npm run print-agent:win
```

> `run-print-agent.cmd` sekarang juga akan mendeteksi jika `npm` tidak ada dan menampilkan pesan perbaikan otomatis.


## Opsi paling mudah (tanpa install Node di kasir): PrintNode App

Kalau install Node di Windows terasa susah, gunakan **PrintNode Client** (aplikasi siap pakai).

### Cara kerja
- Install aplikasi PrintNode di PC kasir (Windows).
- Printer USB dipilih di dashboard PrintNode.
- Backend VPS kirim job ke API PrintNode (tanpa local Node agent).

### Setup
1. Install aplikasi: https://www.printnode.com/download
2. Login PrintNode di PC kasir, pastikan printer USB muncul online.
3. Ambil **API Key** dari akun PrintNode.
4. Ambil **Printer ID** dari dashboard PrintNode.
5. Set env di backend VPS:

```bash
PRINT_PROVIDER=printnode
PRINTNODE_API_KEY=xxxxxxxx
PRINTNODE_PRINTER_ID=123456
```

Setelah itu endpoint `POST /api/printers/print-order` akan langsung kirim ke PrintNode.

### Optional override per request

```json
{
  "order_id": 123,
  "printer": {
    "mode": "printnode",
    "printnode_api_key": "xxxxxxxx",
    "printnode_printer_id": 123456
  }
}
```


## Alternatif tanpa Node: Agent kecil pakai Visual Studio (.NET)

Kalau lebih nyaman pakai Visual Studio, gunakan project ini:

- Folder: `backend/agents/windows-dotnet-print-agent`
- Project: `WindowsDotnetPrintAgent.csproj`
- Endpoint kompatibel dengan backend saat ini:
  - `GET /uix` (UIX local untuk cek status/test print/update config runtime)
  - `GET /health`
  - `GET /printers` (daftar printer terdeteksi + default printer)
  - `GET /ports` (daftar port USB/COM untuk direct mode)
  - `GET /config`
  - `POST /config/update`
  - `POST /print/test`
  - `POST /print/receipt`

### Cara run di Windows (Visual Studio)

1. Buka `WindowsDotnetPrintAgent.csproj` di Visual Studio 2022.
2. Jalankan (F5) atau Publish sebagai single exe.
3. Set manual IP/port (dua pilihan):

   **A. Via Environment Variables**
   - `PRINT_AGENT_HOST` (default `localhost`; gunakan `+` atau IP spesifik jika butuh akses dari VPS/LAN)
   - `PRINT_AGENT_PORT` (default `19000`)
   - `PRINT_AGENT_TOKEN` (token auth, optional)
   - `PRINT_AGENT_PRINTER` (nama printer Windows; kalau kosong pakai default printer)
  - `PRINT_AGENT_PORT_NAME` (opsional, contoh `USB001`/`COM3` untuk direct-port bypass spooler)
  - `PRINT_AGENT_DATATYPE` (default `AUTO`: hanya `RAW` lalu `RAW + FF` untuk kompatibilitas thermal. Gunakan `AUTO_EXTENDED` jika ingin fallback tambahan `NT EMF` dan `TEXT`; gunakan `GDI_RECEIPT` untuk layout struk yang lebih mirip preview browser; jika diisi `RAW`, agent hanya mencoba mode RAW; jika diisi `TEXT`, agent hanya pakai `TEXT`)

   **B. Via file config `agent-config.json`** di folder hasil build EXE (copy dari `agent-config.example.json`):

```json
{
  "host": "localhost",
  "port": "19000",
  "token": "secret123",
  "printerName": "EPSON TM-T82 Receipt",
  "dataType": "AUTO",
  "portName": "USB001"
}
```

   > Prioritas: Env var akan override nilai dari file config.

### Koneksi dari VPS

Tetap sama seperti mode local print agent:

```bash
PRINT_AGENT_URL=http://IP-PC-KASIR:19000
PRINT_AGENT_TOKEN=secret123
PRINT_AGENT_TIMEOUT_MS=45000
```

Jadi ini cocok untuk tim yang tidak ingin instal/runtime Node.js di kasir.


### Troubleshooting `HttpListenerException: Access is denied`

Jika agent .NET error:

- `System.Net.HttpListenerException: Access is denied`

penyebabnya biasanya URL ACL Windows belum diizinkan untuk host/port tersebut.

Perbaikan:

1. Paling aman: pakai host `localhost` (default) saat uji lokal.
2. Jika harus bind ke IP/LAN, jalankan CMD **as Administrator** lalu daftarkan URL ACL:

```cmd
netsh http add urlacl url=http://+:19000/ user=Everyone
```

Atau untuk IP spesifik:

```cmd
netsh http add urlacl url=http://192.168.1.10:19000/ user=Everyone
```

3. Restart agent setelah URL ACL berhasil ditambahkan.


### Diagnosa dari backend VPS (tanpa SSH ke kasir)

Untuk cek apakah VPS bisa menjangkau agent, panggil endpoint backend ini:

```http
POST /api/printers/test-agent
```

Body optional override:

```json
{
  "printer": {
    "agent_url": "http://172.200.201.101:19000",
    "agent_token": "secret123"
  }
}
```

Jika gagal, response akan berisi detail error koneksi (`ETIMEDOUT`, `ECONNREFUSED`, dll).


### Troubleshooting PM2: `Identifier 'printViaAgent' has already been declared`

Jika PM2 log menampilkan error parser tersebut, biasanya proses backend masih membaca file lama/hasil merge deploy yang duplikat.

Langkah cepat di VPS:

```bash
cd /home/numarsadmin/fullnumars/backend
git pull
node --check modules/printers/printer.service.js
pm2 restart numars-pos-backend --update-env
```

Jika masih muncul, jalankan:

```bash
pm2 delete numars-pos-backend
pm2 start server.js --name numars-pos-backend
```


### Troubleshooting .NET: `No data is available for encoding 437`

Jika muncul error ini dari agent .NET, pastikan build terbaru sudah dipakai.

Perbaikan yang sudah diterapkan di source:
- register code page provider: `Encoding.RegisterProvider(CodePagesEncodingProvider.Instance)`
- referensi package: `System.Text.Encoding.CodePages`

Di PC kasir, lakukan rebuild/publish ulang agent .NET lalu restart aplikasinya.


### Override nama printer dari backend

Jika default printer Windows salah, bisa override dari request backend:

```json
{
  "order_id": 123,
  "printer": {
    "agent_url": "http://172.200.201.101:19000",
    "agent_token": "secret123",
    "agent_printer_name": "POS-58"
  }
}
```

Tip: cek daftar printer yang dikenali agent lewat `GET /printers`.


### Troubleshooting .NET build: `The name 'PrinterSettings' does not exist in the current context`

Jika error ini muncul saat build agent .NET:

- pastikan project terbaru sudah ter-pull, karena `.csproj` sudah ditambah:
  - `<UseSystemDrawing>true</UseSystemDrawing>`
  - `System.Drawing.Common` package

Lalu lakukan restore + rebuild di Visual Studio.


### Test print end-to-end dari backend

Selain cek health, sekarang ada endpoint backend untuk tes print langsung ke agent:

```http
POST /api/printers/test-agent-print
```

Body optional:

```json
{
  "printer": {
    "agent_url": "http://172.200.201.101:19000",
    "agent_token": "secret123",
    "agent_printer_name": "POS-58"
  }
}
```

Jika gagal, response akan berisi detail Win32 dari agent (`errorCode`, `errorMessage`, `printers`).


### Troubleshooting .NET build: duplicate attributes / `Only one compilation unit can have top-level statements`

Jika Visual Studio menampilkan error seperti:
- `Duplicate global::System.Runtime.Versioning.TargetFrameworkAttribute`
- `Duplicate System.Reflection.Assembly...Attribute`
- `Only one compilation unit can have top-level statements`
- `Ambiguity between 'AgentConfig....' and 'AgentConfig....'`

Penyebab paling umum: file compile ter-load ganda (mis. cache `obj/bin` lama atau wildcard compile yang ikut membaca file generated).

Perbaikan di project ini:
- `WindowsDotnetPrintAgent.csproj` sekarang dipaksa compile hanya `Program.cs`.
- Generate assembly attributes otomatis dimatikan agar tidak bentrok.

Di PC kasir tetap lakukan langkah ini setelah pull terbaru:
1. Tutup Visual Studio.
2. Hapus folder `bin` dan `obj` di `backend/agents/windows-dotnet-print-agent`.
3. Buka lagi project, lalu **Restore** dan **Rebuild**.

### Troubleshooting Win32 `errorCode: 1804` (The specified datatype is invalid)

Jika agent mengembalikan error ini, driver printer tidak menerima `RAW` pada `StartDocPrinter`.

Perbaikan yang sudah diterapkan:
- Jika `PRINT_AGENT_PORT_NAME` diisi, agent akan coba direct-port dulu (bypass spooler).
- Agent sekarang memakai aturan berikut:
- `PRINT_AGENT_DATATYPE=AUTO` (atau kosong): fokus thermal (`RAW` -> `RAW + FF`).
- `PRINT_AGENT_DATATYPE=AUTO_EXTENDED`: fallback lengkap (`RAW` -> `RAW + FF` -> `NT EMF 1.008` -> `NT EMF 1.007` -> `TEXT`).
- `PRINT_AGENT_DATATYPE=GDI_RECEIPT`: cetak via GDI (layout lebih rapih/mirip preview browser).
- `PRINT_AGENT_DATATYPE=TEXT`: pakai `TEXT` saja.
- `PRINT_AGENT_DATATYPE=RAW`: hanya mode RAW (`RAW` -> `RAW + FF`) agar tidak menghasilkan fallback menyesatkan.

Langkah operator:
1. Pull source terbaru dan publish ulang .NET agent.
2. Restart agent.
3. Jika masih gagal, set di `agent-config.json`:

```json
{
  "dataType": "TEXT"
}
```

4. Ulangi tes lewat `POST /api/printers/test-agent-print`.


### Kenapa setelah publish tetap `localhost`?

Biasanya karena `agent-config.json` tidak terbaca (lokasi salah) atau JSON tidak valid.

Checklist:
1. Simpan `agent-config.json` di folder **yang sama** dengan file `.exe` hasil publish.
2. Pastikan JSON valid (tanpa karakter aneh sebelum `{`, tanpa typo).
3. Jalankan agent, lalu lihat log startup:
   - `config loaded: ...` -> config terbaca
   - `config not found...` -> file tidak ketemu
   - `gagal parse config...` -> JSON invalid

Jika tetap fallback ke localhost/default printer, cek juga apakah env var lama masih aktif (`PRINT_AGENT_HOST`, `PRINT_AGENT_PRINTER`) karena env var akan override config file.

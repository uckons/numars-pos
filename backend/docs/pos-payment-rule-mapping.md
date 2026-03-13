# POS Payment → COA Mapping (CASH / TRANSFER / QRIS / CREDIT)

POS payment journals are posted by event code `POS_PAYMENT` and variant based on payment method.

## Recommended mapping

- `CASH` → Debit **Kas** (asset), Credit **Pendapatan Jasa/Penjualan** (revenue)
- `TRANSFER` → Debit **Bank** (asset), Credit **Pendapatan Jasa/Penjualan** (revenue)
- `QRIS` → Debit **Clearing QRIS / Bank QRIS** (asset), Credit **Pendapatan Jasa/Penjualan** (revenue)
- `CREDIT` → Debit **Piutang Usaha (AR)** (asset), Credit **Pendapatan Jasa/Penjualan** (revenue)

## Setup script

Run from repo root:

```bash
COA_CASH=1101 \
COA_TRANSFER=1102 \
COA_QRIS=1103 \
COA_AR=1201 \
COA_REVENUE_POS=4101 \
node backend/scripts/setup-pos-payment-rules.js
```

If your COA codes differ, replace env values with your final `chart_of_accounts.code` values.

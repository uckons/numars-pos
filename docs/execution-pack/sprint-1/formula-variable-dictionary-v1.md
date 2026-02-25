# Formula Variable Dictionary v1 (S1-06)

Dokumen ini mendefinisikan variabel formula yang boleh dipakai pada engine payroll/reporting awal.

## Domain

- `PAYROLL_STAFF`
- `PAYROLL_THERAPIST`
- `PAYROLL_AGENT`

## Variable Catalog

| Variable | Type | Domain | Description | Source |
|---|---|---|---|---|
| `base_salary` | number | PAYROLL_STAFF | Gaji pokok staff | payroll input |
| `allowance_total` | number | PAYROLL_STAFF | Total tunjangan | payroll input |
| `overtime_amount` | number | PAYROLL_STAFF | Nilai lembur | attendance/payroll |
| `bonus_amount` | number | ALL PAYROLL | Bonus | payroll input |
| `deduction_total` | number | ALL PAYROLL | Total potongan | payroll input |
| `tax_amount` | number | PAYROLL_STAFF | Pajak | payroll calc |
| `bpjs_amount` | number | PAYROLL_STAFF | BPJS | payroll calc |
| `work_count` | number | PAYROLL_THERAPIST | Jumlah pekerjaan terapis | timers/orders |
| `commission_rate` | number | PAYROLL_THERAPIST | Rate komisi | grade/rule |
| `commission_amount` | number | PAYROLL_THERAPIST | Nilai komisi final | calc |
| `total_revenue` | number | PAYROLL_THERAPIST, PAYROLL_AGENT | Omzet terkait period | orders/report |
| `agent_share_rate` | number | PAYROLL_AGENT | Persentase share agent | agent rule |
| `flat_fee` | number | PAYROLL_AGENT | Fee flat per terapis/periode | agent rule |
| `penalty_amount` | number | ALL PAYROLL | Penalti | payroll input |

## Allowed Operators / Functions

- Arithmetic: `+`, `-`, `*`, `/`, `(`, `)`
- Scalar functions: `MIN(a,b)`, `MAX(a,b)`, `ROUND(x, n)`

## Reserved Keywords (blocked)

- `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `;`, `--`

## Validation Rules

1. Variabel harus ada di catalog domain terkait.
2. Expression hanya boleh pakai operator/function yang diizinkan.
3. Hasil evaluasi harus finite number (bukan NaN/Infinity).
4. Perubahan formula harus via approval (`SUBMITTED -> APPROVED -> ACTIVE`).

## Example Formulas

### Payroll Staff
`(base_salary + allowance_total + overtime_amount + bonus_amount) - deduction_total - tax_amount - bpjs_amount - penalty_amount`

### Payroll Therapist
`(work_count * commission_rate) + bonus_amount - penalty_amount`

### Payroll Agent
`(total_revenue * agent_share_rate) + flat_fee + bonus_amount - deduction_total - penalty_amount`

## Acceptance Checklist (S1-06)

- [ ] Catalog variabel disetujui Product + Finance + Engineering.
- [ ] Rule validator tervalidasi terhadap sample expression valid/invalid.
- [ ] Reserved keywords diblokir.
- [ ] Mekanisme approval perubahan formula disepakati.

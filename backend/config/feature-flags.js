const toBool = (val, defaultVal = false) => {
  if (val === undefined || val === null || String(val).trim() === '') return defaultVal
  const normalized = String(val).trim().toLowerCase()
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)
}

const featureFlags = {
  accounting_v2_enabled: toBool(process.env.FEATURE_ACCOUNTING_V2, false),
  approval_matrix_v1_enabled: toBool(process.env.FEATURE_APPROVAL_MATRIX_V1, false),
  formula_engine_v1_enabled: toBool(process.env.FEATURE_FORMULA_ENGINE_V1, false),
  payroll_staff_v1_enabled: toBool(process.env.FEATURE_PAYROLL_STAFF_V1, false),
  payroll_therapist_v1_enabled: toBool(process.env.FEATURE_PAYROLL_THERAPIST_V1, false),
  payroll_agent_v1_enabled: toBool(process.env.FEATURE_PAYROLL_AGENT_V1, false),
  bank_reconciliation_v1_enabled: toBool(process.env.FEATURE_BANK_RECON_V1, false),
  multi_outlet_transfer_v1_enabled: toBool(process.env.FEATURE_MULTI_OUTLET_TRANSFER_V1, false)
}

module.exports = {
  featureFlags,
  toBool
}

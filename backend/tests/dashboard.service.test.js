const test = require('node:test')
const assert = require('node:assert/strict')

const dashboardService = require('../modules/dashboard/dashboard.service')

test('resolveAnalyticsBranchId uses user branch for kasir role', () => {
  const branchId = dashboardService.resolveAnalyticsBranchId(
    { role: 'Kasir', branch_id: 3 },
    { branch_id: 99 }
  )
  assert.equal(branchId, 3)
})

test('resolveAnalyticsBranchId allows manager to request branch override', () => {
  const branchId = dashboardService.resolveAnalyticsBranchId(
    { role: 'Manager', branch_id: 3 },
    { branch_id: 99 }
  )
  assert.equal(branchId, 99)
})

test('resolveAnalyticsBranchId throws when branch context invalid', () => {
  assert.throws(
    () => dashboardService.resolveAnalyticsBranchId({ role: 'Kasir', branch_id: null }, {}),
    /branch_id tidak valid/
  )
})

const test = require('node:test')
const assert = require('node:assert/strict')

const { _private } = require('../modules/accounting/payroll-flex.service')

test('validateExpression rejects SQL keywords', () => {
  assert.throws(() => _private.validateExpression('SELECT * FROM x'), /keyword terlarang/)
})

test('parseVariables extracts variable names excluding functions', () => {
  const vars = _private.parseVariables('ROUND((total_revenue * agent_share_rate) + flat_fee, 2)')
  assert.deepEqual(vars.sort(), ['agent_share_rate', 'flat_fee', 'total_revenue'])
})

test('evalExpression computes hybrid expression result', () => {
  const result = _private.evalExpression(
    '((commission_base * commission_rate) + (total_revenue * revenue_share_rate) + (work_count * flat_rate)) + bonus_amount - deduction_total - penalty_amount',
    {
      commission_base: 1000000,
      commission_rate: 0.2,
      total_revenue: 5000000,
      revenue_share_rate: 0.05,
      work_count: 10,
      flat_rate: 25000,
      bonus_amount: 50000,
      deduction_total: 20000,
      penalty_amount: 30000
    }
  )

  assert.equal(result.amount, 700000)
})

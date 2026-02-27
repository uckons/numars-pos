const router = require('express').Router()
const auth = require('../../middlewares/auth.middleware')
const rbac = require('../../middlewares/rbac.middleware')
const c = require('./payroll-flex.controller')

router.use(auth, rbac(['SuperAdmin', 'Owner', 'Manager']))

router.get('/payroll-flex/models', c.getModels)
router.put('/payroll-flex/formulas/:model_key', c.updateFormula)
router.post('/payroll-flex/preview', c.previewPayroll)

module.exports = router

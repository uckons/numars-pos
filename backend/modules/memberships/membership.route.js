const express = require('express')
const router = express.Router()
const auth = require('../../middlewares/auth.middleware')
const rbac = require('../../middlewares/rbac.middleware')
const c = require('./membership.controller')

router.get('/config', auth, rbac(['SuperAdmin', 'Owner', 'Manager', 'Kasir']), c.getConfig)
router.post('/config', auth, rbac(['SuperAdmin', 'Owner', 'Manager']), c.saveConfig)

router.get('/plans', auth, rbac(['SuperAdmin', 'Owner', 'Manager', 'Kasir']), c.listPlans)
router.post('/plans', auth, rbac(['SuperAdmin', 'Owner', 'Manager']), c.savePlan)

router.get('/members', auth, rbac(['SuperAdmin', 'Owner', 'Manager', 'Kasir']), c.listMembers)
router.post('/members', auth, rbac(['SuperAdmin', 'Owner', 'Manager', 'Kasir']), c.createMember)

router.post('/discount/validate', auth, rbac(['SuperAdmin', 'Owner', 'Manager', 'Kasir']), c.validateDiscount)
router.get('/reports/summary', auth, rbac(['SuperAdmin', 'Owner', 'Manager']), c.reportSummary)

module.exports = router

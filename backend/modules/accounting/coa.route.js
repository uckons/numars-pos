const router = require('express').Router()
const auth = require('../../middlewares/auth.middleware')
const rbac = require('../../middlewares/rbac.middleware')
const c = require('./coa.controller')

router.use(auth, rbac(['SuperAdmin', 'Owner', 'Manager']))

router.get('/coa', c.listCoa)
router.post('/coa', c.createCoa)
router.put('/coa/:id', c.updateCoa)

module.exports = router

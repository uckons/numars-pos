const express = require('express')
const router = express.Router()
const auth = require('../../middlewares/auth.middleware')
const rbac = require('../../middlewares/rbac.middleware')
const roomController = require('./room.controller')

router.use(auth)

router.get('/', roomController.getRooms)
router.post('/', rbac(['SuperAdmin']), roomController.createRoom)
router.put('/:id', rbac(['SuperAdmin']), roomController.updateRoom)
router.put('/:id/toggle', rbac(['SuperAdmin']), roomController.toggleRoom)
router.delete('/:id', rbac(['SuperAdmin']), roomController.deleteRoom)

module.exports = router

const router = require('express').Router()
const auth = require('../../middlewares/auth.middleware')
const c = require('./manual-journal.controller')

router.use(auth)

router.post('/manual-journals', c.createManualJournal)
router.get('/manual-journals', c.listManualJournals)
router.get('/manual-journals/:id', c.getManualJournalDetail)
router.post('/manual-journals/:id/submit', c.submitManualJournal)
router.post('/manual-journals/:id/approve', c.approveManualJournal)
router.post('/manual-journals/:id/reject', c.rejectManualJournal)

router.post('/recurring-journals/templates', c.createRecurringTemplate)
router.post('/recurring-journals/templates/:id/pause', c.pauseRecurringTemplate)
router.post('/recurring-journals/templates/:id/resume', c.resumeRecurringTemplate)

router.post('/internal/recurring-journals/generate', c.generateRecurringRuns)

module.exports = router

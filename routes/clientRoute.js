const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { getClientUsers, getGeneratedReports, approveReport, rejectReport, getReport } = require('../controllers/client')

const clientRoute = Router()

clientRoute.get('/getReport/:id', auth, getReport)
clientRoute.get('/getReportForClient', auth, getReport)
clientRoute.get('/getAllReports', auth, getGeneratedReports)
// clientRoute.get('/clientUsers', getClientUsers)
clientRoute.post('/appreveReport', approveReport)
clientRoute.post('/rejectReport', rejectReport)

module.exports = clientRoute
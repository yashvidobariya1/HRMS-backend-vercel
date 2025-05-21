const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { getClientUsers, getGeneratedReports, approveReport, rejectReport, getReport } = require('../controllers/client')

const clientRoute = Router()

clientRoute.get('/getReport', auth, getReport)
clientRoute.get('/getReportForClient', auth, getReport)
clientRoute.get('/getAllReports', auth, getGeneratedReports)
// clientRoute.get('/clientUsers', getClientUsers)
clientRoute.post('/approveReport', auth, approveReport)
clientRoute.post('/rejectReport', auth, rejectReport)

module.exports = clientRoute
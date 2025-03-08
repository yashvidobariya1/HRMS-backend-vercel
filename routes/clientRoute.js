const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { decodeLink, getCLientUsers, getGeneratedReports, approveReport, rejectReport, getReport } = require('../controllers/client')

const clientRoute = Router()

clientRoute.post('/decodeLink', decodeLink)
clientRoute.get('/clientUsers', getCLientUsers)
clientRoute.get('/getAllReports', auth, getGeneratedReports)
clientRoute.get('/getReport/:id', auth, getReport)
clientRoute.post('/appreveReport', approveReport)
clientRoute.post('/rejectReport', rejectReport)

module.exports = clientRoute
const Router = require('express')
const { getCLientUsers, decodeLink, approveReport, rejectReport } = require('../controllers/client')

const clientRoute = Router()

clientRoute.post('/decodeLink', decodeLink)
clientRoute.get('/clientUsers', getCLientUsers)
clientRoute.post('/appreveReport', approveReport)
clientRoute.post('/rejectReport', rejectReport)

module.exports = clientRoute
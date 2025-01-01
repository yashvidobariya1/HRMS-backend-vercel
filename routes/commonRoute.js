const Router = require('express')
const { login, forgotPassword, getAllUsers, clockInFunc } = require('../controllers/common')
const { auth } = require('../middleware/authenticate')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/forgotpassword', forgotPassword)
commonRoute.get('/getallusers', auth(['Superadmin', 'Administrator', 'Manager']), getAllUsers)
// commonRoute.post('/clockin', clockInFunc)

module.exports = commonRoute
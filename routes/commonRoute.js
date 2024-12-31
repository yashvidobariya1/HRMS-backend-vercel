const Router = require('express')
const { login, forgotPassword, getAllUsers } = require('../controllers/common')
const { auth } = require('../middleware/authenticate')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/forgotpassword', forgotPassword)
commonRoute.get('/getallusers', auth(['Superadmin', 'Administrator', 'Manager']), getAllUsers)

module.exports = commonRoute
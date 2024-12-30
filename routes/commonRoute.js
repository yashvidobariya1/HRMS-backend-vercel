const Router = require('express')
const { login, forgotPassword } = require('../controllers/common')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/forgotpassword', forgotPassword)

module.exports = commonRoute
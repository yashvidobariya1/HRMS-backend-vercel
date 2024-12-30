const Router = require('express')
const { forgotPassword } = require('../controllers/commonCon')

const commonRoute = Router()

commonRoute.post('/forgotpassword', forgotPassword)

module.exports = commonRoute
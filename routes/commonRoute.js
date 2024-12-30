const Router = require('express')
const { login } = require('../controllers/common')

const commonRoute = Router()

commonRoute.post('/login', login)

module.exports = commonRoute
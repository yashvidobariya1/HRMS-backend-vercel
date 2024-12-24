const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { getDetails } = require('../controller/employeeController/employeeController')

const employeeRoute = Router()

employeeRoute.post('/getdetails', getDetails)

module.exports = employeeRoute
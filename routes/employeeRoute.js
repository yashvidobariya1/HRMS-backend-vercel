const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { getDetails } = require('../controller/employeeController/employeeController')

const employeeRoute = Router()

employeeRoute.post('/getdetails', auth(["Employee", "Manager", "Administrator"]), getDetails)

module.exports = employeeRoute
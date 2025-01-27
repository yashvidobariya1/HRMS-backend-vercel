const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addEmployee, getEmployee, getAllEmployees, updateEmployee, deleteEmployee } = require('../controllers/employee')

const employeeRoute = Router()

//crud by superAdmin, administrator, manager
// employeeRoute.post('/addEmployee', auth, addEmployee)
// employeeRoute.get('/getEmployee/:id', auth, getEmployee)
// employeeRoute.get('/getAllEmployee', auth, getAllEmployees)
// employeeRoute.post('/updateEmployee/:id', auth, updateEmployee)
// employeeRoute.post('/deleteEmployee/:id', auth, deleteEmployee)

module.exports = employeeRoute
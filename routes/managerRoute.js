const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addEmployee, getEmployee, updateEmployee, deleteEmployee, getAllEmployees } = require('../controller/managerController/crudEmployee')

const managerRoute = Router()


managerRoute.post('/addemployee', addEmployee)
managerRoute.post('/getemployee/:id', getEmployee)
managerRoute.post('/getallemployee', getAllEmployees)
managerRoute.post('/updateemployee/:id', updateEmployee)
managerRoute.post('/deleteemployee/:id', deleteEmployee)

module.exports = managerRoute
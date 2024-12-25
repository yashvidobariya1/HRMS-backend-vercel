const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addEmployee, getEmployee, updateEmployee, deleteEmployee, getAllEmployees } = require('../controller/managerController/crudEmployee')

const managerRoute = Router()


managerRoute.post('/addemployee', auth(["Manager", "Administrator"]), addEmployee)
managerRoute.post('/getemployee/:id', auth(["Manager", "Administrator"]), getEmployee)
managerRoute.post('/getallemployee', auth(["Manager", "Administrator"]), getAllEmployees)
managerRoute.post('/updateemployee/:id', auth(["Manager", "Administrator"]), updateEmployee)
managerRoute.post('/deleteemployee/:id', auth(["Manager", "Administrator"]), deleteEmployee)

module.exports = managerRoute
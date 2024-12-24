const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addEmployee, getEmployee, updateEmployee, deleteEmployee } = require('../controller/managerController/crudEmployee')

const managerRoute = Router()


managerRoute.post('addemployee', auth, addEmployee)
managerRoute.post('getemployee/:id', auth, getEmployee)
managerRoute.post('updateemployee/:id', auth, updateEmployee)
managerRoute.post('deleteemployee/:id', auth, deleteEmployee)

module.exports = managerRoute
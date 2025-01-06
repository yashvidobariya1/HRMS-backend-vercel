const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addEmployee, getEmployee, getAllEmployees, updateEmployee, deleteEmployee } = require('../controllers/employee')
const { upload } = require('../utils/multer')

const employeeRoute = Router()

//crud by superAdmin, administrator, manager
employeeRoute.post('/addemployee', upload.array('documentDetials.document'), auth, addEmployee)
employeeRoute.get('/getemployee/:id', auth, getEmployee)
employeeRoute.get('/getallemployee', auth, getAllEmployees)
employeeRoute.post('/updateemployee/:id', auth, updateEmployee)
employeeRoute.post('/deleteemployee/:id', auth, deleteEmployee)

module.exports = employeeRoute
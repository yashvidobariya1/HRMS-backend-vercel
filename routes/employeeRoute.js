const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { getDetails, addEmployee, getEmployee, getAllEmployees, updateEmployee, deleteEmployee } = require('../controllers/employee')
const { upload } = require('../utils/multer')

const employeeRoute = Router()

//crud by superAdmin, administrator, manager
employeeRoute.post('/addemployee', upload.array('documentDetials.document'), auth, addEmployee)
employeeRoute.post('/getemployee/:id', auth, getEmployee)
employeeRoute.post('/getallemployee', auth, getAllEmployees)
employeeRoute.post('/updateemployee/:id', auth, updateEmployee)
employeeRoute.post('/deleteemployee/:id', auth, deleteEmployee)

//get own details(employee)
employeeRoute.post('/getdetails', auth, getDetails)

module.exports = employeeRoute
const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { getDetails, addEmployee, getEmployee, getAllEmployees, updateEmployee, deleteEmployee } = require('../controllers/employee')
const { upload } = require('../utils/multer')

const employeeRoute = Router()

//crud by superAdmin, administrator, manager
employeeRoute.post('/addemployee', upload.array('documentDetials.document'), auth(['Superadmin', 'Administrator', 'Manager']), addEmployee)
employeeRoute.post('/getemployee/:id', auth(['Superadmin', 'Administrator', 'Manager']), getEmployee)
employeeRoute.post('/getallemployee', auth(['Superadmin', 'Administrator', 'Manager']), getAllEmployees)
employeeRoute.post('/updateemployee/:id', auth(['Superadmin', 'Administrator', 'Manager']), updateEmployee)
employeeRoute.post('/deleteemployee/:id', auth(['Superadmin', 'Administrator', 'Manager']), deleteEmployee)

//get own details(employee)
employeeRoute.post('/getdetails', auth(["Employee"]), getDetails)

module.exports = employeeRoute
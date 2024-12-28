const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { getDetails, addEmployee, getEmployee, getAllEmployees, updateEmployee, deleteEmployee } = require('../controllers/employee')
const { upload } = require('../utils/multer')

const employeeRoute = Router()

//crud by superAdmin, administrator, manager
employeeRoute.post('/addemployee', upload.array('documentDetials.document'), auth(["Manager", "Administrator", "Superadmin"]), addEmployee)
employeeRoute.post('/getemployee/:id', auth(["Manager", "Administrator", "Superadmin"]), getEmployee)
employeeRoute.post('/getallemployee', auth(["Manager", "Administrator", "Superadmin"]), getAllEmployees)
employeeRoute.post('/updateemployee/:id', auth(["Manager", "Administrator", "Superadmin"]), updateEmployee)
employeeRoute.post('/deleteemployee/:id', auth(["Manager", "Administrator", "Superadmin"]), deleteEmployee)

//get own details(employee)
employeeRoute.post('/getdetails', auth(["Employee"]), getDetails)

module.exports = employeeRoute
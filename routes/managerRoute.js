const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addManager, getManager, getAllManager, updateManagerDetails, deleteManager } = require('../controllers/manager')

const managerRoute = Router()

//crud by superAdmin, administrator
managerRoute.post('/addmanager', auth(['Superadmin', 'Administrator', 'Manager']), addManager)
managerRoute.post('/getmanager/:id', auth(['Superadmin', 'Administrator', 'Manager']), getManager)
managerRoute.post('/getallmanager', auth(['Superadmin', 'Administrator', 'Manager']), getAllManager)
managerRoute.post('/updatemanager/:id', auth(['Superadmin', 'Administrator', 'Manager']), updateManagerDetails)
managerRoute.post('/deletemanager/:id', auth(['Superadmin', 'Administrator', 'Manager']), deleteManager)


module.exports = managerRoute
const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addManager, getManager, getAllManager, updateManagerDetails, deleteManager } = require('../controllers/manager')

const managerRoute = Router()

//crud by superAdmin, administrator
managerRoute.post('/addmanager', auth(['Administrator', 'Superadmin']), addManager)
managerRoute.post('/getmanager/:id', auth(['Administrator', 'Superadmin']), getManager)
managerRoute.post('/getallmanager', auth(['Administrator', 'Superadmin']), getAllManager)
managerRoute.post('/updatemanager/:id', auth(['Administrator', 'Superadmin']), updateManagerDetails)
managerRoute.post('/deletemanager/:id', auth(['Administrator', 'Superadmin']), deleteManager)


module.exports = managerRoute
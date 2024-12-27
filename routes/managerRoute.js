const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addManager, getManager, getAllManager, updateManagerDetails, deleteManager } = require('../controllers/manager')

const managerRoute = Router()

//crud by superAdmin, administrator
managerRoute.post('/addmanager', auth(['Administrator', 'superAdmin']), addManager)
managerRoute.post('/getmanager/:id', auth(['Administrator', 'superAdmin']), getManager)
managerRoute.post('/getallmanager', auth(['Administrator', 'superAdmin']), getAllManager)
managerRoute.post('/updatemanager/:id', auth(['Administrator', 'superAdmin']), updateManagerDetails)
managerRoute.post('/deletemanager/:id', auth(['Administrator', 'superAdmin']), deleteManager)

module.exports = managerRoute
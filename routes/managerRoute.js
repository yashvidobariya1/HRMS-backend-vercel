const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addManager, getManager, getAllManager, updateManagerDetails, deleteManager } = require('../controllers/manager')

const managerRoute = Router()

//crud by superAdmin, administrator
managerRoute.post('/addmanager', auth, addManager)
managerRoute.get('/getmanager/:id', auth, getManager)
managerRoute.get('/getallmanager', auth, getAllManager)
managerRoute.post('/updatemanager/:id', auth, updateManagerDetails)
managerRoute.post('/deletemanager/:id', auth, deleteManager)


module.exports = managerRoute
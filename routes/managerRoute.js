const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addManager, getManager, getAllManager, updateManagerDetails, deleteManager } = require('../controllers/manager')

const managerRoute = Router()

//crud by superAdmin, administrator
managerRoute.post('/addManager', auth, addManager)
managerRoute.get('/getManager/:id', auth, getManager)
managerRoute.get('/getAllManager', auth, getAllManager)
managerRoute.post('/updateManager/:id', auth, updateManagerDetails)
managerRoute.post('/deleteManager/:id', auth, deleteManager)


module.exports = managerRoute
const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addManager, getManager, getAllManager, updateManagerDetails, deleteManager } = require('../controller/administratorController/crudManager')

const administratorRoute = Router()


administratorRoute.post('/addmanager', addManager)
administratorRoute.post('/getmanager/:id', getManager)
administratorRoute.post('/getallmanager', getAllManager)
administratorRoute.post('/updatemanager/:id', updateManagerDetails)
administratorRoute.post('/deletemanager/:id', deleteManager)

module.exports = administratorRoute
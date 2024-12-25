const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addManager, getManager, getAllManager, updateManagerDetails, deleteManager } = require('../controller/administratorController/crudManager')

const administratorRoute = Router()


administratorRoute.post('/addmanager', auth(['Administrator']), addManager)
administratorRoute.post('/getmanager/:id', auth(['Administrator']), getManager)
administratorRoute.post('/getallmanager', auth(['Administrator']), getAllManager)
administratorRoute.post('/updatemanager/:id', auth(['Administrator']), updateManagerDetails)
administratorRoute.post('/deletemanager/:id', auth(['Administrator']), deleteManager)

module.exports = administratorRoute
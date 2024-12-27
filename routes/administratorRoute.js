const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addManager, getManager, getAllManager, updateManagerDetails, deleteManager } = require('../controller/administratorController/crudManager')

const administratorRoute = Router()



module.exports = administratorRoute
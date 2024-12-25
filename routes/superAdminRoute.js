const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addCompany, getCompany, updateCompanyDetails, deleteCompany, getAllCompany } = require('../controller/superAdminController/crudCompanies')

const superAdminRoute = Router()


superAdminRoute.post('/addcompany', addCompany)
superAdminRoute.post('/getcompany/:id', getCompany)
superAdminRoute.post('/getallcompany', getAllCompany)
superAdminRoute.post('/updatecompany/:id', updateCompanyDetails)
superAdminRoute.post('/deletecompany/:id', deleteCompany)

module.exports = superAdminRoute
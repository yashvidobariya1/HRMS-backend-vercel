const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addCompany, getCompany, updateCompanyDetails, deleteCompany, getAllCompany } = require('../controller/superAdminController/crudCompanies')

const superAdminRoute = Router()


superAdminRoute.post('/addcompany', auth(['Superadmin']), addCompany)
superAdminRoute.post('/getcompany/:id', auth(['Superadmin']), getCompany)
superAdminRoute.post('/getallcompany', auth(['Superadmin']), getAllCompany)
superAdminRoute.post('/updatecompany/:id', auth(['Superadmin']), updateCompanyDetails)
superAdminRoute.post('/deletecompany/:id', auth(['Superadmin']), deleteCompany)

module.exports = superAdminRoute
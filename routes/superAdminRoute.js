const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addCompany, getCompany, updateCompanyDetails, deleteCompany, getAllCompany } = require('../controllers/company')
const { addLocation, getLocation, getAllLocation, updateLocationDetails, deleteLocation } = require('../controllers/location')

const superAdminRoute = Router()

//company
superAdminRoute.post('/addcompany', auth(['Superadmin', 'Administrator', 'Manager']), addCompany)
superAdminRoute.post('/getcompany/:id', auth(['Superadmin', 'Administrator', 'Manager']), getCompany)
superAdminRoute.post('/getallcompany', auth(['Superadmin', 'Administrator', 'Manager']), getAllCompany)
superAdminRoute.post('/updatecompany/:id', auth(['Superadmin', 'Administrator', 'Manager']), updateCompanyDetails)
superAdminRoute.post('/deletecompany/:id', auth(['Superadmin', 'Administrator', 'Manager']), deleteCompany)
//location
superAdminRoute.post('/addlocation', auth(['Superadmin', 'Administrator', 'Manager']), addLocation)
superAdminRoute.post('/getlocation/:id', auth(['Superadmin', 'Administrator', 'Manager']), getLocation)
superAdminRoute.post('/getalllocation', auth(['Superadmin', 'Administrator', 'Manager']), getAllLocation)
superAdminRoute.post('/updatelocation/:id', auth(['Superadmin', 'Administrator', 'Manager']), updateLocationDetails)
superAdminRoute.post('/deletelocation/:id', auth(['Superadmin', 'Administrator', 'Manager']), deleteLocation)

module.exports = superAdminRoute
const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addCompany, getCompany, updateCompanyDetails, deleteCompany, getAllCompany } = require('../controllers/company')
const { addLocation, getLocation, getAllLocation, updateLocationDetails, deleteLocation } = require('../controllers/location')

const superAdminRoute = Router()

//company
superAdminRoute.post('/addcompany', auth(['Superadmin']), addCompany)
superAdminRoute.post('/getcompany/:id', auth(['Superadmin']), getCompany)
superAdminRoute.post('/getallcompany', auth(['Superadmin']), getAllCompany)
superAdminRoute.post('/updatecompany/:id', auth(['Superadmin']), updateCompanyDetails)
superAdminRoute.post('/deletecompany/:id', auth(['Superadmin']), deleteCompany)
//location
superAdminRoute.post('/addlocation', auth(['Superadmin']), addLocation)
superAdminRoute.post('/getlocation/:id', auth(['Superadmin']), getLocation)
superAdminRoute.post('/getalllocation', auth(['Superadmin']), getAllLocation)
superAdminRoute.post('/updatelocation/:id', auth(['Superadmin']), updateLocationDetails)
superAdminRoute.post('/deletelocation/:id', auth(['Superadmin']), deleteLocation)

module.exports = superAdminRoute
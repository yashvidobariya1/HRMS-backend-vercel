const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addCompany, getCompany, updateCompanyDetails, deleteCompany, getAllCompany } = require('../controllers/company')
const { addLocation, getLocation, getAllLocation, getCompanyLocations, updateLocationDetails, deleteLocation } = require('../controllers/location')

const superAdminRoute = Router()

//company
superAdminRoute.post('/addcompany', auth, addCompany)
superAdminRoute.get('/getcompany/:id', auth, getCompany)
superAdminRoute.get('/getallcompany', auth, getAllCompany)
superAdminRoute.post('/updatecompany/:id', auth, updateCompanyDetails)
superAdminRoute.post('/deletecompany/:id', auth, deleteCompany)
//location
superAdminRoute.post('/addlocation', auth, addLocation)
superAdminRoute.get('/getlocation/:id', auth, getLocation)
superAdminRoute.get('/getalllocation', auth, getAllLocation)
// get all company location by company ID
superAdminRoute.get('/company-locations/:id', auth, getCompanyLocations)
superAdminRoute.post('/updatelocation/:id', auth, updateLocationDetails)
superAdminRoute.post('/deletelocation/:id', auth, deleteLocation)

module.exports = superAdminRoute
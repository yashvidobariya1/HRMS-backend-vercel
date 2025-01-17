const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addCompany, getCompany, updateCompanyDetails, deleteCompany, getAllCompany } = require('../controllers/company')
const { addLocation, getLocation, getAllLocation, getCompanyLocations, updateLocationDetails, deleteLocation } = require('../controllers/location')
const { addContract, getAllContract, getAllContractOfCompany, getContract, updateContract, deleteContract } = require('../controllers/contract')

const superAdminRoute = Router()

//company
superAdminRoute.post('/addCompany', auth, addCompany)
superAdminRoute.get('/getCompany/:id', auth, getCompany)
superAdminRoute.get('/getAllCompany', auth, getAllCompany)
superAdminRoute.post('/updateCompany/:id', auth, updateCompanyDetails)
superAdminRoute.post('/deleteCompany/:id', auth, deleteCompany)
//location
superAdminRoute.post('/addLocation', auth, addLocation)
superAdminRoute.get('/getLocation/:id', auth, getLocation)
superAdminRoute.get('/getAllLocation', auth, getAllLocation)
// get all company location by company ID
superAdminRoute.get('/getCompanyLocations/:id', auth, getCompanyLocations)
superAdminRoute.post('/updateLocation/:id', auth, updateLocationDetails)
superAdminRoute.post('/deleteLocation/:id', auth, deleteLocation)
// Contract template
superAdminRoute.post('/addContract', auth, addContract)
superAdminRoute.get('/getAllContract', auth, getAllContract)
superAdminRoute.get('/getAllContractOfCompany', auth, getAllContractOfCompany)
superAdminRoute.get('/getContract/:id', auth, getContract)
superAdminRoute.post('/updateContract/:id', auth, updateContract)
superAdminRoute.post('/deleteContract/:id', auth, deleteContract)

module.exports = superAdminRoute
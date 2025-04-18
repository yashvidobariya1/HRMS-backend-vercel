const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { addCompany, getCompany, updateCompanyDetails, deleteCompany, getAllCompany } = require('../controllers/company')
const { addLocation, getLocation, getAllLocation, getCompanyLocations, updateLocationDetails, deleteLocation } = require('../controllers/location')
const { addContract, getAllContract, getAllContractOfCompany, getContract, updateContract, deleteContract } = require('../controllers/contract')
const { generateQRcode, getAllQRCodes, inactivateQRCode } = require('../controllers/timeSheet')
const { addHoliday, getHoliday, getAllHolidays, updateHoliday, deleteHoliday } = require('../controllers/holiday')
const { addClient, getClient, getAllClient, updateClient, deleteClient, generateLinkForClient, getCompanyClients } = require('../controllers/client')
const { addTemplate, getTemplate, getAllTemplates, updateTemplate, deleteTemplate } = require('../controllers/templates')
const { activateDeactivateUser } = require('../controllers/common')
const { createJobPost, getJobPost, getAllJobPosts, updateJobPost, deleteJobPost, getJobPostForPublic, getCompanyLocationsForJobPost } = require('../controllers/recruitmentJob')
const { applyForJob, getCandidateDetails, getAllCandidates } = require('../controllers/candidate')

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
superAdminRoute.get('/getCompanyLocations', auth, getCompanyLocations)
superAdminRoute.post('/updateLocation/:id', auth, updateLocationDetails)
superAdminRoute.post('/deleteLocation/:id', auth, deleteLocation)
// Contract template
superAdminRoute.post('/addContract', auth, addContract)
superAdminRoute.get('/getAllContract', auth, getAllContract)
superAdminRoute.get('/getAllContractOfCompany', auth, getAllContractOfCompany)
superAdminRoute.get('/getContract/:id', auth, getContract)
superAdminRoute.post('/updateContract/:id', auth, updateContract)
superAdminRoute.post('/deleteContract/:id', auth, deleteContract)
// generate QR code for location
superAdminRoute.post('/generateQR/:id', auth, generateQRcode)
superAdminRoute.get('/getAllQRCodes/:id', auth, getAllQRCodes)
superAdminRoute.post('/inactivateQRCode/:id', auth, inactivateQRCode)
// holiday
superAdminRoute.post('/addHoliday', auth, addHoliday)
superAdminRoute.get('/getHoliday/:id', auth, getHoliday)
superAdminRoute.get('/getAllHolidays', auth, getAllHolidays)
superAdminRoute.post('/updateHoliday/:id', auth, updateHoliday)
superAdminRoute.post('/deleteHoliday/:id', auth, deleteHoliday)
// client module
superAdminRoute.post('/addClient', auth, addClient)
superAdminRoute.get('/getClient/:id', auth, getClient)
superAdminRoute.get('/getAllClients', auth, getAllClient)
superAdminRoute.get('/getCompanyClients', auth, getCompanyClients)
superAdminRoute.post('/updateClient/:id', auth, updateClient)
superAdminRoute.post('/deleteClient/:id', auth, deleteClient)
// template
superAdminRoute.post('/addTemplate', auth, addTemplate)
superAdminRoute.get('/getTemplate/:id', auth, getTemplate)
superAdminRoute.get('/getAllTemplates', auth, getAllTemplates)
superAdminRoute.post('/updateTemplate/:id', auth, updateTemplate)
superAdminRoute.post('/deleteTemplate/:id', auth, deleteTemplate)
// generate link for client
superAdminRoute.post('/generateLink', auth, generateLinkForClient)
// activate or deactivate 
superAdminRoute.post('/activateDeactivateUser', auth, activateDeactivateUser)
// Job post ( job & candidate )
superAdminRoute.post('/createJobPost', auth, createJobPost)
superAdminRoute.get('/getJobPost/:id', auth, getJobPost)
superAdminRoute.get('/job', getJobPostForPublic)
superAdminRoute.get('/getAllJobPosts', auth, getAllJobPosts)
superAdminRoute.post('/updateJobPost/:id', auth, updateJobPost)
superAdminRoute.post('/deleteJobPost/:id', auth, deleteJobPost)
superAdminRoute.get('/getCompanyLocationsForJobPost', auth, getCompanyLocationsForJobPost)
// candidate
superAdminRoute.post('/applyForJob/:key', applyForJob)
superAdminRoute.get('/getCandidateDetails/:id', auth, getCandidateDetails)
superAdminRoute.get('/getAllCandidates', auth, getAllCandidates)

module.exports = superAdminRoute
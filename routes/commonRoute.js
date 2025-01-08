const Router = require('express')
const { login, updatePassword, emailVerification, otpVerification, forgotPassword, getAllUsers, clockInFunc, clockOutFunc, getDetails } = require('../controllers/common')
const { auth } = require('../middleware/authenticate')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/updatepassword', updatePassword)
commonRoute.post('/emailverification', emailVerification)
commonRoute.post('/otpverification', otpVerification)
commonRoute.post('/forgotpassword', forgotPassword)
commonRoute.get('/getallusers', auth, getAllUsers)
commonRoute.post('/clockin', auth, clockInFunc)
commonRoute.post('/clockout', auth, clockOutFunc)

// get own details
commonRoute.get('/getdetails', auth, getDetails)

module.exports = commonRoute
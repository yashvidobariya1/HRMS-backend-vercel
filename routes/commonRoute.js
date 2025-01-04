const Router = require('express')
const { login, updatePassword, emailVerification, otpVerification, forgotPassword, getAllUsers, clockInFunc, clockOutFunc } = require('../controllers/common')
const { auth } = require('../middleware/authenticate')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/updatepassword', updatePassword)
commonRoute.post('/emailverification', emailVerification)
commonRoute.post('/otpverification', otpVerification)
commonRoute.post('/forgotpassword', forgotPassword)
commonRoute.get('/getallusers', auth(['Superadmin', 'Administrator', 'Manager']), getAllUsers)
commonRoute.post('/clockin', auth(['Administrator', 'Manager', 'Employee']), clockInFunc)
commonRoute.post('/clockout', auth(['Administrator', 'Manager', 'Employee']), clockOutFunc)

module.exports = commonRoute
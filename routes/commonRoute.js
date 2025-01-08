const Router = require('express')
const { login, updatePassword, emailVerification, otpVerification, forgotPassword, clockInFunc, clockOutFunc, getDetails, getOwnTimeSheet, addUser, getUser, getAllUsers, updateUserDetails, deleteUserDetails } = require('../controllers/common')
const { auth } = require('../middleware/authenticate')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/updatepassword', updatePassword)
commonRoute.post('/emailverification', emailVerification)
commonRoute.post('/otpverification', otpVerification)
commonRoute.post('/forgotpassword', forgotPassword)


commonRoute.post('/adduser', auth, addUser)
commonRoute.get('/getuser/:id', auth, getUser)
commonRoute.get('/getallusers', auth, getAllUsers)
commonRoute.post('/updateuser/:id', auth, updateUserDetails)
commonRoute.post('/deleteuser/:id', auth, deleteUserDetails)

commonRoute.get('/getowntimesheet', auth, getOwnTimeSheet)
commonRoute.post('/clockin', auth, clockInFunc)
commonRoute.post('/clockout', auth, clockOutFunc)

// get own details
commonRoute.get('/getdetails', auth, getDetails)

module.exports = commonRoute
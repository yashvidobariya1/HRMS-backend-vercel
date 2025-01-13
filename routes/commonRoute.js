const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { login, updatePassword, emailVerification, otpVerification, forgotPassword, getDetails, addUser, getUser, getAllUsers, updateUserDetails, deleteUserDetails } = require('../controllers/common')
const { getOwnTodaysTimeSheet, getOwnAllTimeSheets, clockInFunc, clockOutFunc, getTimesheetByMonthAndYear } = require('../controllers/timeSheet')

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

commonRoute.get('/getowntimesheet', auth, getOwnTodaysTimeSheet)
commonRoute.get('/getown-allTimesheet', auth, getOwnAllTimeSheets)
commonRoute.post('/clockin', auth, clockInFunc)
commonRoute.post('/clockout', auth, clockOutFunc)

// get own details
commonRoute.get('/getdetails', auth, getDetails)

// get attendence by month and year
commonRoute.get('/get-attendances', auth, getTimesheetByMonthAndYear)

module.exports = commonRoute
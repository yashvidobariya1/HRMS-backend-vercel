const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { login, updatePassword, emailVerification, otpVerification, forgotPassword, getDetails, addUser, getUser, getAllUsers, updateUserDetails, deleteUserDetails, getNotifications, getUnreadNotificationsCount } = require('../controllers/common')
const { getOwnTodaysTimeSheet, getOwnAllTimeSheets, clockInFunc, clockOutFunc, getTimesheetByMonthAndYear, verifyQRCode } = require('../controllers/timeSheet')
const { leaveRequest, approveLeaveRequest, rejectLeaveRequest } = require('../controllers/leaveManagement')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/updatePassword', updatePassword)
commonRoute.post('/emailVerification', emailVerification)
commonRoute.post('/otpVerification', otpVerification)
commonRoute.post('/forgotPassword', forgotPassword)


commonRoute.post('/addUser', auth, addUser)
commonRoute.get('/getUser/:id', auth, getUser)
commonRoute.get('/getAllUsers', auth, getAllUsers)
commonRoute.post('/updateUser/:id', auth, updateUserDetails)
commonRoute.post('/deleteUser/:id', auth, deleteUserDetails)

commonRoute.get('/getOwnTimesheet', auth, getOwnTodaysTimeSheet)
commonRoute.get('/getOwnAllTimesheet', auth, getOwnAllTimeSheets)
commonRoute.post('/clockIn', auth, clockInFunc)
commonRoute.post('/clockOut', auth, clockOutFunc)

// get own details
commonRoute.get('/getDetails', auth, getDetails)

// get attendence by month and year
commonRoute.get('/getTimesheetsByMonthAndYear', auth, getTimesheetByMonthAndYear)

commonRoute.get('/getNotifications/:id', auth, getNotifications)
commonRoute.get('/getUnreadNotificationsCount/:id', auth, getUnreadNotificationsCount)

// QR code scanning
commonRoute.post('/verifyQRCode', auth, verifyQRCode) 

// leave request
commonRoute.post('/leaveRequest', auth, leaveRequest)
commonRoute.post('/leaveRequestApprove', auth, approveLeaveRequest)
commonRoute.post('/leaveRequestReject', auth, rejectLeaveRequest)

module.exports = commonRoute
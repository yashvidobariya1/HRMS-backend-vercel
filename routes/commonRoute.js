const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { login, updatePassword, emailVerification, otpVerification, forgotPassword, getDetails, addUser, getUser, getAllUsers, updateUserDetails, deleteUserDetails, generateContractLetter, getUserJobTitles, updateProfileDetails } = require('../controllers/common')
const { getOwnTodaysTimeSheet, getOwnAllTimeSheets, clockInFunc, clockOutFunc, getTimesheetByMonthAndYear, verifyQRCode, getOwnTimesheetByMonthAndYear } = require('../controllers/timeSheet')
const { leaveRequest, getAllOwnLeaves, getAllLeaveRequest, updateLeaveRequest, deleteLeaveRequest, approveLeaveRequest, rejectLeaveRequest, getAllowLeaveCount } = require('../controllers/leaveManagement')
const { getNotifications, getUnreadNotificationsCount, readNotification, getNotification } = require('../controllers/notification')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/updatePassword', updatePassword)
commonRoute.post('/emailVerification', emailVerification)
commonRoute.post('/otpVerification', otpVerification)
commonRoute.post('/forgotPassword', forgotPassword)

commonRoute.get('/getUserJobTitles', auth, getUserJobTitles)

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
commonRoute.post('/updateProfileDetails', auth, updateProfileDetails)

// get attendence by month and year
commonRoute.get('/getTimesheetsByMonthAndYear', auth, getTimesheetByMonthAndYear)
commonRoute.get('/getOwnTimesheetByMonthAndYear', auth, getOwnTimesheetByMonthAndYear)
// commonRoute.post('/generateContractLetter', generateContractLetter)

commonRoute.get('/getNotifications', auth, getNotifications)
commonRoute.get('/getUnreadNotificationsCount', auth, getUnreadNotificationsCount)
commonRoute.get('/getNotification/:id', auth, getNotification)
commonRoute.get('/readNotification/:id', auth, readNotification)

// QR code scanning
commonRoute.post('/verifyQRCode', auth, verifyQRCode) 

// leave request
commonRoute.post('/leaveRequest', auth, leaveRequest)
commonRoute.post('/getAllOwnLeaves', auth, getAllOwnLeaves)
commonRoute.get('/getAllLeaveRequest', auth, getAllLeaveRequest)
commonRoute.post('/updateLeaveRequest/:id', auth, updateLeaveRequest)
commonRoute.post('/deleteLeaveRequest/:id', auth, deleteLeaveRequest)
commonRoute.post('/leaveRequestApprove/:id', auth, approveLeaveRequest)
commonRoute.post('/leaveRequestReject/:id', auth, rejectLeaveRequest)
commonRoute.post('/getAllowLeaveCount', auth, getAllowLeaveCount)

module.exports = commonRoute
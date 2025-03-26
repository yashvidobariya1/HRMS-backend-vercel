const Router = require('express')
const { auth } = require('../middleware/authenticate')
const { login, logOut, updatePassword, emailVerification, otpVerification, forgotPassword, getDetails, addUser, getUser, getAllUsers, updateUserDetails, deleteUserDetails, getUserJobTitles, updateProfileDetails, sendMailToEmployee } = require('../controllers/common')
const { getOwnTodaysTimeSheet, getAllTimeSheets, clockInFunc, clockOutFunc, verifyQRCode, getTimesheetReport, downloadTimesheetReport } = require('../controllers/timeSheet')
const { leaveRequest, getAllOwnLeaves, getAllLeaveRequest, updateLeaveRequest, deleteLeaveRequest, approveLeaveRequest, rejectLeaveRequest, getAllowLeaveCount, getLeaveRequest } = require('../controllers/leaveManagement')
const { getNotifications, getUnreadNotificationsCount, readNotification, getNotification } = require('../controllers/notification')
const { saveTemplateWithSignature, previewTemplate } = require('../controllers/templates')
const { dashboard } = require('../controllers/dashboard')
const { createTask, updateTask, deleteTask, getTask, getAllTasks } = require('../controllers/task')
const { assignTask, getAssignedTask, getAllAssignedTasks, updateAssignedTask, completeAssignedTask, cancelAssignedTask, deleteAssignedTask } = require('../controllers/taskSchedule')
const { getAllLoggedInOutUsers } = require('../controllers/loggedInUser')
const { generateContractForEmployee } = require('../controllers/contract')

const commonRoute = Router()

commonRoute.post('/login', login)
commonRoute.post('/logOut', logOut)
commonRoute.post('/updatePassword', updatePassword)
commonRoute.post('/emailVerification', emailVerification)
commonRoute.post('/otpVerification', otpVerification)
commonRoute.post('/forgotPassword', forgotPassword)
// Dashboard
commonRoute.post('/dashboard', auth, dashboard)
// get user job title
commonRoute.get('/getUserJobTitles', auth, getUserJobTitles)
// user
commonRoute.post('/addUser', auth, addUser)
commonRoute.get('/getUser/:id', auth, getUser)
commonRoute.get('/getAllUsers', auth, getAllUsers)
commonRoute.post('/updateUser/:id', auth, updateUserDetails)
commonRoute.post('/deleteUser/:id', auth, deleteUserDetails)
// get logged In/out users
commonRoute.get('/getAllLoggedInOutUsers', auth, getAllLoggedInOutUsers)
// get own timesheet
commonRoute.post('/getOwnTodaysTimesheet', auth, getOwnTodaysTimeSheet)
commonRoute.post('/getAllTimesheets', auth, getAllTimeSheets)
// clock in/out
commonRoute.post('/clockIn', auth, clockInFunc)
commonRoute.post('/clockOut', auth, clockOutFunc)

// get own details
commonRoute.get('/getDetails', auth, getDetails)
commonRoute.post('/updateProfileDetails', auth, updateProfileDetails)
commonRoute.post('/sendMailToEmployee', auth, sendMailToEmployee)
// notification
commonRoute.get('/getNotifications', auth, getNotifications)
commonRoute.get('/getUnreadNotificationsCount', auth, getUnreadNotificationsCount)
commonRoute.get('/getNotification/:id', auth, getNotification)
commonRoute.get('/readNotification/:id', auth, readNotification)
// QR code scanning
// commonRoute.post('/verifyQRCode', auth, verifyQRCode)
// leave request
commonRoute.post('/leaveRequest', auth, leaveRequest)
commonRoute.get('/getLeaveRequest/:id', auth, getLeaveRequest)
commonRoute.post('/getAllOwnLeaves', auth, getAllOwnLeaves)
commonRoute.get('/getAllLeaveRequest', auth, getAllLeaveRequest)
commonRoute.post('/updateLeaveRequest/:id', auth, updateLeaveRequest)
commonRoute.post('/deleteLeaveRequest/:id', auth, deleteLeaveRequest)
commonRoute.post('/leaveRequestApprove/:id', auth, approveLeaveRequest)
commonRoute.post('/leaveRequestReject/:id', auth, rejectLeaveRequest)
commonRoute.post('/getAllowLeaveCount', auth, getAllowLeaveCount)
// timesheet report
commonRoute.post('/getTimesheetReport', auth, getTimesheetReport)
commonRoute.post('/downloadTimesheetReport', auth, downloadTimesheetReport)
// generate template
commonRoute.post('/previewTemplate', auth, previewTemplate)
commonRoute.post('/signedTemplate', auth, saveTemplateWithSignature)
// task
commonRoute.post('/createTask', auth, createTask)
commonRoute.get('/getTask/:id', auth, getTask)
commonRoute.get('/getAllTasks', auth, getAllTasks)
commonRoute.post('/updateTask/:id', auth, updateTask)
commonRoute.post('/deleteTask/:id', auth, deleteTask)
// assign task
commonRoute.post('/assignTask', auth, assignTask)
commonRoute.get('/getAssignedTask/:id', auth, getAssignedTask)
commonRoute.get('/getAllAssignedTasks', auth, getAllAssignedTasks)
commonRoute.post('/updateAssignedTask/:id', auth, updateAssignedTask)
commonRoute.post('/completeAssignedTask/:id', auth, completeAssignedTask)
commonRoute.post('/cancelAssignedTask/:id', auth, cancelAssignedTask)
commonRoute.post('/deleteAssignedTask/:id', auth, deleteAssignedTask)


commonRoute.post('/generateContractForEmployee', generateContractForEmployee)

module.exports = commonRoute
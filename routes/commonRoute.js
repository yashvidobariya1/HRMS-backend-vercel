const Router = require("express");
const { auth } = require("../middleware/authenticate");
const {
  login,
  logOut,
  updatePassword,
  emailVerification,
  otpVerification,
  forgotPassword,
  getDetails,
  addUser,
  getUser,
  getAllUsers,
  updateUserDetails,
  deleteUserDetails,
  getUserJobTitles,
  updateProfileDetails,
  sendMailToEmployee,
  getUsers,
} = require("../controllers/common");
const {
  getOwnTodaysTimeSheet,
  getAllTimeSheets,
  clockInFunc,
  clockOutFunc,
  verifyQRCode,
  getTimesheetReport,
  downloadTimesheetReport,
  clockInForEmployee,
  clockOutForEmployee,
  getAbsenceReport,
  getUsersAssignClients,
  addTimesheetEntry,
  getTimesheetEntryData,
  updateTimesheetEntry,
  deleteTimesheetEntry,
  getUsersAssignLocations,
} = require("../controllers/timeSheet");
const {
  leaveRequest,
  getAllOwnLeaves,
  getAllLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  getAllowLeaveCount,
  getLeaveRequest,
} = require("../controllers/leaveManagement");
const {
  getNotifications,
  getUnreadNotificationsCount,
  readNotification,
  getNotification,
} = require("../controllers/notification");
const {
  saveTemplateWithSignature,
  previewTemplate,
  readTemplate,
  getAllUsersTemplates,
  uploadSignedTemplate,
  deleteSignedTemplateOfUser,
} = require("../controllers/templates");
const { dashboard, getTodaysAbsentUsers } = require("../controllers/dashboard");
const {
  createTask,
  updateTask,
  getTask,
  getAllTasks,
  canceledTask,
  getAllUsersWithJobRoles,
} = require("../controllers/task");
const { getAllLoggedInOutUsers } = require("../controllers/loggedInUser");
// const { getTimesheetReportForClient } = require('../controllers/client')

const commonRoute = Router();

commonRoute.post("/login", login);
commonRoute.post("/logOut", logOut);
commonRoute.post("/updatePassword", updatePassword);
commonRoute.post("/emailVerification", emailVerification);
commonRoute.post("/otpVerification", otpVerification);
commonRoute.post("/forgotPassword", forgotPassword);
// Dashboard
commonRoute.post("/dashboard", auth, dashboard);
commonRoute.get("/getTodaysAbsentUsers", auth, getTodaysAbsentUsers);
// get user job title
commonRoute.get("/getUserJobTitles", auth, getUserJobTitles);
commonRoute.get("/getAllUsersWithJobRoles", auth, getAllUsersWithJobRoles);
// user
commonRoute.post("/addUser", auth, addUser);
commonRoute.get("/getUser/:id", auth, getUser);
commonRoute.get("/getUsers", auth, getUsers);
commonRoute.get("/getAllUsers", auth, getAllUsers);
commonRoute.post("/updateUser/:id", auth, updateUserDetails);
commonRoute.post("/deleteUser/:id", auth, deleteUserDetails);
// fetch user's clients and location
commonRoute.post("/getUsersAssignClients", auth, getUsersAssignClients);
commonRoute.post("/getUsersAssignLocations", auth, getUsersAssignLocations);
// get logged In/out users
commonRoute.get("/getAllLoggedInOutUsers", auth, getAllLoggedInOutUsers);
// get own timesheet
commonRoute.post("/getOwnTodaysTimesheet", auth, getOwnTodaysTimeSheet);
commonRoute.post("/getAllTimesheets", auth, getAllTimeSheets);
// clock in/out
commonRoute.post("/clockIn", auth, clockInFunc);
commonRoute.post("/clockOut", auth, clockOutFunc);
// clock in/out for employee
commonRoute.post("/clockInForEmployee", auth, clockInForEmployee);
commonRoute.post("/clockOutForEmployee", auth, clockOutForEmployee);
commonRoute.post("/addTimesheetEntry", auth, addTimesheetEntry);
commonRoute.get("/getTimesheetEntryData", auth, getTimesheetEntryData);
commonRoute.post("/updateTimesheetEntry", auth, updateTimesheetEntry);
commonRoute.post("/deleteTimesheetEntry", auth, deleteTimesheetEntry);

// get own details
commonRoute.get("/getDetails", auth, getDetails);
commonRoute.post("/updateProfileDetails", auth, updateProfileDetails);
commonRoute.post("/sendMailToEmployee", auth, sendMailToEmployee);
// notification
commonRoute.get("/getNotifications", auth, getNotifications);
commonRoute.get(
  "/getUnreadNotificationsCount",
  auth,
  getUnreadNotificationsCount
);
commonRoute.get("/getNotification/:id", auth, getNotification);
commonRoute.get("/readNotification/:id", auth, readNotification);
// QR code scanning
// commonRoute.post('/verifyQRCode', auth, verifyQRCode)
// leave request
commonRoute.post("/leaveRequest", auth, leaveRequest);
commonRoute.get("/getLeaveRequest/:id", auth, getLeaveRequest);
commonRoute.post("/getAllOwnLeaves", auth, getAllOwnLeaves);
commonRoute.get("/getAllLeaveRequest", auth, getAllLeaveRequest);
commonRoute.post("/updateLeaveRequest/:id", auth, updateLeaveRequest);
commonRoute.post("/deleteLeaveRequest/:id", auth, deleteLeaveRequest);
commonRoute.post("/leaveRequestApprove/:id", auth, approveLeaveRequest);
commonRoute.post("/leaveRequestReject/:id", auth, rejectLeaveRequest);
commonRoute.post("/getAllowLeaveCount", auth, getAllowLeaveCount);
// timesheet report
commonRoute.post("/getTimesheetReport", auth, getTimesheetReport);
// commonRoute.post('/getTimesheetReportForClient', getTimesheetReportForClient)
commonRoute.post("/getAbsenceReport", auth, getAbsenceReport);
commonRoute.post("/downloadTimesheetReport", auth, downloadTimesheetReport);
// generate template
commonRoute.post("/previewTemplate", auth, previewTemplate);
commonRoute.post("/signedTemplate", auth, saveTemplateWithSignature);
commonRoute.post("/readTemplate", auth, readTemplate);
// task
commonRoute.post("/createTask", auth, createTask);
commonRoute.get("/getTask/:id", auth, getTask);
commonRoute.post("/getAllTasks", auth, getAllTasks);
commonRoute.post("/updateTask/:id", auth, updateTask);
commonRoute.post("/cancelTask/:id", auth, canceledTask);
commonRoute.post("/getAllUsersTemplates", auth, getAllUsersTemplates);
commonRoute.post("/uploadSignedTemplate", auth, uploadSignedTemplate);
commonRoute.post(
  "/deleteSignedTemplateOfUser",
  auth,
  deleteSignedTemplateOfUser
);

module.exports = commonRoute;

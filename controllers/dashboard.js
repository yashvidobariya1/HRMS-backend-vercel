const Client = require("../models/client")
const Company = require("../models/company")
const Contract = require("../models/contract")
const Holiday = require("../models/holiday")
const Leave = require("../models/leaveRequest")
const Location = require("../models/location")
const Template = require("../models/template")
const Timesheet = require('../models/timeSheet')
const User = require("../models/user")
const moment = require('moment')

exports.isTemplateSigned = async (req, res) => {
    try {
        
    } catch (error) {
        console.error('Error while checking if the template is signed')
    }
}

// find Absences users for Superadmin, Administrator and Manager
const findAbsentUsers = async (requestedUser) => {
    const todayDate = moment().format("YYYY-MM-DD")

    let matchStage = { isActive: true, isDeleted: { $ne: true } }

    if(requestedUser.role === "Superadmin"){
        matchStage.role = { $in: ['Administrator', 'Manager', 'Employee'] }
    } else if(requestedUser.role === "Administrator"){
        matchStage.role = { $in: ['Manager', 'Employee'] }
        matchStage.companyId = requestedUser.companyId
        matchStage.locationId = { $in: requestedUser.locationId }
    } else if(requestedUser.role === "Manager"){
        matchStage.role = "Employee"
        matchStage["jobDetails.assignManager"] = requestedUser._id
    }

    const absentUsers = await User.aggregate([
        { $match: matchStage },
        {
            $lookup: {
                from: "Timesheet",
                localField: "_id",
                foreignField: "userId",
                as: "Timesheet"
            }
        },
        { $match: { "Timesheet.date": { $ne: todayDate } } },
        {
            $project: {
                _id: 1,
                name: {
                    $cond: {
                        if: { $ne: ["$personalDetails.lastName", ""] },
                        then: { $concat: ["$personalDetails.firstName", " ", "$personalDetails.lastName"] },
                        else: "$personalDetails.firstName"
                    }
                },
                role: 1
            }
        }
    ])

    // console.log("Absent Users:", absentUsers)
    return absentUsers
}

// const userGrowth = async (req, res) => {
//     try {
        

//         res.json({ success: true, data: userGrowth });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// }

const userGrowth = async () => {
    const gorwth = await User.aggregate([
        {
            $group: {
                _id: { $month: "$createdAt" }, // Group by month
                totalUsers: { $sum: 1 } // Count users per month
            }
        },
        { $sort: { _id: 1 } }, // Sort by month
        {
            $project: {
                _id: 0,
                month: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$_id", 1] }, then: "Jan" },
                            { case: { $eq: ["$_id", 2] }, then: "Feb" },
                            { case: { $eq: ["$_id", 3] }, then: "Mar" },
                            { case: { $eq: ["$_id", 4] }, then: "Apr" },
                            { case: { $eq: ["$_id", 5] }, then: "May" },
                            { case: { $eq: ["$_id", 6] }, then: "Jun" },
                            { case: { $eq: ["$_id", 7] }, then: "Jul" },
                            { case: { $eq: ["$_id", 8] }, then: "Aug" },
                            { case: { $eq: ["$_id", 9] }, then: "Sep" },
                            { case: { $eq: ["$_id", 10] }, then: "Oct" },
                            { case: { $eq: ["$_id", 11] }, then: "Nov" },
                            { case: { $eq: ["$_id", 12] }, then: "Dec" }
                        ],
                        default: "Unknown"
                    }
                },
                totalUsers: 1
            }
        }
    ]);
    return gorwth
}
// const gorwth = await userGrowth()
// console.log('userGrowth:', gorwth)

exports.dashboard = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const currentDate = moment()
            const currentYear = currentDate.year()
            const currentMonth = currentDate.month()

            const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1
            const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear

            const previousMonthStart = moment([previousYear, previousMonth, 1])
            const previousMonthEnd = moment([previousYear, previousMonth + 1, 1])

            const currentMonthStart = moment().startOf('month').toDate()
            const currentMonthEnd = moment().endOf('month').toDate()

            const calculatePercentageGrowth = (current, previous) => {
                if (previous === 0) return current > 0 ? 100 : 0
                return ((current - previous) / previous) * 100
            }

            const absentUsers = await findAbsentUsers(req.user)

            let responseData = {}

            if(req.user.role === 'Superadmin'){
                const adminUsers = await User.find({ role: "Administrator", isDeleted: { $ne: true } }).select("_id")
                const adminUserIds = adminUsers.map(user => user._id)

                const [
                    totalCompanies, previousMonthTotalCompanies, currentMonthTotalCompanies,
                    totalClients, previousMonthTotalClients, currentMonthTotalClients,
                    totalContracts, previousMonthTotalContracts, currentMonthTotalContracts,
                    totalLocations, previousMonthTotalLocations, currentMonthTotalLocations,
                    totalTemplates, previousMonthTotalTemplates, currentMonthTotalTemplates,
                    totalEmployees, previousMonthTotalEmployees, currentMonthTotalEmployees,
                    totalActiveUsers, previousMonthTotalActiveUsers, currentMonthTotalActiveUsers,
                    totalLeaveRequests, previousMonthTotalLeaveRequests, currentMonthTotalLeaveRequests,
                    totalPendingLR, previousMonthTotalPendingLR, currentMonthTotalPendingLR,
                ] = await Promise.all([
                    Company.countDocuments({ isDeleted: { $ne: true } }),
                    Company.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Company.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Client.countDocuments({ isDeleted: { $ne: true } }),
                    Client.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Client.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Contract.countDocuments({ isDeleted: { $ne: true } }),
                    Contract.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Contract.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Location.countDocuments({ isDeleted: { $ne: true } }),
                    Location.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Location.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Template.countDocuments({ isDeleted: { $ne: true } }),
                    Template.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Template.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isActive: true, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isActive: true, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isActive: true, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: adminUserIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: adminUserIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: adminUserIds }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: adminUserIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: adminUserIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: adminUserIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    totalCompanies,
                    companyGrowth: calculatePercentageGrowth(currentMonthTotalCompanies, previousMonthTotalCompanies),

                    totalClients,
                    clientGrowth: calculatePercentageGrowth(currentMonthTotalClients, previousMonthTotalClients),

                    totalContracts,
                    contractGrowth: calculatePercentageGrowth(currentMonthTotalContracts, previousMonthTotalContracts),

                    totalLocations,
                    locationGrowth: calculatePercentageGrowth(currentMonthTotalLocations, previousMonthTotalLocations),

                    totalTemplates,
                    templateGrowth: calculatePercentageGrowth(currentMonthTotalTemplates, previousMonthTotalTemplates),

                    totalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalActiveUsers,
                    activeUsersGrowth: calculatePercentageGrowth(currentMonthTotalActiveUsers, previousMonthTotalActiveUsers),

                    totalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),

                    totalPendingLR,
                    pendingLRGrowth: calculatePercentageGrowth(currentMonthTotalPendingLR, previousMonthTotalPendingLR),

                    absentUsers,
                }
            } else if(req.user.role === 'Administrator'){

                const managerUsers = await User.find({ role: "Manager", isDeleted: { $ne: true } }).select("_id")
                const managerUsersIds = managerUsers.map(user => user._id)

                const [
                    totalEmployees, previousMonthTotalEmployees, currentMonthTotalEmployees,
                    totalClients, previousMonthTotalClients, currentMonthTotalClients,
                    totalActiveUsers, previousMonthTotalActiveUsers, currentMonthTotalActiveUsers,
                    totalLeaveRequests, previousMonthTotalLeaveRequests, currentMonthTotalLeaveRequests,
                    totalPendingLR, previousMonthTotalPendingLR, currentMonthTotalPendingLR,
                    totalHolidays, previousMonthTotalHolidays, currentMonthTotalHolidays,
                ] = await Promise.all([
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Client.countDocuments({ companyId: req.user.companyId, isDeleted: { $ne: true } }),
                    Client.countDocuments({ companyId: req.user.companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Client.countDocuments({ companyId: req.user.companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isActive: true, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isActive: true, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isActive: true, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    totalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalClients,
                    clientGrowth: calculatePercentageGrowth(currentMonthTotalClients, previousMonthTotalClients),

                    totalActiveUsers,
                    activeUsersGrowth: calculatePercentageGrowth(currentMonthTotalActiveUsers, previousMonthTotalActiveUsers),

                    totalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),

                    totalPendingLR,
                    pendingLRGrowth: calculatePercentageGrowth(currentMonthTotalPendingLR, previousMonthTotalPendingLR),

                    totalHolidays,
                    holidayGrowth: calculatePercentageGrowth(currentMonthTotalHolidays, previousMonthTotalHolidays),

                    absentUsers,
                }
            } else if(req.user.role === 'Manager'){

                const { jobId } = req.body

                const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } })
                if(!existUser){
                    return res.send({ status: 404, message: 'User not found' })
                }

                const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
                const isTemplateSigned = jobDetail?.isTemplateSigned

                const managerEmployees = await User.find({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true } }).select("_id")
                const managerEmployeeIds = managerEmployees.map(user => user._id)

                const [
                    totalEmployees, previousMonthTotalEmployees, currentMonthTotalEmployees,
                    totalActiveUsers, previousMonthTotalActiveUsers, currentMonthTotalActiveUsers,
                    totalLeaveRequests, previousMonthTotalLeaveRequests, currentMonthTotalLeaveRequests,
                    totalPendingLR, previousMonthTotalPendingLR, currentMonthTotalPendingLR,
                    totalHolidays, previousMonthTotalHolidays, currentMonthTotalHolidays,
                ] = await Promise.all([
                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    totalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalActiveUsers,
                    activeUsersGrowth: calculatePercentageGrowth(currentMonthTotalActiveUsers, previousMonthTotalActiveUsers),

                    totalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),

                    totalPendingLR,
                    pendingLRGrowth: calculatePercentageGrowth(currentMonthTotalPendingLR, previousMonthTotalPendingLR),

                    totalHolidays,
                    holidayGrowth: calculatePercentageGrowth(currentMonthTotalHolidays, previousMonthTotalHolidays),

                    absentUsers,
                }
            } else if(req.user.role === 'Employee'){

                const { jobId } = req.body

                const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } })
                if(!existUser){
                    return res.send({ status: 404, message: 'User not found' })
                }

                const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
                const isTemplateSigned = jobDetail?.isTemplateSigned

                const [
                    totalLeaveRequests, previousMonthTotalLeaveRequests, currentMonthTotalLeaveRequests,
                    totalHolidays, previousMonthTotalHolidays, currentMonthTotalHolidays,
                ] = await Promise.all([
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    isTemplateSigned,

                    totalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),
                    
                    totalHolidays,
                    holidayGrowth: calculatePercentageGrowth(currentMonthTotalHolidays, previousMonthTotalHolidays),
                }
            }
            return res.send({ status: 200, responseData})
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while requesting dashboard:', error)
        res.send({ message: 'Error occurred while fetching dashboard data!' })
    }
}

// exports.dashboard = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user.role)){
//             if(req.user.role === 'Superadmin'){
//                 const totalCompanies = await Company.find({ isDeleted: { $ne: true } }).countDocuments()

//                 const totalClients = await Client.find({ isDeleted: { $ne: true } }).countDocuments()

//                 const totalContracts = await Contract.find({ isDeleted: { $ne: true } }).countDocuments()

//                 const totalLocations = await Location.find({ isDeleted: { $ne: true } }).countDocuments()

//                 const totalTemplates = await Template.find({ isDeleted: { $ne: true } }).countDocuments()

//                 const totalEmployees = await User.find({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isDeleted: { $ne: true } }).countDocuments()

//                 const totalActiveUsers = await User.find({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isActive: { $ne: false }, isDeleted: { $ne: true } }).countDocuments()
                
//                 const adminUsers = await User.find({ role: "Administrator", isDeleted: { $ne: true } }).select("_id")
//                 const adminUserIds = adminUsers.map(user => user._id)
//                 const totalLeaveRequests = await Leave.find({ userId: { $in: adminUserIds }, isDeleted: { $ne: true } }).countDocuments()
//                 const pendingLeaveRequests = await Leave.find({ userId: { $in: adminUserIds }, status: 'Pending', isDeleted: { $ne: true } }).countDocuments()

//                 return res.send({
//                     status: 200,
//                     totalCompanies,
//                     totalClients,
//                     totalContracts,
//                     totalLocations,
//                     totalTemplates,
//                     totalEmployees,
//                     totalActiveUsers,
//                     totalLeaveRequests,
//                     pendingLeaveRequests
//                 })
//             } else if(req.user.role === 'Administartor'){
//                 const totalEmployees = await User.find({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, isDeleted: { $ne: true } }).countDocuments()
//                 const totalClients = await Client.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()
//                 const totalActiveUsers = await User.find({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, isActive: { $ne: false }, isDeleted: { $ne: true } }).countDocuments()

//                 const managerUsers = await User.find({ role: "Manager", isDeleted: { $ne: true } }).select("_id")
//                 const managerUsersIds = managerUsers.map(user => user._id)
//                 const totalLeaveRequests = await Leave.find({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true } }).countDocuments()
//                 const pendingLeaveRequests = await Leave.find({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true } }).countDocuments()

//                 const totalHolidays = await Holiday.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()

//                 return res.send({
//                     status: 200,
//                     totalEmployees,
//                     totalClients,
//                     totalActiveUsers,
//                     totalLeaveRequests,
//                     pendingLeaveRequests,
//                     totalHolidays
//                 })
//             } else if(req.user.role === 'Manager'){
//                 const totalEmployees = await User.find({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, isDeleted: { $ne: true } }).countDocuments()

//                 const totalActiveUsers = await User.find({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true } }).countDocuments()

//                 const managerEmployees = await User.find({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true } }).select("_id")
//                 const managerEmployeeIds = managerEmployees.map(user => user._id)
//                 const totalLeaveRequests = await Leave.find({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true } }).countDocuments()
//                 const pendingLeaveRequests = await Leave.find({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true } }).countDocuments()

//                 const totalHolidays = await Holiday.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()

//                 return res.send({
//                     status: 200,
//                     totalEmployees,
//                     totalActiveUsers,
//                     totalLeaveRequests,
//                     pendingLeaveRequests,
//                     totalHolidays
//                 })

//                 // const currentDate = new Date();
//                 // const currentYear = currentDate.getFullYear();
//                 // const currentMonth = currentDate.getMonth(); // 0 = January, 11 = December

//                 // // Get previous month details
//                 // const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
//                 // const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

//                 // // Date range for current month
//                 // const currentMonthStart = new Date(currentYear, currentMonth, 1);
//                 // const currentMonthEnd = new Date(currentYear, currentMonth + 1, 1);

//                 // // Date range for previous month
//                 // const previousMonthStart = new Date(previousYear, previousMonth, 1);
//                 // const previousMonthEnd = new Date(previousYear, previousMonth + 1, 1);

//                 // // Helper function to calculate percentage change
//                 // const calculatePercentageChange = (current, previous) => {
//                 //     if (previous === 0) return current > 0 ? 100 : 0; // Avoid division by zero
//                 //     return ((current - previous) / previous) * 100;
//                 // };

//                 // // Get current and previous month's total employees
//                 // const totalEmployees = await User.countDocuments({
//                 //     role: 'Employee',
//                 //     companyId: req.user.companyId,
//                 //     locationId: { $elemMatch: { $in: req.user.locationId } },
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
//                 // });

//                 // const previousMonthEmployees = await User.countDocuments({
//                 //     role: 'Employee',
//                 //     companyId: req.user.companyId,
//                 //     locationId: { $elemMatch: { $in: req.user.locationId } },
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
//                 // });

//                 // // Get current and previous month's active users
//                 // const totalActiveUsers = await User.countDocuments({
//                 //     role: 'Employee',
//                 //     companyId: req.user.companyId,
//                 //     locationId: { $elemMatch: { $in: req.user.locationId } },
//                 //     jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
//                 //     isActive: { $ne: false },
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
//                 // });

//                 // const previousMonthActiveUsers = await User.countDocuments({
//                 //     role: 'Employee',
//                 //     companyId: req.user.companyId,
//                 //     locationId: { $elemMatch: { $in: req.user.locationId } },
//                 //     jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
//                 //     isActive: { $ne: false },
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
//                 // });

//                 // // Get current and previous month's leave requests
//                 // const managerEmployees = await User.find({
//                 //     role: 'Employee',
//                 //     companyId: req.user.companyId,
//                 //     locationId: { $elemMatch: { $in: req.user.locationId } },
//                 //     jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
//                 //     isDeleted: { $ne: true }
//                 // }).select("_id");

//                 // const managerEmployeeIds = managerEmployees.map(user => user._id);

//                 // const totalLeaveRequests = await Leave.countDocuments({
//                 //     userId: { $in: managerEmployeeIds },
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
//                 // });

//                 // const previousMonthLeaveRequests = await Leave.countDocuments({
//                 //     userId: { $in: managerEmployeeIds },
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
//                 // });

//                 // // Get current and previous month's pending leave requests
//                 // const pendingLeaveRequests = await Leave.countDocuments({
//                 //     userId: { $in: managerEmployeeIds },
//                 //     status: 'Pending',
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
//                 // });

//                 // const previousMonthPendingLeaveRequests = await Leave.countDocuments({
//                 //     userId: { $in: managerEmployeeIds },
//                 //     status: 'Pending',
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
//                 // });

//                 // // Get current and previous month's holidays
//                 // const totalHolidays = await Holiday.countDocuments({
//                 //     companyId: req.user.companyId,
//                 //     locationId: { $in: req.user.locationId },
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
//                 // });

//                 // const previousMonthHolidays = await Holiday.countDocuments({
//                 //     companyId: req.user.companyId,
//                 //     locationId: { $in: req.user.locationId },
//                 //     isDeleted: { $ne: true },
//                 //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
//                 // });

//                 // // Calculate percentage changes
//                 // const employeeChange = calculatePercentageChange(totalEmployees, previousMonthEmployees);
//                 // const activeUsersChange = calculatePercentageChange(totalActiveUsers, previousMonthActiveUsers);
//                 // const leaveRequestsChange = calculatePercentageChange(totalLeaveRequests, previousMonthLeaveRequests);
//                 // const pendingLeaveRequestsChange = calculatePercentageChange(pendingLeaveRequests, previousMonthPendingLeaveRequests);
//                 // const holidaysChange = calculatePercentageChange(totalHolidays, previousMonthHolidays);

//                 // return res.send({
//                 //     status: 200,
//                 //     totalEmployees,
//                 //     employeeChange, // % increase/decrease from last month

//                 //     totalActiveUsers,
//                 //     activeUsersChange, // % increase/decrease from last month

//                 //     totalLeaveRequests,
//                 //     leaveRequestsChange, // % increase/decrease from last month

//                 //     pendingLeaveRequests,
//                 //     pendingLeaveRequestsChange, // % increase/decrease from last month

//                 //     totalHolidays,
//                 //     holidaysChange // % increase/decrease from last month
//                 // });
//             } else if(req.user.role === 'Employee'){
//                 const totalLeaveRequests = await Leave.find({ userId: { $in: req.user._id }, isDeleted: { $ne: true } }).countDocuments()
//                 const totalHolidays = await Holiday.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()

//                 return res.send({
//                     status: 200,
//                     totalLeaveRequests,
//                     totalHolidays
//                 })
//             }
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while requesting dashboard:', error)
//         res.send({ message: 'Error occurred while fetching dashboard data!' })
//     }
// }
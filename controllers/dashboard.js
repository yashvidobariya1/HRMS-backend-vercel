const Client = require("../models/client")
const Company = require("../models/company")
const Contract = require("../models/contract")
const Holiday = require("../models/holiday")
const Leave = require("../models/leaveRequest")
const Location = require("../models/location")
const Template = require("../models/template")
const Timesheet = require('../models/timeSheet')
const User = require("../models/user")
const mongoose = require('mongoose')
const moment = require('moment')
const Notification = require("../models/notification")

// find Absences users for Superadmin, Administrator and Manager
const findAbsentUsers = async (requestedUser) => {
    try {
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

        // console.log("absentUsers:", absentUsers)
        return absentUsers
    } catch (error) {
        console.error('Error occurred while fetching count of absent users:', error)
    }
}

// find user growth for superadmin, administrator and manger
const user_Growth = async ({ role, companyId = null, locationId = null, userId = null }) => {
    try {
        let matchCondition = {
            isDeleted: { $ne: true }
        };

        if (role === "Superadmin") {
            matchCondition.role = { $ne: "Superadmin" };
        } else if (role === "Administrator") {
            matchCondition.role = { $nin: ["Superadmin", "Administrator"] };
            matchCondition.companyId = companyId;
            matchCondition.locationId = { $elemMatch: { $in: locationId } };
        } else if (role === "Manager") {
            matchCondition.role = "Employee";
            matchCondition.companyId = companyId;
            matchCondition.locationId = { $elemMatch: { $in: locationId } };
            matchCondition["jobDetails.assignManager"] = userId;
        } else {
            throw new Error("Invalid role provided");
        }

        const growth = await User.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    totalUsers: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: {
                        $let: {
                            vars: { months: ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] },
                            in: { $arrayElemAt: ["$$months", "$_id.month"] }
                        }
                    },
                    totalUsers: 1
                }
            }
        ]);

        return growth;
    } catch (error) {
        console.error("Error occurred while fetching user growth:", error);
    }
}

// find total of available leave for administartor, manager and employee
const getAvailableLeaves = async (userId, jobId) => {
    try {
        const result = await User.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(String(userId)) } },
            { 
                $project: {
                    jobDetails: {
                        $filter: {
                            input: "$jobDetails",
                            as: "job",
                            cond: { $eq: ["$$job._id", new mongoose.Types.ObjectId(String(jobId))] }
                        }
                    }
                }
            },
            { $unwind: "$jobDetails" },
            {
                $lookup: {
                    from: "leaves",
                    let: { userId: userId, jobId: new mongoose.Types.ObjectId(String(jobId)) },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$userId", "$$userId"] } } },
                        { $match: { $expr: { $eq: ["$jobId", "$$jobId"] } } },
                        { $match: { status: "approved" } },
                        { $unwind: "$dates" },
                        { $group: { _id: null, usedLeaveDays: { $sum: 1 } } }
                    ],
                    as: "usedLeaves"
                }
            },
            {
                $project: {
                    totalAllowedLeave: "$jobDetails.leavesAllow",
                    totalSickLeave: "$jobDetails.sickLeavesAllow",
                    usedLeaveDays: { $ifNull: [{ $arrayElemAt: ["$usedLeaves.usedLeaveDays", 0] }, 0] }
                }
            },
            {
                $project: {
                    _id: 0,
                    availableLeave: { $subtract: ["$totalAllowedLeave", "$usedLeaveDays"] },
                    totalSickLeave: 1
                }
            }
        ])
        // console.log('result:', result)  
        return result.length > 0 ? result[0] : { availableLeave: 0, totalSickLeave: 0 }
    } catch (error) {
        console.error('Error occurred while fetching count of available leaves:', error)
    }
}

// find count of absent in current month
const getAbsentCount = async (userId, jobId) => {
    try {
        const now = moment()
        const month = String(now.month() + 1).padStart(2, "0")
        const year = now.year()

        const isCurrentMonth = now.month() + 1 === parseInt(month) && now.year() === year

        const startDate = moment(`${year}-${month}-01`, "YYYY-MM-DD").startOf("day")
        const endDate = isCurrentMonth ? now.endOf("day") : moment(startDate).endOf("month")

        const totalDaysInMonth = endDate.date()

        const result = await Timesheet.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(String(userId)),
                    jobId: new mongoose.Types.ObjectId(String(jobId)),
                    date: { 
                        $gte: startDate.toISOString(),
                        $lte: endDate.toISOString() 
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    presentDates: { $addToSet: "$date" }
                }
            },
            {
                $project: {
                    _id: 0,
                    presentCount: { $size: "$presentDates" }
                }
            }
        ])

        const presentCount = result.length > 0 ? result[0].presentCount : 0
        const absentCount = totalDaysInMonth - presentCount

        // console.log('absentCount:', absentCount)
        return absentCount
    } catch (error) {
        console.error('Error occurred while fetching count of absent:', error)
    }
}

// find current month total hours and overtime
const getCurrentMonthTotalHoursAndOverTime = async (userId, jobId) => {
    try {
        const startOfMonth = moment().startOf('month').toDate()
        const endOfMonth = moment().endOf('month').toDate()

        const timesheetData = await Timesheet.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(String(userId)),
                    jobId: new mongoose.Types.ObjectId(String(jobId)),
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    date: { $first: "$date" },
                    isTimerOn: { $first: "$isTimerOn" },
                    totalHours: { $first: "$totalHours" },
                    isOverTime: { $first: "$isOverTime" },
                    overTime: { $first: "$overTime" }
                }
            },
            {
                $project: {
                    _id: 1,
                    date: 1,
                    isOverTime: 1,
                    totalHours: {
                        $let: {
                            vars: {
                                hours: { 
                                    $toInt: { 
                                        $arrayElemAt: [{ $split: ["$totalHours", "h"] }, 0] } 
                                },
                                minutes: { 
                                    $toInt: { 
                                        $arrayElemAt: [
                                            { $split: [{ $arrayElemAt: [{ $split: ["$totalHours", "h "] }, 1] }, "m"] },
                                            0
                                        ] 
                                    } 
                                }
                            },
                            in: {
                                $concat: [
                                    { $cond: { if: { $lt: ["$$hours", 10] }, then: { $concat: ["0", { $toString: "$$hours" }] }, else: { $toString: "$$hours" } } },
                                    ".",
                                    { $cond: { if: { $lt: ["$$minutes", 10] }, then: { $concat: ["0", { $toString: "$$minutes" }] }, else: { $toString: "$$minutes" } } }
                                ]
                            }
                        }
                    },
                    overTime: {
                        $let: {
                            vars: {
                                hours: { 
                                    $toInt: { 
                                        $arrayElemAt: [{ $split: ["$overTime", "h"] }, 0] } 
                                },
                                minutes: { 
                                    $toInt: { 
                                        $arrayElemAt: [
                                            { $split: [{ $arrayElemAt: [{ $split: ["$overTime", "h "] }, 1] }, "m"] },
                                            0
                                        ] 
                                    } 
                                }
                            },
                            in: {
                                $concat: [
                                    { $cond: { if: { $lt: ["$$hours", 10] }, then: { $concat: ["0", { $toString: "$$hours" }] }, else: { $toString: "$$hours" } } },
                                    ".",
                                    { $cond: { if: { $lt: ["$$minutes", 10] }, then: { $concat: ["0", { $toString: "$$minutes" }] }, else: { $toString: "$$minutes" } } }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $sort: { date: 1 }
            }
        ])

        // console.log('timesheetData:', timesheetData)
        return timesheetData
    } catch (error) {
        console.error('Error occurred while fetching timesheet data:', error)
    }
}

// find today's clocks ins/outs
const getTodaysClocking = async (userId, jobId) => {
    try {
        const startOfDay = moment().startOf('day').toDate()
        const endOfDay = moment().endOf('day').toDate()

        const TodaysClockingData = await Timesheet.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(String(userId)),
                    jobId: new mongoose.Types.ObjectId(String(jobId)),
                    createdAt: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $unwind: "$clockinTime"
            },
            {
                $project: {
                    _id: 1,
                    date: 1,
                    clockIn: "$clockinTime.clockIn",
                    clockOut: { $ifNull: ["$clockinTime.clockOut", ""] },
                    totalTiming: "$clockinTime.totalTiming",
                    isClockin: "$clockinTime.isClockin"
                }
            },
            {
                $group: {
                    _id: "$_id",
                    date: { $first: "$date" },
                    clockEntries: {
                        $push: {
                            clockIn: "$clockIn",
                            clockOut: "$clockOut",
                            totalTiming: "$totalTiming",
                            isClockin: "$isClockin"
                        }
                    }
                }
            },
            {
                $sort: { date: 1 }
            }
        ])

        // console.log('TodaysClockingData:', TodaysClockingData)
        return TodaysClockingData
    } catch (error) {
        console.error('Error occurred while fetching todays clocking data:', error)
    }
}

// find employee status
const getEmployeeStatus = async (requestedUser) => {
    try {
        const result = await User.aggregate([
            {
                $lookup: {
                    from: "contracts",
                    localField: "contractDetails.contractId",
                    foreignField: "_id",
                    as: "contractInfo"
                }
            },
            {
                $unwind: {
                    path: "$contractInfo",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    $and: [
                        { role: { $ne: "Superadmin" } },
                        ...(requestedUser.role === "Administrator"
                            ? 
                                [
                                    {
                                        companyId: requestedUser.companyId
                                    },
                                    {
                                        locationId: { $elemMatch: { $in: requestedUser.locationId } }
                                    }
                                ]
                            : []
                        )
                    ]
                }
            },
            {
                $group: {
                    _id: { $ifNull: ["$contractInfo.contractName", "No Contract"] },
                    totalUser: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    contractName: "$_id",
                    totalUser: 1
                }
            }
        ])

        return { employeeStatus: result };
    } catch (error) {
        console.error("Error fetching employee status:", error);
    }
}

// find unread notification count
const getCountOfUnreadNotification = async (userId, role) => {
    try {

        let matchStage = {
            "readBy": {
                $elemMatch: {
                    userId: new mongoose.Types.ObjectId(String(userId))
                }
            }
        }

        const unreadNotifications = await Notification.aggregate([
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            { 
                $match: {
                    ...matchStage,
                    readBy: {
                        $elemMatch: {
                            userId: new mongoose.Types.ObjectId(String(userId)),
                            isRead: false,
                        }
                    }
                }
            },
            { $count: 'unreadNotificationsCount' }
        ])

        return unreadNotifications.length > 0 ? unreadNotifications[0].unreadNotificationsCount : 0
    } catch (error) {
        console.error('Error occurred while fetching unread notification count:', error)
    }
}

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
            const unreadNotificationCount = await getCountOfUnreadNotification(req.user._id, req.user.role)

            let responseData = {}

            if(req.user.role === 'Superadmin'){
                const adminUsers = await User.find({ role: "Administrator", isDeleted: { $ne: true } }).select("_id")
                const adminUserIds = adminUsers.map(user => user._id)

                const userGrowth = await user_Growth({ role: "Superadmin" })
                const employeeStatus = await getEmployeeStatus(req.user)

                const [
                    totalCompanies, previousMonthTotalCompanies, currentMonthTotalCompanies,
                    totalClients, previousMonthTotalClients, currentMonthTotalClients,
                    totalContracts, previousMonthTotalContracts, currentMonthTotalContracts,
                    totalLocations, previousMonthTotalLocations, currentMonthTotalLocations,
                    totalTemplates, previousMonthTotalTemplates, currentMonthTotalTemplates,
                    totalEmployees, previousMonthTotalEmployees, currentMonthTotalEmployees,
                    totalActiveUsers, previousMonthTotalActiveUsers, currentMonthTotalActiveUsers,
                    totalLeaveRequests, previousMonthTotalLeaveRequests, currentMonthTotalLeaveRequests,
                    totalPendingLR, currentMonthTotalPendingLR,
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
                    Leave.countDocuments({ userId: { $in: adminUserIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    unreadNotificationCount,

                    totalCompanies,
                    currentMonthTotalCompanies,
                    companyGrowth: calculatePercentageGrowth(currentMonthTotalCompanies, previousMonthTotalCompanies),

                    totalClients,
                    currentMonthTotalClients,
                    clientGrowth: calculatePercentageGrowth(currentMonthTotalClients, previousMonthTotalClients),

                    totalContracts,
                    currentMonthTotalContracts,
                    contractGrowth: calculatePercentageGrowth(currentMonthTotalContracts, previousMonthTotalContracts),

                    totalLocations,
                    currentMonthTotalLocations,
                    locationGrowth: calculatePercentageGrowth(currentMonthTotalLocations, previousMonthTotalLocations),

                    totalTemplates,
                    currentMonthTotalTemplates,
                    templateGrowth: calculatePercentageGrowth(currentMonthTotalTemplates, previousMonthTotalTemplates),

                    totalEmployees,
                    currentMonthTotalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalActiveUsers,
                    currentMonthTotalActiveUsers,
                    activeUsersGrowth: calculatePercentageGrowth(currentMonthTotalActiveUsers, previousMonthTotalActiveUsers),

                    totalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),

                    totalPendingLR,
                    currentMonthTotalPendingLR,

                    absentUsers,
                    userGrowth,
                    employeeStatus,
                }
            } else if(req.user.role === 'Administrator'){

                const { jobId } = req.body
                const companyId = req.user.companyId
                const locationId = req.user.locationId

                const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } })
                if(!existUser){
                    return res.send({ status: 404, message: 'User not found' })
                }

                const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
                if(!jobDetail) return res.send({ status: 404, message: 'JobTitle not found' })

                const managerUsers = await User.find({ role: "Manager", companyId, locationId: { $elemMatch: { $in: locationId } }, isDeleted: { $ne: true } }).select("_id")
                const managerUsersIds = managerUsers.map(user => user._id)
                
                const userGrowth = await user_Growth({ role: "Administrator", companyId, locationId })
                const totalAvailableLeave = await getAvailableLeaves(req.user._id, jobId)
                const absentInCurrentMonth = await getAbsentCount(req.user._id, jobId)
                const totalHoursAndOverTime = await getCurrentMonthTotalHoursAndOverTime(req.user._id, jobId)
                const todaysClocking = await getTodaysClocking(req.user._id, jobId)
                const employeeStatus = await getEmployeeStatus(req.user)

                const [
                    totalEmployees, previousMonthTotalEmployees, currentMonthTotalEmployees,
                    totalClients, previousMonthTotalClients, currentMonthTotalClients,
                    totalActiveUsers, previousMonthTotalActiveUsers, currentMonthTotalActiveUsers,
                    totalLeaveRequests, previousMonthTotalLeaveRequests, currentMonthTotalLeaveRequests,
                    totalPendingLR, currentMonthTotalPendingLR,
                    totalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests, currentMonthTotalOwnLeaveRequests,
                    currentMonthTotalOwnPendingLR,
                    totalHolidays, previousMonthTotalHolidays, currentMonthTotalHolidays,
                ] = await Promise.all([
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Client.countDocuments({ companyId, isDeleted: { $ne: true } }),
                    Client.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Client.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isActive: true, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isActive: true, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isActive: true, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: req.user._id, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    unreadNotificationCount,

                    totalEmployees,
                    currentMonthTotalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalClients,
                    currentMonthTotalClients,
                    clientGrowth: calculatePercentageGrowth(currentMonthTotalClients, previousMonthTotalClients),

                    totalActiveUsers,
                    currentMonthTotalActiveUsers,
                    activeUsersGrowth: calculatePercentageGrowth(currentMonthTotalActiveUsers, previousMonthTotalActiveUsers),

                    totalLeaveRequests,
                    currentMonthTotalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),

                    totalPendingLR,
                    currentMonthTotalPendingLR,

                    totalOwnLeaveRequests,
                    currentMonthTotalOwnLeaveRequests,
                    ownLeaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests),

                    currentMonthTotalOwnPendingLR,

                    totalHolidays,
                    currentMonthTotalHolidays,
                    holidayGrowth: calculatePercentageGrowth(currentMonthTotalHolidays, previousMonthTotalHolidays),

                    absentUsers,
                    totalAvailableLeave,
                    userGrowth,
                    absentInCurrentMonth,
                    totalHoursAndOverTime,
                    todaysClocking,
                    employeeStatus,
                }
            } else if(req.user.role === 'Manager'){

                const { jobId } = req.body
                const companyId = req.user.companyId
                const locationId = req.user.locationId

                const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } })
                if(!existUser){
                    return res.send({ status: 404, message: 'User not found' })
                }

                const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
                if(!jobDetail) return res.send({ status: 404, message: 'JobTitle not found' })
                const isTemplateSigned = jobDetail?.isTemplateSigned

                const userGrowth = await user_Growth({ role: "Manager", companyId, locationId, userId: req.user._id })
                const totalAvailableLeave = await getAvailableLeaves(req.user._id, jobId)
                const absentInCurrentMonth = await getAbsentCount(req.user._id, jobId)
                const totalHoursAndOverTime = await getCurrentMonthTotalHoursAndOverTime(req.user._id, jobId)
                const todaysClocking = await getTodaysClocking(req.user._id, jobId)

                const managerEmployees = await User.find({ role: 'Employee', companyId, locationId: { $elemMatch: { $in: locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true } }).select("_id")
                const managerEmployeeIds = managerEmployees.map(user => user._id)

                const [
                    totalEmployees, previousMonthTotalEmployees, currentMonthTotalEmployees,
                    totalActiveUsers, previousMonthTotalActiveUsers, currentMonthTotalActiveUsers,
                    totalLeaveRequests, previousMonthTotalLeaveRequests, currentMonthTotalLeaveRequests,
                    totalPendingLR, previousMonthTotalPendingLR, currentMonthTotalPendingLR,
                    totalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests, currentMonthTotalOwnLeaveRequests,
                    currentMonthTotalOwnPendingLR,
                    totalHolidays, previousMonthTotalHolidays, currentMonthTotalHolidays,
                ] = await Promise.all([
                    User.countDocuments({ role: 'Employee', companyId, locationId: { $elemMatch: { $in: locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: 'Employee', companyId, locationId: { $elemMatch: { $in: locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: 'Employee', companyId, locationId: { $elemMatch: { $in: locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ role: 'Employee', companyId, locationId: { $elemMatch: { $in: locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: 'Employee', companyId, locationId: { $elemMatch: { $in: locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: 'Employee', companyId, locationId: { $elemMatch: { $in: locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: req.user._id, status: 'Pending', isDeleted: { $ne: true } }),

                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    isTemplateSigned,
                    unreadNotificationCount,
                    
                    totalEmployees,
                    currentMonthTotalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalActiveUsers,
                    currentMonthTotalActiveUsers,
                    activeUsersGrowth: calculatePercentageGrowth(currentMonthTotalActiveUsers, previousMonthTotalActiveUsers),

                    totalLeaveRequests,
                    currentMonthTotalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),

                    totalPendingLR,
                    currentMonthTotalPendingLR,
                    pendingLRGrowth: calculatePercentageGrowth(currentMonthTotalPendingLR, previousMonthTotalPendingLR),

                    totalOwnLeaveRequests,
                    currentMonthTotalOwnLeaveRequests,
                    ownLeaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests),

                    currentMonthTotalOwnPendingLR,

                    totalHolidays,
                    currentMonthTotalHolidays,
                    holidayGrowth: calculatePercentageGrowth(currentMonthTotalHolidays, previousMonthTotalHolidays),

                    absentUsers,
                    totalAvailableLeave,
                    userGrowth,
                    absentInCurrentMonth,
                    totalHoursAndOverTime,
                    todaysClocking,
                }
            } else if(req.user.role === 'Employee'){

                const { jobId } = req.body
                const companyId = req.user.companyId
                const locationId = req.user.locationId

                const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } })
                if(!existUser){
                    return res.send({ status: 404, message: 'User not found' })
                }

                const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
                if(!jobDetail) return res.send({ status: 404, message: 'JobTitle not found' })
                const isTemplateSigned = jobDetail?.isTemplateSigned

                const totalAvailableLeave = await getAvailableLeaves(req.user._id, jobId)
                const absentInCurrentMonth = await getAbsentCount(req.user._id, jobId)
                const totalHoursAndOverTime = await getCurrentMonthTotalHoursAndOverTime(req.user._id, jobId)
                const todaysClocking = await getTodaysClocking(req.user._id, jobId)

                const [
                    totalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests, currentMonthTotalOwnLeaveRequests,
                    totalOwnPendingLR, currentMonthTotalOwnPendingLR,
                    totalHolidays, previousMonthTotalHolidays, currentMonthTotalHolidays,
                ] = await Promise.all([
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: req.user._id, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: req.user._id, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId, locationId: { $in: locationId }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    isTemplateSigned,
                    unreadNotificationCount,

                    totalOwnLeaveRequests,
                    currentMonthTotalOwnLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests),

                    totalOwnPendingLR,
                    currentMonthTotalOwnPendingLR,
                    
                    totalHolidays,
                    currentMonthTotalHolidays,
                    holidayGrowth: calculatePercentageGrowth(currentMonthTotalHolidays, previousMonthTotalHolidays),

                    totalAvailableLeave,
                    absentInCurrentMonth,
                    totalHoursAndOverTime,
                    todaysClocking,
                }
            }
            return res.send({ status: 200, responseData})
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while requesting dashboard:', error)
        res.send({ message: 'Error occurred while fetching dashboard data!' })
    }
}

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
const Task = require("../models/task")
const { convertToEuropeanTimezone } = require("../utils/timezone")

// find Absences users for Superadmin, Administrator and Manager
const findAbsentUsers = async (requestedUser) => {
    try {
        const todayDate = moment().format("YYYY-MM-DD")

        let matchStage = { isDeleted: { $ne: true } }

        if(requestedUser.role === "Superadmin"){
            matchStage.role = { $in: ['Administrator', 'Manager', 'Employee'] }
        } else if(requestedUser.role === "Administrator"){
            matchStage.role = { $in: ['Manager', 'Employee'] }
            matchStage.companyId = requestedUser.companyId
            // matchStage.locationId = { $in: requestedUser.locationId }
        } else if(requestedUser.role === "Manager"){
            matchStage.role = "Employee"
            matchStage.companyId = requestedUser.companyId
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
            // matchCondition.locationId = { $elemMatch: { $in: locationId } };
        } else if (role === "Manager") {
            matchCondition.role = "Employee";
            matchCondition.companyId = companyId;
            // matchCondition.locationId = { $elemMatch: { $in: locationId } };
            // matchCondition["jobDetails.assignManager"] = userId;
        } else {
            throw new Error("Invalid role provided");
        }

        const startOfYear = moment().startOf('year').toDate()
        const endOfYear = moment().endOf('year').toDate()

        const result = await User.aggregate([
            { $match: matchCondition },
            {
                $match: {
                    createdAt: {
                        $gte: startOfYear,
                        $lte: endOfYear
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    totalUsers: { $sum: 1 }
                }
            },
        ])

        const allMonths = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ]

        const currentYear = moment().year()
        const currentMonth = moment().month()

        const growth = allMonths.slice(0, currentMonth + 1).map((monthName, index) => {
            const data = result.find(r => r._id.month === index + 1);
            return {
                year: currentYear,
                month: monthName,
                totalUsers: data ? data.totalUsers : 0
            }
        })

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
                    from: "leaverequests", // Corrected collection name
                    let: {
                        uId: new mongoose.Types.ObjectId(String(userId)),
                        jId: new mongoose.Types.ObjectId(String(jobId))
                    },
                    pipeline: [
                        {
                            $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$userId", "$$uId"] },
                                    { $eq: ["$jobId", "$$jId"] }
                                ]
                            }
                            }
                        },
                        {
                            $addFields: {
                                leaveStatus: {
                                    $cond: {
                                        if: { $eq: ["$status", "Approved"] },
                                        then: "Approved",
                                        else: "Pending"
                                    }
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalLeaveDaysUsed: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$leaveStatus", "Approved"] },
                                            "$numberOfApproveLeaves", // Approved days
                                            0 // If Pending, no leave is deducted yet
                                        ]
                                    }
                                },
                                totalLeaveHoursUsed: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$leaveStatus", "Approved"] },
                                            "$numberOfApproveLeaveHours", // Approved hours
                                            0 // If Pending, no leave is deducted yet
                                        ]
                                    }
                                },
                                totalLeaveDaysRequested: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$leaveStatus", "Pending"] },
                                            "$totalLeaveDays", // Pending days
                                            0 // If Approved, no need to add pending request
                                        ]
                                    }
                                },
                                totalLeaveHoursRequested: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$leaveStatus", "Pending"] },
                                            "$totalLeaveHours", // Pending hours
                                            0 // If Approved, no need to add pending request
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    as: "usedLeaves"
                }
            },
            {
                $project: {
                    casualLeaveType: "$jobDetails.leavesAllow.leaveType",
                    allowedCaualLeaves: "$jobDetails.leavesAllow.allowedLeavesCounts",
                    sickLeaveType: "$jobDetails.sickLeavesAllow.leaveType",
                    allowedSickLeaves: "$jobDetails.sickLeavesAllow.allowedLeavesCounts",
                    usedLeaveDays: {
                        $ifNull: [{ $arrayElemAt: ["$usedLeaves.totalLeaveDaysUsed", 0] }, 0]
                    },
                    usedLeaveHours: {
                        $ifNull: [{ $arrayElemAt: ["$usedLeaves.totalLeaveHoursUsed", 0] }, 0]
                    },
                    pendingLeaveDays: {
                        $ifNull: [{ $arrayElemAt: ["$usedLeaves.totalLeaveDaysRequested", 0] }, 0]
                    },
                    pendingLeaveHours: {
                        $ifNull: [{ $arrayElemAt: ["$usedLeaves.totalLeaveHoursRequested", 0] }, 0]
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    casualLeaveType: 1,
                    sickLeaveType: 1,
                    allowedCaualLeaves: 1,
                    allowedSickLeaves: 1,
                    usedLeaveDays: 1,
                    usedLeaveHours: 1,
                    pendingLeaveDays: 1,
                    pendingLeaveHours: 1,
                    casualAvailableLeaves: {
                        $cond: {
                            if: { $eq: ["$casualLeaveType", "Day"] },
                            then: {
                                $subtract: [
                                    { $subtract: ["$allowedCaualLeaves", "$usedLeaveDays"] },
                                    "$pendingLeaveDays"
                                ]
                            },
                            else: {
                                $subtract: [
                                    { $subtract: ["$allowedCaualLeaves", "$usedLeaveHours"] },
                                    "$pendingLeaveHours"
                                ]
                            }
                        }
                    },
                    sickAvailableLeaves: {
                        $cond: {
                            if: { $eq: ["$sickLeaveType", "Day"] },
                            then: {
                                $subtract: [
                                    { $subtract: ["$allowedSickLeaves", "$usedLeaveDays"] },
                                    "$pendingLeaveDays"
                                ]
                            },
                            else: {
                                $subtract: [
                                    { $subtract: ["$allowedSickLeaves", "$usedLeaveHours"] },
                                    "$pendingLeaveHours"
                                ]
                            }
                        }
                    }
                }
            }
        ])

        const response = {
            Casual: {
                leaveType: result[0]?.casualLeaveType,
                // allowLeaves: result[0]?.allowedCaualLeaves,
                // usedLeaves: result[0]?.casualLeaveType === "Day" ? result[0]?.usedLeaveDays : result[0]?.usedLeaveHours,
                // pendingLeaves: result[0]?.casualLeaveType === "Day" ? result[0]?.pendingLeaveDays : result[0]?.pendingLeaveHours,
                availableLeaves: result[0]?.casualAvailableLeaves
            },
            Sick: {
                leaveType: result[0]?.sickLeaveType,
                // allowLeaves: result[0]?.allowedSickLeaves,
                // usedLeaves: result[0]?.sickLeaveType === "Day" ? result[0]?.usedLeaveDays : result[0]?.usedLeaveHours,
                // pendingLeaves: result[0]?.sickLeaveType === "Day" ? result[0]?.pendingLeaveDays : result[0]?.pendingLeaveHours,
                availableLeaves: result[0]?.sickAvailableLeaves
            }
        }
         
        return response
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

        const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
        const jobDetail = existUser.jobDetails.find(job => job._id.toString() === jobId)
        const joiningDate = moment(jobDetail.joiningDate)

        if(joiningDate.isAfter(now, 'day')){
            return 0
        }

        const startOfMonth = moment(`${year}-${month}-01`, "YYYY-MM-DD").startOf("day")
        const isCurrentMonth = now.month() + 1 === parseInt(month) && now.year() === year

        const startDate = moment.max(joiningDate.startOf("day"), startOfMonth)
        const endDate = isCurrentMonth ? now.endOf("day") : moment(startOfMonth).endOf("month")

        const totalDaysInMonth = endDate.diff(startDate, 'days') + 1

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

        for(const timesheet of TodaysClockingData){
            timesheet.clockEntries = timesheet.clockEntries.map(entry => {
                const clockInStr = entry.clockIn ? convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss") : ""
                const clockOutStr = entry.clockOut ? convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""

                return {
                    ...entry.toObject?.() ?? entry,
                    clockIn: clockInStr,
                    clockOut: clockOutStr,
                }
            })
        }

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

        return result;
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
            const currentYear = moment().year()
            const currentMonth = moment().month()

            const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1
            const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear

            const previousMonthStart = moment([previousYear, previousMonth, 1])
            const previousMonthEnd = moment([previousYear, previousMonth + 1, 1])

            const currentMonthStart = moment().startOf('month').toDate()
            const currentMonthEnd = moment().endOf('month').toDate()

            const previousYearStart = moment([currentYear - 1, 0, 1]).startOf('day').toDate()  // Jan 1st of previous year
            const previousYearEnd = moment([currentYear - 1, 11, 31]).endOf('day').toDate()

            const currentYearStart = moment().startOf('year').toDate()
            const currentYearEnd = moment().endOf('year').toDate()

            const calculatePercentageGrowth = (current, previous) => {
                if (previous === 0) return current > 0 ? 100 : 0
                return ((current - previous) / previous) * 100
            }

            const absentUsers = await findAbsentUsers(req.user)
            const unreadNotificationCount = await getCountOfUnreadNotification(req.user._id, req.user.role)

            let responseData = {}

            if(req.user.role === 'Superadmin'){

                const companyId = req.query.companyId

                let companyFilter = { isDeleted: { $ne: true } }

                if (companyId && companyId !== 'allCompany') {
                    const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
                    if (!company) {
                        return res.status(404).send({ status: 404, message: 'Company not found' })
                    }

                    companyFilter.companyId = companyId
                }

                const adminUsers = await User.find({ role: "Administrator", isDeleted: { $ne: true } }).select("_id")
                const adminUserIds = adminUsers.map(user => user._id)

                const userGrowth = await user_Growth({ role: "Superadmin" })
                const employeeStatus = await getEmployeeStatus(req.user)

                const [
                    totalCompanies, previousYearTotalCompanies, currentYearTotalCompanies,
                    totalClients, previousYearTotalClients, currentYearTotalClients,
                    totalContracts, previousMonthTotalContracts, currentMonthTotalContracts,
                    totalLocations, previousMonthTotalLocations, currentMonthTotalLocations,
                    totalTemplates, previousMonthTotalTemplates, currentMonthTotalTemplates,
                    totalEmployees, previousMonthTotalEmployees, currentMonthTotalEmployees,
                    totalActiveUsers, previousMonthTotalActiveUsers, currentMonthTotalActiveUsers,
                    totalLeaveRequests, previousMonthTotalLeaveRequests, currentMonthTotalLeaveRequests,
                    totalPendingLR, currentMonthTotalPendingLR,
                ] = await Promise.all([
                    Company.countDocuments({ isDeleted: { $ne: true } }),
                    Company.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousYearStart, $lt: previousYearEnd } }),
                    Company.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: currentYearStart, $lt: currentYearEnd } }),

                    Client.countDocuments(companyFilter),
                    Client.countDocuments({ ...companyFilter, createdAt: { $gte: previousYearStart, $lt: previousYearEnd } }),
                    Client.countDocuments({ ...companyFilter, createdAt: { $gte: currentYearStart, $lt: currentYearEnd } }),

                    Contract.countDocuments(companyFilter),
                    Contract.countDocuments({ ...companyFilter, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Contract.countDocuments({ ...companyFilter, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Location.countDocuments(companyFilter),
                    Location.countDocuments({ ...companyFilter, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Location.countDocuments({ ...companyFilter, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Template.countDocuments({ isDeleted: { $ne: true } }),
                    Template.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Template.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ ...companyFilter, role: { $in: ['Administrator', 'Manager', 'Employee'] } }),
                    User.countDocuments({ ...companyFilter, role: { $in: ['Administrator', 'Manager', 'Employee'] }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ ...companyFilter, role: { $in: ['Administrator', 'Manager', 'Employee'] }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ ...companyFilter, role: { $in: ['Administrator', 'Manager', 'Employee'] } }),
                    User.countDocuments({ ...companyFilter, role: { $in: ['Administrator', 'Manager', 'Employee'] }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ ...companyFilter, role: { $in: ['Administrator', 'Manager', 'Employee'] }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ ...companyFilter, userId: { $in: adminUserIds } }),
                    Leave.countDocuments({ ...companyFilter, userId: { $in: adminUserIds }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ ...companyFilter, userId: { $in: adminUserIds }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ ...companyFilter, userId: { $in: adminUserIds }, status: 'Pending' }),
                    Leave.countDocuments({ ...companyFilter, userId: { $in: adminUserIds }, status: 'Pending', createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    unreadNotificationCount,

                    totalCompanies,
                    // previousYearTotalCompanies,
                    currentYearTotalCompanies,
                    companyGrowth: calculatePercentageGrowth(currentYearTotalCompanies, previousYearTotalCompanies),

                    totalClients,
                    // previousMonthTotalClients,
                    currentYearTotalClients,
                    clientGrowth: calculatePercentageGrowth(currentYearTotalClients, previousYearTotalClients),

                    totalContracts,
                    // previousMonthTotalContracts,
                    currentMonthTotalContracts,
                    contractGrowth: calculatePercentageGrowth(currentMonthTotalContracts, previousMonthTotalContracts),

                    totalLocations,
                    // previousMonthTotalLocations,
                    currentMonthTotalLocations,
                    locationGrowth: calculatePercentageGrowth(currentMonthTotalLocations, previousMonthTotalLocations),

                    totalTemplates,
                    // previousMonthTotalTemplates,
                    currentMonthTotalTemplates,
                    templateGrowth: calculatePercentageGrowth(currentMonthTotalTemplates, previousMonthTotalTemplates),

                    totalEmployees,
                    // previousMonthTotalEmployees,
                    currentMonthTotalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalActiveUsers,
                    // previousMonthTotalActiveUsers,
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

                const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } }).populate('templates.templateId', 'templateName')
                if(!existUser){
                    return res.send({ status: 404, message: 'User not found' })
                }

                const company = await Company.findOne({ _id: companyId.toString(), isDeleted: { $ne: true } })
                if(!company){
                    return res.send({ status: 404, message: 'Company not found' })
                }

                // const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
                // if(!jobDetail) return res.send({ status: 404, message: 'JobTitle not found' })
                // const isTemplateSigned = jobDetail?.isTemplateSigned
                const templates = existUser?.templates.filter(template => !template.isTemplateVerify ).map(template => ({
                    _id: template._id,
                    templateId: template.templateId._id,
                    templateName: template.templateId.templateName,
                    // isTemplateSignRequied: template.isTemplateSigned,
                    isTemplateVerify: template.isTemplateVerify,
                    isSignActionRequired: template.isSignActionRequired
                })).filter(template => !template.isTemplateVerify)

                const userData = {
                    EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
                    EMPLOYEE_EMAIL: `${existUser?.personalDetails?.email}`,
                    EMPLOYEE_CONTACT_NUMBER: `${existUser?.personalDetails?.phone}`,
                    COMPANY_NAME: `${company?.companyDetails?.businessName}`
                }

                const managerUsers = await User.find({ role: "Manager", companyId, locationId: { $elemMatch: { $in: locationId } }, isDeleted: { $ne: true } }).select("_id")
                const managerUsersIds = managerUsers.map(user => user._id)
                
                const userGrowth = await user_Growth({ role: "Administrator", companyId, locationId })
                const totalAvailableLeave = await getAvailableLeaves(req.user._id, jobId)
                const absentInCurrentMonth = await getAbsentCount(req.user._id, jobId)
                const totalHoursAndOverTime = await getCurrentMonthTotalHoursAndOverTime(req.user._id, jobId)
                const todaysClocking = await getTodaysClocking(req.user._id, jobId)
                const employeeStatus = await getEmployeeStatus(req.user)
                const countOfLateClockIn = await Task.find({ userId: req.user._id, jobId, isLate: true, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }).countDocuments()

                const [
                    totalEmployees, previousMonthTotalEmployees, currentMonthTotalEmployees,
                    totalClients, previousYearTotalClients, currentYearTotalClients,
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
                    Client.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousYearStart, $lt: previousYearEnd } }),
                    Client.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentYearStart, $lt: currentYearEnd } }),

                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Leave.countDocuments({ userId: req.user._id, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    templates,
                    userData,
                    countOfLateClockIn,
                    unreadNotificationCount,

                    totalEmployees,
                    // previousMonthTotalEmployees,
                    currentMonthTotalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalClients,
                    // previousYearTotalClients,
                    currentYearTotalClients,
                    clientGrowth: calculatePercentageGrowth(currentYearTotalClients, previousYearTotalClients),

                    totalActiveUsers,
                    // previousMonthTotalActiveUsers,
                    currentMonthTotalActiveUsers,
                    activeUsersGrowth: calculatePercentageGrowth(currentMonthTotalActiveUsers, previousMonthTotalActiveUsers),

                    totalLeaveRequests,
                    // previousMonthTotalLeaveRequests,
                    currentMonthTotalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),

                    totalPendingLR,
                    currentMonthTotalPendingLR,

                    totalOwnLeaveRequests,
                    // previousMonthTotalOwnLeaveRequests,
                    currentMonthTotalOwnLeaveRequests,
                    ownLeaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests),

                    currentMonthTotalOwnPendingLR,

                    totalHolidays,
                    // previousMonthTotalHolidays,
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

                const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } }).populate('templates.templateId', 'templateName')
                if(!existUser){
                    return res.send({ status: 404, message: 'User not found' })
                }

                const company = await Company.findOne({ _id: companyId.toString(), isDeleted: { $ne: true } })
                if(!company){
                    return res.send({ status: 404, message: 'Company not found' })
                }

                // const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
                // if(!jobDetail) return res.send({ status: 404, message: 'JobTitle not found' })
                // const isTemplateSigned = jobDetail?.isTemplateSigned
                const templates = existUser?.templates.filter(template => !template.isTemplateVerify ).map(template => ({
                    _id: template._id,
                    templateId: template.templateId._id,
                    templateName: template.templateId.templateName,
                    // isTemplateSignRequied: template.isTemplateSigned,
                    isTemplateVerify: template.isTemplateVerify,
                    isSignActionRequired: template.isSignActionRequired
                })).filter(template => !template.isTemplateVerify)

                const userData = {
                    EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
                    EMPLOYEE_EMAIL: `${existUser?.personalDetails?.email}`,
                    EMPLOYEE_CONTACT_NUMBER: `${existUser?.personalDetails?.phone}`,
                    COMPANY_NAME: `${company?.companyDetails?.businessName}`
                }

                const userGrowth = await user_Growth({ role: "Manager", companyId, locationId, userId: req.user._id })
                const totalAvailableLeave = await getAvailableLeaves(req.user._id, jobId)
                const absentInCurrentMonth = await getAbsentCount(req.user._id, jobId)
                const totalHoursAndOverTime = await getCurrentMonthTotalHoursAndOverTime(req.user._id, jobId)
                const todaysClocking = await getTodaysClocking(req.user._id, jobId)
                const countOfLateClockIn = await Task.find({ userId: req.user._id, jobId, isLate: true, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } })

                const managerEmployees = await User.find({ role: 'Employee', companyId, isDeleted: { $ne: true } }).select("_id")
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
                    User.countDocuments({ role: 'Employee', companyId, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: 'Employee', companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: 'Employee', companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

                    User.countDocuments({ role: 'Employee', companyId, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: 'Employee', companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    User.countDocuments({ role: 'Employee', companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),

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

                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    templates,
                    userData,
                    countOfLateClockIn,
                    unreadNotificationCount,
                    
                    totalEmployees,
                    // previousMonthTotalEmployees,
                    currentMonthTotalEmployees,
                    employeeGrowth: calculatePercentageGrowth(currentMonthTotalEmployees, previousMonthTotalEmployees),

                    totalActiveUsers,
                    // previousMonthTotalActiveUsers,
                    currentMonthTotalActiveUsers,
                    activeUsersGrowth: calculatePercentageGrowth(currentMonthTotalActiveUsers, previousMonthTotalActiveUsers),

                    totalLeaveRequests,
                    // previousMonthTotalLeaveRequests,
                    currentMonthTotalLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalLeaveRequests, previousMonthTotalLeaveRequests),

                    totalPendingLR,
                    // previousMonthTotalPendingLR,
                    currentMonthTotalPendingLR,
                    pendingLRGrowth: calculatePercentageGrowth(currentMonthTotalPendingLR, previousMonthTotalPendingLR),

                    totalOwnLeaveRequests,
                    // previousMonthTotalOwnLeaveRequests,
                    currentMonthTotalOwnLeaveRequests,
                    ownLeaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests),

                    currentMonthTotalOwnPendingLR,

                    totalHolidays,
                    // previousMonthTotalHolidays,
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

                const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } }).populate('templates.templateId', 'templateName')
                if(!existUser){
                    return res.send({ status: 404, message: 'User not found' })
                }

                const company = await Company.findOne({ _id: companyId.toString(), isDeleted: { $ne: true } })
                if(!company){
                    return res.send({ status: 404, message: 'Company not found' })
                }

                // const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
                // if(!jobDetail) return res.send({ status: 404, message: 'JobTitle not found' })
                // const isTemplateSigned = jobDetail?.isTemplateSigned
                const templates = existUser?.templates.filter(template => !template.isTemplateVerify ).map(template => ({
                    _id: template._id,
                    templateId: template.templateId._id,
                    templateName: template.templateId.templateName,
                    // isTemplateSignRequied: template.isTemplateSigned,
                    isTemplateVerify: template.isTemplateVerify,
                    isSignActionRequired: template.isSignActionRequired
                })).filter(template => !template.isTemplateVerify)

                const userData = {
                    EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
                    EMPLOYEE_EMAIL: `${existUser?.personalDetails?.email}`,
                    EMPLOYEE_CONTACT_NUMBER: `${existUser?.personalDetails?.phone}`,
                    COMPANY_NAME: `${company?.companyDetails?.businessName}`
                }

                const totalAvailableLeave = await getAvailableLeaves(req.user._id, jobId)
                const absentInCurrentMonth = await getAbsentCount(req.user._id, jobId)
                const totalHoursAndOverTime = await getCurrentMonthTotalHoursAndOverTime(req.user._id, jobId)
                const todaysClocking = await getTodaysClocking(req.user._id, jobId)
                const countOfLateClockIn = await Task.find({ userId: req.user._id, jobId, isLate: true, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } })

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

                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                    Holiday.countDocuments({ companyId, isDeleted: { $ne: true }, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }),
                ])

                responseData = {
                    templates,
                    userData,
                    countOfLateClockIn,
                    unreadNotificationCount,

                    totalOwnLeaveRequests,
                    // previousMonthTotalOwnLeaveRequests,
                    currentMonthTotalOwnLeaveRequests,
                    leaveRequestGrowth: calculatePercentageGrowth(currentMonthTotalOwnLeaveRequests, previousMonthTotalOwnLeaveRequests),

                    totalOwnPendingLR,
                    currentMonthTotalOwnPendingLR,
                    
                    totalHolidays,
                    // previousMonthTotalHolidays,
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
        return res.send({ status: 500, message: 'Error occurred while fetching dashboard data!' })
    }
}

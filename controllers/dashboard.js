const Client = require("../models/client")
const Company = require("../models/company")
const Contract = require("../models/contract")
const Holiday = require("../models/holiday")
const Leave = require("../models/leaveRequest")
const Location = require("../models/location")
const Template = require("../models/template")
const User = require("../models/user")
const moment = require('moment')


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

            const calculatePercentageGrowth = (current, previous) => {
                if (previous === 0) return current > 0 ? 100 : 0
                return ((current - previous) / previous) * 100
            }

            let responseData = {}

            if(req.user.role === 'Superadmin'){
                const adminUsers = await User.find({ role: "Administrator", isDeleted: { $ne: true } }).select("_id")
                const adminUserIds = adminUsers.map(user => user._id)

                const [
                    totalCompanies, previousTotalCompanies,
                    totalClients, previousTotalClients,
                    totalContracts, previousTotalContracts,
                    totalLocations, previousTotalLocations,
                    totalTemplates, previousTotalTemplates,
                    totalEmployees, previousTotalEmployees,
                    totalActiveUsers, previousTotalActiveUsers,
                    totalLeaveRequests, previousTotalLeaveRequests,
                    totalPendingLR, previousTotalPendingLR
                ] = await Promise.all([
                    Company.countDocuments({ isDeleted: { $ne: true } }),
                    Company.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Client.countDocuments({ isDeleted: { $ne: true } }),
                    Client.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Contract.countDocuments({ isDeleted: { $ne: true } }),
                    Contract.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Location.countDocuments({ isDeleted: { $ne: true } }),
                    Location.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Template.countDocuments({ isDeleted: { $ne: true } }),
                    Template.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isActive: true, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isActive: true, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: adminUserIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: adminUserIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: adminUserIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: adminUserIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } })
                ])

                responseData = {
                    totalCompanies,
                    // companyGrowth: calculatePercentageGrowth(totalCompanies, previousTotalCompanies),

                    totalClients,
                    // clientGrowth: calculatePercentageGrowth(totalClients, previousTotalClients),

                    totalContracts,
                    // contractGrowth: calculatePercentageGrowth(totalContracts, previousTotalContracts),

                    totalLocations,
                    // locationGrowth: calculatePercentageGrowth(totalLocations, previousTotalLocations),

                    totalTemplates,
                    // templateGrowth: calculatePercentageGrowth(totalTemplates, previousTotalTemplates),

                    totalEmployees,
                    // employeeGrowth: calculatePercentageGrowth(totalEmployees, previousTotalEmployees),

                    totalActiveUsers,
                    // activeUsersGrowth: calculatePercentageGrowth(totalActiveUsers, previousTotalActiveUsers),

                    totalLeaveRequests,
                    // leaveRequestGrowth: calculatePercentageGrowth(totalLeaveRequests, previousTotalLeaveRequests),

                    totalPendingLR,
                    // pendingLRGrowth: calculatePercentageGrowth(totalPendingLR, previousTotalPendingLR),
                }
            } else if(req.user.role === 'Administrator'){

                const managerUsers = await User.find({ role: "Manager", isDeleted: { $ne: true } }).select("_id")
                const managerUsersIds = managerUsers.map(user => user._id)

                const [
                    totalEmployees, previousTotalEmployees,
                    totalClients, previousTotalClients,
                    totalActiveUsers, previousTotalActiveUsers,
                    totalLeaveRequests, previousTotalLeaveRequests,
                    totalPendingLR, previousTotalPendingLR,
                    totalHolidays, previousTotalHolidays
                ] = await Promise.all([
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Client.countDocuments({ companyId: req.user.companyId, isDeleted: { $ne: true } }),
                    Client.countDocuments({ companyId: req.user.companyId, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isActive: true, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, isActive: true, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                ])

                responseData = {
                    totalEmployees,
                    // employeeGrowth: calculatePercentageGrowth(totalEmployees, previousTotalEmployees),

                    totalClients,
                    // clientGrowth: calculatePercentageGrowth(totalClients, previousTotalClients),

                    totalActiveUsers,
                    // activeUsersGrowth: calculatePercentageGrowth(totalActiveUsers, previousTotalActiveUsers),

                    totalLeaveRequests,
                    // leaveRequestGrowth: calculatePercentageGrowth(totalLeaveRequests, previousTotalLeaveRequests),

                    totalPendingLR,
                    // pendingLRGrowth: calculatePercentageGrowth(totalPendingLR, previousTotalPendingLR),

                    totalHolidays,
                    // holidayGrowth: calculatePercentageGrowth(totalHolidays, previousTotalHolidays),
                }
            } else if(req.user.role === 'Manager'){

                const managerEmployees = await User.find({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true } }).select("_id")
                const managerEmployeeIds = managerEmployees.map(user => user._id)

                const [
                    totalEmployees, previousTotalEmployees,
                    totalActiveUsers, previousTotalActiveUsers,
                    totalLeaveRequests, previousTotalLeaveRequests,
                    totalPendingLR, previousTotalPendingLR,
                    totalHolidays, previousTotalHolidays
                ] = await Promise.all([
                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true } }),
                    User.countDocuments({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),
                ])

                responseData = {
                    totalEmployees,
                    // employeeGrowth: calculatePercentageGrowth(totalEmployees, previousTotalEmployees),

                    totalActiveUsers,
                    // activeUsersGrowth: calculatePercentageGrowth(totalActiveUsers, previousTotalActiveUsers),

                    totalLeaveRequests,
                    // leaveRequestGrowth: calculatePercentageGrowth(totalLeaveRequests, previousTotalLeaveRequests),

                    totalPendingLR,
                    // pendingLRGrowth: calculatePercentageGrowth(totalPendingLR, previousTotalPendingLR),

                    totalHolidays,
                    // holidayGrowth: calculatePercentageGrowth(totalHolidays, previousTotalHolidays),
                }
            } else if(req.user.role === 'Employee'){
                const [
                    totalLeaveRequests, previousTotalLeaveRequests,
                    totalHolidays, previousTotalHolidays
                ] = await Promise.all([
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true } }),
                    Leave.countDocuments({ userId: req.user._id, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } }),

                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }),
                    Holiday.countDocuments({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true }, createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } })
                ])

                responseData = {
                    totalLeaveRequests,
                    // leaveRequestGrowth: calculatePercentageGrowth(totalLeaveRequests, previousTotalLeaveRequests),
                    
                    totalHolidays,
                    // holidayGrowth: calculatePercentageGrowth(totalHolidays, previousTotalHolidays)
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
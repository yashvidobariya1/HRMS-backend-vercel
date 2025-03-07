const Client = require("../models/client")
const Company = require("../models/company")
const Contract = require("../models/contract")
const Holiday = require("../models/holiday")
const Leave = require("../models/leaveRequest")
const Location = require("../models/location")
const Template = require("../models/template")
const User = require("../models/user")


exports.dashboard = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            if(req.user.role === 'Superadmin'){
                const totalCompanies = await Company.find({ isDeleted: { $ne: true } }).countDocuments()

                const totalClients = await Client.find({ isDeleted: { $ne: true } }).countDocuments()

                const totalContracts = await Contract.find({ isDeleted: { $ne: true } }).countDocuments()

                const totalLocations = await Location.find({ isDeleted: { $ne: true } }).countDocuments()

                const totalTemplates = await Template.find({ isDeleted: { $ne: true } }).countDocuments()

                const totalEmployees = await User.find({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isDeleted: { $ne: true } }).countDocuments()

                const totalActiveUsers = await User.find({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isActive: { $ne: false }, isDeleted: { $ne: true } }).countDocuments()
                
                const adminUsers = await User.find({ role: "Administrator", isDeleted: { $ne: true } }).select("_id")
                const adminUserIds = adminUsers.map(user => user._id)
                const totalLeaveRequests = await Leave.find({ userId: { $in: adminUserIds }, isDeleted: { $ne: true } }).countDocuments()
                const pendingLeaveRequests = await Leave.find({ userId: { $in: adminUserIds }, status: 'Pending', isDeleted: { $ne: true } }).countDocuments()

                return res.send({
                    status: 200,
                    totalCompanies,
                    totalClients,
                    totalContracts,
                    totalLocations,
                    totalTemplates,
                    totalEmployees,
                    totalActiveUsers,
                    totalLeaveRequests,
                    pendingLeaveRequests
                })
            } else if(req.user.role === 'Administartor'){
                const totalEmployees = await User.find({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, isDeleted: { $ne: true } }).countDocuments()
                const totalClients = await Client.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()
                const totalActiveUsers = await User.find({ role: { $in: ['Manager', 'Employee'] }, companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, isActive: { $ne: false }, isDeleted: { $ne: true } }).countDocuments()

                const managerUsers = await User.find({ role: "Manager", isDeleted: { $ne: true } }).select("_id")
                const managerUsersIds = managerUsers.map(user => user._id)
                const totalLeaveRequests = await Leave.find({ userId: { $in: managerUsersIds }, isDeleted: { $ne: true } }).countDocuments()
                const pendingLeaveRequests = await Leave.find({ userId: { $in: managerUsersIds }, status: 'Pending', isDeleted: { $ne: true } }).countDocuments()

                const totalHolidays = await Holiday.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()

                return res.send({
                    status: 200,
                    totalEmployees,
                    totalClients,
                    totalActiveUsers,
                    totalLeaveRequests,
                    pendingLeaveRequests,
                    totalHolidays
                })
            } else if(req.user.role === 'Manager'){
                const totalEmployees = await User.find({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, isDeleted: { $ne: true } }).countDocuments()

                const totalActiveUsers = await User.find({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isActive: { $ne: false }, isDeleted: { $ne: true } }).countDocuments()

                const managerEmployees = await User.find({ role: 'Employee', companyId: req.user.companyId, locationId: { $elemMatch: { $in: req.user.locationId } }, jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } }, isDeleted: { $ne: true } }).select("_id")
                const managerEmployeeIds = managerEmployees.map(user => user._id)
                const totalLeaveRequests = await Leave.find({ userId: { $in: managerEmployeeIds }, isDeleted: { $ne: true } }).countDocuments()
                const pendingLeaveRequests = await Leave.find({ userId: { $in: managerEmployeeIds }, status: 'Pending', isDeleted: { $ne: true } }).countDocuments()

                const totalHolidays = await Holiday.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()

                return res.send({
                    status: 200,
                    totalEmployees,
                    totalActiveUsers,
                    totalLeaveRequests,
                    pendingLeaveRequests,
                    totalHolidays
                })

                // const currentDate = new Date();
                // const currentYear = currentDate.getFullYear();
                // const currentMonth = currentDate.getMonth(); // 0 = January, 11 = December

                // // Get previous month details
                // const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                // const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

                // // Date range for current month
                // const currentMonthStart = new Date(currentYear, currentMonth, 1);
                // const currentMonthEnd = new Date(currentYear, currentMonth + 1, 1);

                // // Date range for previous month
                // const previousMonthStart = new Date(previousYear, previousMonth, 1);
                // const previousMonthEnd = new Date(previousYear, previousMonth + 1, 1);

                // // Helper function to calculate percentage change
                // const calculatePercentageChange = (current, previous) => {
                //     if (previous === 0) return current > 0 ? 100 : 0; // Avoid division by zero
                //     return ((current - previous) / previous) * 100;
                // };

                // // Get current and previous month's total employees
                // const totalEmployees = await User.countDocuments({
                //     role: 'Employee',
                //     companyId: req.user.companyId,
                //     locationId: { $elemMatch: { $in: req.user.locationId } },
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
                // });

                // const previousMonthEmployees = await User.countDocuments({
                //     role: 'Employee',
                //     companyId: req.user.companyId,
                //     locationId: { $elemMatch: { $in: req.user.locationId } },
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
                // });

                // // Get current and previous month's active users
                // const totalActiveUsers = await User.countDocuments({
                //     role: 'Employee',
                //     companyId: req.user.companyId,
                //     locationId: { $elemMatch: { $in: req.user.locationId } },
                //     jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
                //     isActive: { $ne: false },
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
                // });

                // const previousMonthActiveUsers = await User.countDocuments({
                //     role: 'Employee',
                //     companyId: req.user.companyId,
                //     locationId: { $elemMatch: { $in: req.user.locationId } },
                //     jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
                //     isActive: { $ne: false },
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
                // });

                // // Get current and previous month's leave requests
                // const managerEmployees = await User.find({
                //     role: 'Employee',
                //     companyId: req.user.companyId,
                //     locationId: { $elemMatch: { $in: req.user.locationId } },
                //     jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
                //     isDeleted: { $ne: true }
                // }).select("_id");

                // const managerEmployeeIds = managerEmployees.map(user => user._id);

                // const totalLeaveRequests = await Leave.countDocuments({
                //     userId: { $in: managerEmployeeIds },
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
                // });

                // const previousMonthLeaveRequests = await Leave.countDocuments({
                //     userId: { $in: managerEmployeeIds },
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
                // });

                // // Get current and previous month's pending leave requests
                // const pendingLeaveRequests = await Leave.countDocuments({
                //     userId: { $in: managerEmployeeIds },
                //     status: 'Pending',
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
                // });

                // const previousMonthPendingLeaveRequests = await Leave.countDocuments({
                //     userId: { $in: managerEmployeeIds },
                //     status: 'Pending',
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
                // });

                // // Get current and previous month's holidays
                // const totalHolidays = await Holiday.countDocuments({
                //     companyId: req.user.companyId,
                //     locationId: { $in: req.user.locationId },
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
                // });

                // const previousMonthHolidays = await Holiday.countDocuments({
                //     companyId: req.user.companyId,
                //     locationId: { $in: req.user.locationId },
                //     isDeleted: { $ne: true },
                //     createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
                // });

                // // Calculate percentage changes
                // const employeeChange = calculatePercentageChange(totalEmployees, previousMonthEmployees);
                // const activeUsersChange = calculatePercentageChange(totalActiveUsers, previousMonthActiveUsers);
                // const leaveRequestsChange = calculatePercentageChange(totalLeaveRequests, previousMonthLeaveRequests);
                // const pendingLeaveRequestsChange = calculatePercentageChange(pendingLeaveRequests, previousMonthPendingLeaveRequests);
                // const holidaysChange = calculatePercentageChange(totalHolidays, previousMonthHolidays);

                // return res.send({
                //     status: 200,
                //     totalEmployees,
                //     employeeChange, // % increase/decrease from last month

                //     totalActiveUsers,
                //     activeUsersChange, // % increase/decrease from last month

                //     totalLeaveRequests,
                //     leaveRequestsChange, // % increase/decrease from last month

                //     pendingLeaveRequests,
                //     pendingLeaveRequestsChange, // % increase/decrease from last month

                //     totalHolidays,
                //     holidaysChange // % increase/decrease from last month
                // });
            } else if(req.user.role === 'Employee'){
                const totalLeaveRequests = await Leave.find({ userId: { $in: req.user._id }, isDeleted: { $ne: true } }).countDocuments()
                const totalHolidays = await Holiday.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()

                return res.send({
                    status: 200,
                    totalLeaveRequests,
                    totalHolidays
                })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while requesting dashboard:', error)
        res.send({ message: 'Error occurred while fetching dashboard data!' })
    }
}
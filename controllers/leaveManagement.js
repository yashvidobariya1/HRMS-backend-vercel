const Holiday = require('../models/holiday')
const Leave = require('../models/leaveRequest')
const Notification = require('../models/notification')
const User = require('../models/user')
const moment = require('moment')

// exports.leaveRequest = async (req, res) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user.role)){
//             const userId = req.user._id

//             const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
//             if(!user){
//                 return res.send({ status: 404, message: 'User not found' })
//             }

//             const {
//                 leaveType,
//                 jobId,
//                 selectionDuration,
//                 startDate,
//                 endDate,
//                 leaveDays,
//                 reasonOfLeave,
//                 // isPaidLeave,
//             } = req.body

//             // const holidays = await Holiday.find({
//             //     companyId: user.companyId,
//             //     locationId: { $in: user.locationId },
//             //     date: { 
//             //         $gte: startDate,
//             //         $lte: endDate ? endDate : startDate
//             //     }
//             // })

//             // if (holidays.length > 0) {
//             //     // const holidayDates = holidays.map(holiday => holiday.date);
//             //     // return res.send({ 
//             //     //     status: 400, 
//             //     //     message: `The selected leave period already holidays on these dates: ${holidayDates.join(', ')}.` 
//             //     // })

//             //     let holidayDates = holidays.map(h => h.date).sort()

//             //     function groupHolidayDates(dates) {
//             //         let formattedDates = []
//             //         let start = dates[0], end = dates[0]

//             //         for (let i = 1; i < dates.length; i++) {
//             //             let prevDate = moment(dates[i - 1], "YYYY-MM-DD")
//             //             let currDate = moment(dates[i], "YYYY-MM-DD")

//             //             if (currDate.diff(prevDate, "days") === 1) {
//             //                 end = dates[i]
//             //             } else {
//             //                 formattedDates.push(start === end ? start : `${start} to ${end}`)
//             //                 start = end = dates[i]
//             //             }
//             //         }

//             //         formattedDates.push(start === end ? start : `${start} to ${end}`)
//             //         return formattedDates.join(", ")
//             //     }

//             //     let holidayMessage = groupHolidayDates(holidayDates)

//             //     return res.send({ 
//             //         status: 400, 
//             //         message: `The selected leave period includes holidays on following dates: ${holidayMessage}.` 
//             //     })

//             // }

//             const mockReq = { body: { jobId }, user }
//             // console.log('mockReq:', mockReq)
//             const mockRes = { send: (response) => response }
//             // console.log('mockRes:', mockRes)
            
//             const leaveCountResponse = await this.getAllowLeaveCount(mockReq, mockRes)
//             // console.log('leaveCountResponse:', leaveCountResponse)
//             if (leaveCountResponse.status !== 200) {
//                 return res.send(leaveCountResponse)
//             }

//             const remainingLeaves = leaveCountResponse.leaveCount
//             if(remainingLeaves[leaveType] !== 0){
//                 if (remainingLeaves[leaveType] < leaveDays) {
//                     return res.send({ status: 400, message: 'Leave limit exceeded for the selected leave type.' })
//                 }
//             }

//             let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
//             if(!jobDetail){
//                 return res.send({ status: 404, message: 'JobTitle not found' })
//             }
//             let locationId = jobDetail?.location

//             const existLeave = await Leave.findOne({
//                 userId,
//                 jobId,
//                 startDate,
//                 status: 'Pending'
//             })

//             if (existLeave) {
//                 return res.status(400).json({ status: 400, message: 'You already have a leave request for this period!' });
//             }

//             let firstName = req.user?.personalDetails?.firstName || ''
//             let lastName = req.user?.personalDetails?.lastName || ''

//             let leaves = [];
//             if (selectionDuration === 'Multiple') {
//                 const start = moment(startDate)
//                 const end = moment(endDate)
                
//                 const totalDays = end.diff(start, 'days') + 1
            
//                 leaves = Array.from({ length: totalDays }, (_, index) => ({
//                     leaveDate: start.clone().add(index, 'days').format('YYYY-MM-DD'),
//                     leaveType,
//                 }))
//             } else {
//                 leaves.push({
//                     leaveDate: moment(startDate).format('YYYY-MM-DD'),
//                     leaveType,
//                 })
//             }

//             const newLeave = {
//                 userId: req.user.id,
//                 jobId,
//                 userName: `${firstName} ${lastName}`,
//                 userEmail: req.user?.personalDetails?.email,
//                 companyId: req.user?.companyId,
//                 locationId,
//                 leaveType,
//                 selectionDuration,
//                 startDate,
//                 endDate,
//                 leaveDays,
//                 leaves,
//                 reasonOfLeave,
//                 isPaidLeave,
//                 status: 'Pending',
//             }
//             // const newLeave = await Leave.create({
//             //     userId: req.user.id,
//             //     jobId,
//             //     userName: `${firstName} ${lastName}`,
//             //     userEmail: req.user?.personalDetails?.email,
//             //     companyId: req.user?.companyId,
//             //     locationId,
//             //     leaveType,
//             //     selectionDuration,
//             //     startDate,
//             //     endDate,
//             //     leaveDays,
//             //     leaves,
//             //     reasonOfLeave,
//             //     isPaidLeave,
//             //     status: 'Pending',
//             // })

//             // ---------------send notification---------------
//             let notifiedId = []
//             let readBy = []
//             if (req.user.role === 'Employee') {
//                 if (jobDetail && jobDetail.assignManager) {
//                     const assignManager = await User.find({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
//                     // console.log('assignManager', assignManager)
//                     notifiedId.push(jobDetail.assignManager);
//                     readBy.push({
//                         userId: jobDetail.assignManager,
//                         role: assignManager[0].role
//                     })
//                     // console.log('readBy1/..', readBy)
//                 }

//                 const administrator = await User.find({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
//                 // console.log('administrator', administrator)
//                 if (administrator.length > 0) {
//                     notifiedId.push(administrator[0]._id);
//                     readBy.push({
//                         userId: administrator[0]._id,
//                         role: administrator[0].role
//                     })
//                 }
//             } else if (req.user.role === 'Manager') {
//                 const administrator = await User.find({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
//                 if (administrator.length > 0) {
//                     notifiedId.push(administrator[0]._id);
//                     readBy.push({
//                         userId: administrator[0]._id,
//                         role: administrator[0].role
//                     })
//                 }
//             } else if (req.user.role === 'Administrator' && user?.creatorId) {
//                 notifiedId.push(user.creatorId);
//                 readBy.push({
//                     userId: user.creatorId,
//                     role: user.createdBy
//                 })
//             }

//             const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

//             superAdmin.map((sa) => {
//                 notifiedId.push(sa?._id)
//                 readBy.push({
//                     userId: sa?._id,
//                     role: sa?.role
//                 })
//             })

//             const notification = new Notification({
//                 userId,
//                 // userName: `${firstName} ${lastName}`,
//                 notifiedId,
//                 type: 'Leave request',
//                 message: `${firstName} ${lastName} has submitted a ${leaveType} leave request ${endDate ? `from ${startDate} to ${endDate}.` : `on ${startDate}.`}`,
//                 readBy
//             });
//             // console.log('notification/..', notification)
//             // await notification.save();

//             return res.send({ status:200, message: 'Leave request submitted.', newLeave })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while leaving request.', error)
//         res.send({ message: 'Error occurred while leaving request!' })
//     }
// }

exports.leaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.user._id

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const {
                leaveType,
                jobId,
                selectionDuration,
                startDate,
                endDate,
                // leaveDays,
                reasonOfLeave,
                // isPaidLeave,
            } = req.body

            const mockReq = { body: { jobId }, user }
            // console.log('mockReq:', mockReq)
            const mockRes = { send: (response) => response }
            // console.log('mockRes:', mockRes)
            
            const leaveCountResponse = await this.getAllowLeaveCount(mockReq, mockRes)
            // console.log('leaveCountResponse:', leaveCountResponse)
            if (leaveCountResponse.status !== 200) {
                return res.send(leaveCountResponse)
            }

            const remainingLeaves = leaveCountResponse.leaveCount
            let paidLeaveBalance = remainingLeaves[leaveType] || 0

            let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }
            let locationId = jobDetail?.location

            const existLeave = await Leave.findOne({
                userId,
                jobId,
                startDate,
                // status: 'Pending'
            })

            if (existLeave) {
                return res.send({ status: 400, message: 'You already have a leave request for this period!' });
            }

            const holidays = await Holiday.find({
                companyId: user.companyId,
                locationId: { $in: user.locationId },
                date: { $gte: startDate, $lte: endDate ? endDate : startDate },
                isDeleted: { $ne: true }
            });

            const holidayDates = holidays.map(holiday => holiday.date);

            const start = moment(startDate, 'YYYY-MM-DD'); 
            const end = endDate ? moment(endDate, 'YYYY-MM-DD') : start.clone()
            const totalDays = end.diff(start, 'days') + 1

            if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
                return res.send({ status: 400, message: "Invalid date range!" })
            }

            let effectiveLeaveDays = 0
            let weekends = 0
            let holidaysInLeavePeriod = 0

            for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'days')) {
                let formattedDate = date.format('YYYY-MM-DD')

                if (date.isoWeekday() === 6 || date.isoWeekday() === 7) {
                    weekends++
                    continue
                }

                if (holidayDates.includes(formattedDate)) {
                    holidaysInLeavePeriod++
                    continue
                }

                effectiveLeaveDays++
            }

            if (effectiveLeaveDays <= 0) {
                return res.send({ status: 400, message: "Selected leave period contains weekends or holidays, no leave required!" })
            }

            let leaveDays
            if (selectionDuration === 'First-Half' || selectionDuration === 'Second-Half') {
                leaveDays = 0.5
            } else if (selectionDuration === 'Multiple') {
                leaveDays = effectiveLeaveDays
            } else leaveDays = 1

            let usedPaidLeave = 0
            let usedHalfPaidLeave = 0
            let usedUnpaidLeave = 0
            let leaves = []

            for (let i = 0; i < totalDays; i++) {
                let leaveDate = start.clone().add(i, 'days').format('YYYY-MM-DD');

                // if (!holidayDates.includes(leaveDate) && moment(leaveDate).isoWeekday() !== 6 && moment(leaveDate).isoWeekday() !== 7) {
                //     let isPaidLeave = false;
                //     let isHalfPaidLeave = false; // New flag for half-paid leave

                //     if (paidLeaveBalance >= 1) {
                //         isPaidLeave = true;
                //         paidLeaveBalance -= 1;
                //         usedPaidLeave++;
                //     } else if (paidLeaveBalance > 0) {
                //         isHalfPaidLeave = true;
                //         paidLeaveBalance = 0; // Half-day leave fully consumed
                //         usedHalfPaidLeave++;
                //     } else {
                //         usedUnpaidLeave++;
                //     }

                //     leaves.push({
                //         leaveDate,
                //         leaveType,
                //         isPaidLeave,
                //         isHalfPaidLeave, // Store half-day leave status
                //         isApproved: false
                //     });
                // }
                if (!holidayDates.includes(leaveDate) && moment(leaveDate).isoWeekday() !== 6 && moment(leaveDate).isoWeekday() !== 7) {
                    let isPaidLeave = false;
                    let isHalfPaidLeave = false;
                
                    if (selectionDuration === 'First-Half' || selectionDuration === 'Second-Half') {
                        if (paidLeaveBalance >= 0.5) {
                            isHalfPaidLeave = true;
                            paidLeaveBalance -= 0.5;
                            usedHalfPaidLeave++;
                        } else {
                            usedUnpaidLeave += 0.5;
                        }
                
                        leaves.push({
                            leaveDate,
                            leaveType,
                            isPaidLeave: false,
                            isHalfPaidLeave: true, 
                            isApproved: false,
                            selectionDuration
                        });
                
                        break; // Stop after adding a single half-day leave entry
                    } else {
                        if (paidLeaveBalance >= 1) {
                            isPaidLeave = true;
                            paidLeaveBalance -= 1;
                            usedPaidLeave++;
                        } else if (paidLeaveBalance > 0) {
                            isHalfPaidLeave = true;
                            paidLeaveBalance = 0; // Half-day leave fully consumed
                            usedHalfPaidLeave++;
                        } else {
                            usedUnpaidLeave++;
                        }
                
                        leaves.push({
                            leaveDate,
                            leaveType,
                            isPaidLeave,
                            isHalfPaidLeave,
                            isApproved: false
                        });
                    }
                }
            }

            const leaveRequest = new Leave({
                userId,
                jobId,
                // userName: `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}`,
                userEmail: user?.personalDetails?.email,
                companyId: user.companyId,
                locationId,
                leaveType,
                selectionDuration,
                startDate,
                endDate,
                totalLeaveDays: leaveDays,
                numberOfApproveLeaves: 0,
                leaves,
                reasonOfLeave,
                status: 'Pending',
            });

            await leaveRequest.save();

            // ---------------send notification---------------
            let notifiedId = []
            let readBy = []
            if (req.user.role === 'Employee') {
                if (jobDetail && jobDetail.assignManager) {
                    const assignManager = await User.findOne({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
                    // console.log('assignManager', assignManager)
                    notifiedId.push(jobDetail.assignManager);
                    readBy.push({
                        userId: jobDetail.assignManager,
                        role: assignManager?.role
                    })
                    // console.log('readBy1/..', readBy)
                }

                // const administrator = await User.find({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
                // // console.log('administrator', administrator)
                // if (administrator.length > 0) {
                //     notifiedId.push(administrator[0]._id);
                //     readBy.push({
                //         userId: administrator[0]._id,
                //         role: administrator[0].role
                //     })
                // }
            } else if (req.user.role === 'Manager') {
                const administrator = await User.findOne({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
                if (administrator.length > 0) {
                    notifiedId.push(administrator?._id);
                    readBy.push({
                        userId: administrator?._id,
                        role: administrator?.role
                    })
                }
            } else if (req.user.role === 'Administrator' && user?.creatorId) {
                notifiedId.push(user?.creatorId);
                readBy.push({
                    userId: user?.creatorId,
                    role: user?.createdBy
                })
            }

            // const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            // superAdmin.map((sa) => {
            //     notifiedId.push(sa?._id)
            //     readBy.push({
            //         userId: sa?._id,
            //         role: sa?.role
            //     })
            // })

            const firstName = user?.personalDetails?.firstName || ""
            const lastName = user?.personalDetails?.lastName || ""

            const notification = new Notification({
                userId,
                // userName: `${firstName} ${lastName}`,
                notifiedId,
                type: 'Leave Request',
                message: `${firstName} ${lastName} has submitted a ${leaveType} leave request ${endDate ? `from ${startDate} to ${endDate}.` : `on ${startDate}.`}`,
                readBy
            });
            // console.log('notification/..', notification)
            await notification.save();

            return res.send({ status: 200, message: `Leave request submitted.`, leaveRequest })
            // if (usedHalfPaidLeave > 0) {
            //     return res.send({
            //         status: 200,
            //         message: `Leave request submitted. ${usedPaidLeave} full days are paid, ${usedHalfPaidLeave} half-day is paid, and ${usedUnpaidLeave} days are unpaid.`,
            //         leaveRequest
            //     });
            // } else if (usedPaidLeave > 0) {
            //     return res.send({ status: 200, message: `Leave request submitted.${usedPaidLeave} days are paid.`, leaveRequest });
            // } else {
            //     return res.send({ status: 200, message: `Leave request submitted.${usedUnpaidLeave} days are unpaid.`, leaveRequest });
            // }
        } else return res.send({ status: 403, message: 'Access denied' });
    } catch (error) {
        console.error('Error occurred while processing leave request.', error);
        return res.send({ status: 500, message: 'Error occurred while processing leave request!' });
    }
}

exports.getLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const LRId = req.params.id
            const leave = await Leave.findOne({ _id: LRId, isDeleted: { $ne: true } }).populate('userId', 'personalDetails.firstName personalDetails.lastName')
            const formattedLeave = {
                ...leave.toObject(),
                userName: `${leave?.userId?.personalDetails?.firstName} ${leave?.userId?.personalDetails?.lastName}`,
                userId: leave?.userId?._id
            }
            if(!leave){
                return res.send({ status: 404, message: 'Leave request not found' })
            }

            return res.send({ status: 200, message: 'Leave request fetched successfully.', leave: formattedLeave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching leave request:', error)
        res.send({ message: 'Error occurred while fetching leave request!' })
    }
}

exports.getAllOwnLeaves = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = ( page - 1 ) * limit
            const userId = req.user._id
            const { jobId } = req.body

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobExists = user.jobDetails.some(job => job._id.toString() === jobId);
            if (!jobExists) {
                return res.send({ status: 404, message: 'JobTitle not found' });
            }

            const allLeaves = await Leave.find({ userId, jobId, isDeleted: { $ne: true } }).populate('userId', 'personalDetails.firstName personalDetails.lastName').sort({ createdAt: -1 }).skip(skip).limit(limit)

            const formattedLeaves = allLeaves.map(leave => ({
                ...leave.toObject(),
                userName: `${leave?.userId?.personalDetails?.firstName} ${leave?.userId?.personalDetails?.lastName}`,
                userId: leave?.userId?._id
            }))

            const totalLeaves = await Leave.find({ userId, jobId, isDeleted: { $ne: true } }).countDocuments()
            
            return res.send({
                status: 200,
                message: 'All leave requests fetched successfully.',
                allLeaves: formattedLeaves,
                totalLeaves,
                totalPages: Math.ceil(totalLeaves / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching all leaves requests:', error)
        res.send({ message: 'Error occurred while fetching all leave requests!' })
    }
}

exports.getAllowLeaveCount = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { jobId } = req.body
            const userId = req.user._id
            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })

            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }
            
            const jobExists = user.jobDetails.some(job => job._id.toString() === jobId);

            if (!jobExists) {
                return res.send({ status: 404, message: 'JobTitle not found' });
            }

            const startDate = moment().startOf('year').toDate()
            const endDate = moment().endOf('year').toDate()

            const allLeavesOfUser = await Leave.find({
                userId,
                // status: 'Approved',
                jobId,
                isDeleted: { $ne: true },
                createdAt: { $gte: startDate, $lte: endDate }
            })

            const leaveCountByType = allLeavesOfUser.reduce((acc, leave) => {
                const leaveDays = parseFloat(leave.totalLeaveDays)
                if (leaveDays > 0) {
                    leave.leaves.forEach(day => {
                        if (day.isApproved === true) {
                            if(leave.selectionDuration === 'First-Half' || leave.selectionDuration === 'Second-Half'){
                                acc[leave.leaveType] = (acc[leave.leaveType] || 0) + 0.5;
                            } else {
                                acc[leave.leaveType] = (acc[leave.leaveType] || 0) + 1;
                            }
                        }
                    });
                }
                return acc;
            }, {});

            let jobDetails = user.jobDetails.find(job => job._id.toString() === jobId) || user.jobDetails[0]
            // console.log('jobDetails/..', jobDetails)

            const totalSickLeaves = jobDetails?.sickLeavesAllow
            const totalAllowLeaves = jobDetails?.leavesAllow

            const casualLeaves = totalAllowLeaves - (leaveCountByType?.Casual || 0)
            const sickLeaves = totalSickLeaves - (leaveCountByType?.Sick || 0)

            let leaveCount = {
                Casual: casualLeaves > 0 ? casualLeaves : 0,
                Sick: sickLeaves > 0 ? sickLeaves : 0
            }
            
            return res.send({ status: 200, leaveCount })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching leave count:', error)
        res.send({ message: 'Error occurred while fetching leave count!' })
    }
}

exports.getAllLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = ( page - 1 ) * limit

            let allLeaveRequests
            let totalLeaveRequests
            
            if(req.user.role == 'Superadmin'){
                const allLeaveRequestsOfAdmin = await Leave.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 })

                let allAdminLR = []
                for(const LR of allLeaveRequestsOfAdmin){
                    const existingUser = await User.findOne({ _id: LR.userId, isDeleted: { $ne: true } })
                    if (existingUser.role === 'Administrator') {
                        allAdminLR.push(LR)
                    }
                }
                allLeaveRequests = allAdminLR.slice(skip, skip + limit)
                totalLeaveRequests = allAdminLR?.length
            } else if(req.user.role == 'Administrator'){
                const allLeaveRequestsOfEmployees = await Leave.find({
                    companyId: req.user.companyId,
                    locationId: { $in: req.user.locationId },
                    isDeleted: { $ne: true }
                }).sort({ createdAt: -1 })

                let allEmployeesLR = []
                for (const LR of allLeaveRequestsOfEmployees) {
                    const existingUser = await User.findOne({ _id: LR.userId, isDeleted: { $ne: true } })
                    if (existingUser.role === 'Manager') {
                        allEmployeesLR.push(LR)
                    }
                }
                allLeaveRequests = allEmployeesLR.slice(skip, skip + limit)
                totalLeaveRequests = allEmployeesLR?.length
            } else if(req.user.role == 'Manager'){
                const employees = await User.find({
                    jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
                    isDeleted: { $ne: true }
                }).select("_id")

                const employeeIds = employees.map(emp => emp._id)

                const leaveRequests = await Leave.find({
                    userId: { $in: employeeIds },
                    companyId: req.user.companyId,
                    locationId: { $in: req.user.locationId },
                    isDeleted: { $ne: true }
                }).sort({ createdAt: -1 });

                allLeaveRequests = leaveRequests.slice(skip, skip + limit)
                totalLeaveRequests = leaveRequests.length
            }

            return res.send({
                status: 200,
                message: 'All leave requests fetched successfully.',
                allLeaveRequests: allLeaveRequests ? allLeaveRequests : [],
                totalLeaveRequests,
                totalPages: Math.ceil(totalLeaveRequests / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching own company employees leave requests:', error)
        res.send({ message: 'Error occurred while fetching own company employees leave requests!' })
    }
}

exports.updateLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const LRId = req.params.id
            const {
                leaveType,
                selectionDuration,
                startDate,
                endDate,
                jobId,
                // leaveDays,
                reasonOfLeave,
                // isPaidLeave,
            } = req.body

            const user = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const leaveRequest = await Leave.findOne({_id: LRId, isDeleted: { $ne: true }})
            if(!leaveRequest){
                return res.send({ status: 404, message: 'Leave request not found' })
            }
            if(leaveRequest.status !== 'Pending'){
                return res.send({ status: 403, message: `Leave request has already been ${leaveRequest.status}.` })
            }

            const mockReq = { body: { jobId }, user }
            const mockRes = { send: (response) => response }
            
            const leaveCountResponse = await this.getAllowLeaveCount(mockReq, mockRes)
            if (leaveCountResponse.status !== 200) {
                return res.send(leaveCountResponse)
            }

            const remainingLeaves = leaveCountResponse.leaveCount
            let paidLeaveBalance = remainingLeaves[leaveType] || 0

            const holidays = await Holiday.find({
                companyId: user.companyId,
                locationId: { $in: user.locationId },
                date: { $gte: startDate, $lte: endDate ? endDate : startDate },
                isDeleted: { $ne: true }
            });

            const holidayDates = holidays.map(holiday => holiday.date);

            const start = moment(startDate, 'YYYY-MM-DD'); 
            const end = endDate ? moment(endDate, 'YYYY-MM-DD') : start.clone()
            const totalDays = end.diff(start, 'days') + 1

            if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
                return res.send({ status: 400, message: "Invalid date range!" })
            }

            let effectiveLeaveDays = 0
            let weekends = 0
            let holidaysInLeavePeriod = 0

            for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'days')) {
                let formattedDate = date.format('YYYY-MM-DD')

                if (date.isoWeekday() === 6 || date.isoWeekday() === 7) {
                    weekends++
                    continue
                }

                if (holidayDates.includes(formattedDate)) {
                    holidaysInLeavePeriod++
                    continue
                }

                effectiveLeaveDays++
            }

            if (effectiveLeaveDays <= 0) {
                return res.send({ status: 400, message: "Selected leave period contains weekends or holidays, no leave required!" })
            }

            let leaveDays
            if (selectionDuration === 'First-Half' || selectionDuration === 'Second-Half') {
                leaveDays = 0.5
            } else if (selectionDuration === 'Multiple') {
                leaveDays = effectiveLeaveDays
            } else leaveDays = 1

            let usedPaidLeave = 0
            let usedHalfPaidLeave = 0
            let usedUnpaidLeave = 0
            let leaves = []

            for (let i = 0; i < totalDays; i++) {
                let leaveDate = start.clone().add(i, 'days').format('YYYY-MM-DD');
                if (!holidayDates.includes(leaveDate) && moment(leaveDate).isoWeekday() !== 6 && moment(leaveDate).isoWeekday() !== 7) {
                    let isPaidLeave = false;
                    let isHalfPaidLeave = false;
                
                    if (selectionDuration === 'First-Half' || selectionDuration === 'Second-Half') {
                        if (paidLeaveBalance >= 0.5) {
                            isHalfPaidLeave = true;
                            paidLeaveBalance -= 0.5;
                            usedHalfPaidLeave++;
                        } else {
                            usedUnpaidLeave += 0.5;
                        }
                
                        leaves.push({
                            leaveDate,
                            leaveType,
                            isPaidLeave: false,
                            isHalfPaidLeave: true, 
                            isApproved: false,
                            selectionDuration
                        });
                
                        break; // Stop after adding a single half-day leave entry
                    } else {
                        if (paidLeaveBalance >= 1) {
                            isPaidLeave = true;
                            paidLeaveBalance -= 1;
                            usedPaidLeave++;
                        } else if (paidLeaveBalance > 0) {
                            isHalfPaidLeave = true;
                            paidLeaveBalance = 0; // Half-day leave fully consumed
                            usedHalfPaidLeave++;
                        } else {
                            usedUnpaidLeave++;
                        }
                
                        leaves.push({
                            leaveDate,
                            leaveType,
                            isPaidLeave,
                            isHalfPaidLeave,
                            isApproved: false
                        });
                    }
                }
            }

            const updatedLeaveRequest = await Leave.findByIdAndUpdate(
                { _id: LRId },
                {
                    $set: {
                        leaveType,
                        selectionDuration,
                        startDate,
                        endDate,
                        totalLeaveDays: leaveDays,
                        leaves,
                        reasonOfLeave,
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Leave request updated successfully', updatedLeaveRequest })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating leave request:', error)
        res.send({ message: 'Error occurred while updating leave request!' })
    }
}

exports.deleteLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const leaveRequestId = req.params.id

            const leave = await Leave.findOne({ _id: leaveRequestId, isDeleted: { $ne: true } })
            if(!leave){
                return res.send({ status: 404, message: 'Leave request not found' })
            }
            if(leave.status !== 'Pending'){
                return res.send({ status: 403, message: `Leave request has already been ${leave.status}.` })
            }

            leave.isDeleted = true
            await leave.save()

            return res.send({ status: 200, message: 'Leave reuqest deleted successfully.' })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deleting leave reqest:', error)
        res.send({ message: 'Error occurred while deleting leave request!' })
    }
}

exports.approveLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const leaveRequestId = req.params.id
            const { leaves, approvalReason } = req.body

            if(!approvalReason){
                return res.send({ status: 400, message: 'Approval reason is required' })
            }

            const leave = await Leave.findOne({ _id: leaveRequestId, isDeleted: { $ne: true } })

            if (!leave) {
                return res.send({ status: 404, message: 'Leave request not found.' })
            }

            if (leave.selectionDuration === 'Multiple' && Array.isArray(leaves)) {
                leaves.forEach(update => {
                    const leaveDay = leave.leaves.find(leave => leave.leaveDate === update.leaveDate);
                    if (leaveDay) {
                        leaveDay.isApproved = update.isApproved
                    }
                })
            } else if(leave.selectionDuration !== 'Multiple') {
                if (leave.leaves.length > 0) {
                    leave.leaves[0].isApproved = true
                }
            }

            let approvedLeavesCount = 0
            leave.leaves.map(LR => {
                if(LR.isApproved == true){
                    if(leave.selectionDuration === 'First-Half' || leave.selectionDuration === 'Second-Half'){
                        approvedLeavesCount += 0.5
                    } else {
                        approvedLeavesCount += 1
                    }
                }
            })
            // console.log('approvedLeavesCount:', approvedLeavesCount)

            leave.status = 'Approved'
            leave.numberOfApproveLeaves = approvedLeavesCount
            leave.approvalReason = approvalReason
            leave.approverId = req.user._id
            leave.approverRole = req.user.role
            await leave.save()

            // ---------------send notification---------------
            let firstName = req.user?.personalDetails?.firstName || ""
            let lastName = req.user?.personalDetails?.lastName || ""

            let notifiedId = []
            let readBy = []

            const existingUser = await User.findOne({ _id: leave.userId.toString(), isDeleted: { $ne: true } })
            if(!existingUser){
                return res.send({ status: 404, message: 'User not found.' })
            }

            notifiedId.push(existingUser?._id)
            readBy.push({
                userId: existingUser?._id,
                role: existingUser?.role
            })

            // const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            // superAdmin.map((sa) => {
            //     notifiedId.push(sa?._id)
            //     readBy.push({
            //         userId: sa?._id,
            //         role: sa?.role
            //     })
            // })

            let notificationMessage = `${firstName} ${lastName} has approved your ${leave.leaveType} leave request.${ approvalReason ? `( Reason: ${approvalReason} )` : '' }`
            if (approvedLeavesCount < leave?.totalLeaveDays) {
                notificationMessage = `${firstName} ${lastName} has partially approved your ${leave.leaveType} leave request [ Approved : ${approvedLeavesCount} and Rejected : ${leave?.totalLeaveDays - approvedLeavesCount} ]. ${ approvalReason ? ` ( Reason: ${approvalReason} )` : '' }`
            }

            const notification = new Notification({
                userId: req.user._id,
                // userName: `${firstName} ${lastName}`,
                notifiedId,
                type: 'Leave Request Approveral',
                message: notificationMessage,
                readBy
            })
            // console.log('notification/..', notification)

            await notification.save()
            return res.send({ status: 200, message: 'Leave request approved.', leave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while approving leave request:', error)
        return res.send({ message: 'Error occurred while approving leave request!' })
    }
}

exports.rejectLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const leaveRequestId = req.params.id
            const { rejectionReason } = req.body

            const leave = await Leave.findOne({ _id: leaveRequestId, isDeleted: { $ne: true } })

            if (!leave) {
                return res.send({ status: 404, message: 'Leave request not found.' })
            }

            if (leave.selectionDuration === 'Multiple') {
                leave?.leaves.forEach(leave => {
                    leave.isApproved = false
                })
            } else if(leave.selectionDuration !== 'Multiple') {
                if (leave.leaves.length > 0) {
                    leave.leaves[0].isApproved = false
                }
            }

            leave.status = 'Rejected'
            leave.numberOfApproveLeaves = 0
            leave.rejectionReason = rejectionReason
            leave.rejectorId = req.user._id
            leave.rejectorRole = req.user.role
            await leave.save()

            // ---------------send notification---------------
            let firstName = req.user?.personalDetails?.firstName || ""
            let lastName = req.user?.personalDetails?.lastName || ""

            let notifiedId = []
            let readBy = []

            const existingUser = await User.findOne({ _id: leave?.userId.toString(), isDeleted: { $ne: true } })
            if(!existingUser){
                return res.send({ status: 404, message: 'User not found.' })
            }

            notifiedId.push(existingUser?._id)
            readBy.push({
                userId: existingUser?._id,
                role: existingUser?.role
            })

            // const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            // superAdmin.map((sa) => {
            //     notifiedId.push(sa?._id)
            //     readBy.push({
            //         userId: sa?._id,
            //         role: sa?.role
            //     })
            // })

            const notification = new Notification({
                userId: req.user._id,
                // userName: `${firstName} ${lastName}`,
                notifiedId,
                type: 'Leave Request Reject',
                message: `${firstName} ${lastName} has reject your ${leave.leaveType} leave request. ( Reason: ${rejectionReason} )`,
                readBy
            })
            // console.log('notification/..', notification)
            
            await notification.save()
            return res.send({ status: 200, message: 'Leave request rejected.', leave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while rejecting leave request:', error)
        return res.send({ message: 'Error occurred while rejecting leave request!' })
    }
}

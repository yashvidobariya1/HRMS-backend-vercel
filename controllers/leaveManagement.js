const Client = require('../models/client')
const Holiday = require('../models/holiday')
const Leave = require('../models/leaveRequest')
const Location = require('../models/location')
const Notification = require('../models/notification')
const User = require('../models/user')
const moment = require('moment')

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
                clientId,
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

            let paidLeaveBalance

            leaveCountResponse?.leaveCount.map(leaveCount => {
                if(leaveCount?.leaveType == leaveType){
                    paidLeaveBalance = leaveCount?.count
                }
            })

            // const remainingLeaves = leaveCountResponse.leaveCount
            // let paidLeaveBalance = remainingLeaves[leaveType].count || 0

            let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            let location
            let client
            if(jobDetail?.isWorkFromOffice){
                location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
                if(!location){
                    return res.send({ status: 404, message: 'Location not found' })
                }
            } else {
                client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if(!client){
                    return res.send({ status: 404, message: 'Client not found' })
                }
            }

            const existLeave = await Leave.findOne({
                userId,
                jobId,
                startDate,
                // status: 'Pending'
            })

            if (existLeave && existLeave?.status !== "Rejected") {
                return res.send({ status: 409, message: 'You already have a leave request for this period!' });
            }

            const holidays = await Holiday.find({
                companyId: user.companyId,
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
            // let weekends = 0
            let holidaysInLeavePeriod = 0

            for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'days')) {
                let formattedDate = date.format('YYYY-MM-DD')

                // if (date.isoWeekday() === 6 || date.isoWeekday() === 7) {
                //     weekends++
                //     continue
                // }

                if (holidayDates.includes(formattedDate)) {
                    holidaysInLeavePeriod++
                    continue
                }

                effectiveLeaveDays++
            }

            if (effectiveLeaveDays <= 0) {
                return res.send({ status: 400, message: "Selected leave period contains holidays, no leave required!" })
            }

            let leaveDays
            let leaveHours
            if (selectionDuration === 'First-Half' || selectionDuration === 'Second-Half') {
                leaveDays = 0.5
            } else if (selectionDuration === 'Multiple') {
                leaveDays = effectiveLeaveDays
            } else if(selectionDuration === 'Full-Day'){
                leaveDays = 1
            } else {
                leaveHours = parseInt(selectionDuration)
            }

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
                    } else if(selectionDuration === 'Full-Day' || selectionDuration === 'Multiple') {
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
                    } else {
                        if(paidLeaveBalance > 0){
                            isPaidLeave = true;
                            paidLeaveBalance -= parseInt(selectionDuration);
                            usedPaidLeave += parseInt(selectionDuration);
                        } else {
                            usedPaidLeave += parseInt(selectionDuration);
                        }

                        leaves.push({
                            leaveDate,
                            leaveType,
                            isPaidLeave,
                            isHourlyLeave: true,
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
                locationId: location?._id,
                clientId: client?._id,
                leaveType,
                selectionDuration,
                startDate,
                endDate,
                totalLeaveDays: leaveDays,
                totalLeaveHours: leaveHours,
                numberOfApproveLeaves: 0,
                numberOfApproveLeaveHours: 0,
                leaves,
                reasonOfLeave,
                status: 'Pending',
            });

            await leaveRequest.save();

            // ---------------send notification---------------
            let notifiedId = []
            let readBy = []
            // if (req.user.role === 'Employee') {
            //     if (jobDetail && jobDetail.assignManager) {
            //         const assignManager = await User.findOne({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
            //         // console.log('assignManager', assignManager)
            //         notifiedId.push(jobDetail.assignManager);
            //         readBy.push({
            //             userId: jobDetail.assignManager,
            //             role: assignManager?.role
            //         })
            //         // console.log('readBy1/..', readBy)
            //     }

            //     // const administrator = await User.find({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
            //     // // console.log('administrator', administrator)
            //     // if (administrator.length > 0) {
            //     //     notifiedId.push(administrator[0]._id);
            //     //     readBy.push({
            //     //         userId: administrator[0]._id,
            //     //         role: administrator[0].role
            //     //     })
            //     // }
            // } else if (req.user.role === 'Manager') {
            //     const administrator = await User.findOne({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
            //     if (administrator.length > 0) {
            //         notifiedId.push(administrator?._id);
            //         readBy.push({
            //             userId: administrator?._id,
            //             role: administrator?.role
            //         })
            //     }
            // } else if (req.user.role === 'Administrator' && user?.creatorId) {
            //     notifiedId.push(user?.creatorId);
            //     readBy.push({
            //         userId: user?.creatorId,
            //         role: user?.createdBy
            //     })
            // }

            if (req.user.role === 'Employee' || req.user.role === 'Manager') {
                if (jobDetail && jobDetail?.assignManager) {
                    const assignManager = await User.findOne({ _id: jobDetail?.assignManager, isDeleted: { $ne: true } })
                    notifiedId.push(jobDetail?.assignManager);
                    readBy.push({
                        userId: jobDetail?.assignManager,
                        role: assignManager?.role
                    })
                }
                const administrators = await User.find({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
                administrators.map((admin) => {
                    notifiedId.push(admin?._id)
                    readBy.push({
                        userId: admin?._id,
                        role: admin?.role
                    })
                })
            }

            const superAdmins = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            superAdmins.map((sa) => {
                notifiedId.push(sa?._id)
                readBy.push({
                    userId: sa?._id,
                    role: sa?.role
                })
            })

            const firstName = user?.personalDetails?.firstName || ""
            const lastName = user?.personalDetails?.lastName || ""

            const notification = new Notification({
                userId,
                // userName: `${firstName} ${lastName}`,
                companyId: user.companyId,
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
            if(!leave){
                return res.send({ status: 404, message: 'Leave request not found' })
            }
            const formattedLeave = {
                ...leave.toObject(),
                userName: `${leave?.userId?.personalDetails?.firstName} ${leave?.userId?.personalDetails?.lastName}`,
                userId: leave?.userId?._id
            }

            return res.send({ status: 200, message: 'Leave request fetched successfully.', leave: formattedLeave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching leave request:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching leave request!' })
    }
}

exports.getAllOwnLeaves = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50

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

            let selectionDurationType = ['First-Half', 'Second-Half', 'Multiple', 'Full-Day']
            const formattedLeaves = allLeaves.map(leave => ({
                ...leave.toObject(),
                selectionDuration: selectionDurationType.includes(leave?.selectionDuration) ? leave?.selectionDuration : `${leave?.selectionDuration} Hours`,
                userName: `${leave?.userId?.personalDetails?.firstName} ${leave?.userId?.personalDetails?.lastName}`,
                userId: leave?.userId?._id,
                totalRequestedLeaves: selectionDurationType.includes(leave?.selectionDuration) ? leave?.totalLeaveDays : leave?.totalLeaveHours,
                totalApprovedLeaves: selectionDurationType.includes(leave?.selectionDuration) ? leave?.numberOfApproveLeaves : leave?.numberOfApproveLeaveHours,
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
        return res.send({ status: 500, message: 'Error occurred while fetching all leave requests!' })
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
                const leaveHours = parseInt(leave.totalLeaveHours)
                if (leaveDays > 0 && leave.status !== 'Rejected') {
                    if(leave.status === 'Approved'){
                        acc[leave.leaveType] = (acc[leave.leaveType] || 0) + leave.numberOfApproveLeaves
                    } else {
                        if(leave.selectionDuration === 'First-Half' || leave.selectionDuration === 'Second-Half'){
                            acc[leave.leaveType] = (acc[leave.leaveType] || 0) + 0.5;
                        } else if(leave.selectionDuration === 'Full-Day') {
                            acc[leave.leaveType] = (acc[leave.leaveType] || 0) + 1;
                        }
                    }
                } else if(leaveHours > 0 && leave.status !== 'Rejected') {
                    if(leave.status === 'Approved'){
                        acc[leave.leaveType] = (acc[leave.leaveType] || 0) + leave.numberOfApproveLeaveHours
                    } else {
                        acc[leave.leaveType] = (acc[leave.leaveType] || 0) + leave.totalLeaveHours
                    }
                }
                return acc;
            }, {});

            let jobDetails = user.jobDetails.find(job => job._id.toString() === jobId) || user.jobDetails[0]
            // console.log('jobDetails/..', jobDetails)

            // const totalSickLeaves = jobDetails?.sickLeavesAllow
            // const totalAllowLeaves = jobDetails?.leavesAllow

            const totalLeaves = {
                Casual: jobDetails?.leavesAllow,
                Sick: jobDetails?.sickLeavesAllow
            }

            // const casualLeaves = totalAllowLeaves?.allowedLeavesCounts - (leaveCountByType?.Casual || 0)
            // const sickLeaves = totalSickLeaves?.allowedLeavesCounts - (leaveCountByType?.Sick || 0)

            // let leaveCount = {
            //     Casual: {
            //         count: casualLeaves > 0 ? casualLeaves : 0,
            //         type: `${totalAllowLeaves?.leaveType}`
            //     },
            //     Sick: {
            //         count: sickLeaves > 0 ? sickLeaves : 0,
            //         type: `${totalSickLeaves?.leaveType}`
            //     }
            // }

            let leaveCount = []

            for (let leaveType in totalLeaves) {
                const total = totalLeaves[leaveType]?.allowedLeavesCounts || 0;
                const used = leaveCountByType?.[leaveType] || 0;
                const remaining = total - used;
            
                if (totalLeaves[leaveType]) {
                    leaveCount.push({
                        leaveType: leaveType,
                        count: remaining > 0 ? remaining : 0,
                        type: totalLeaves[leaveType]?.leaveType
                    });
                }
            }
            
            return res.send({ status: 200, leaveCount })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching leave count:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching leave count!' })
    }
}

exports.getAllLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''
            const companyId = req.query.companyId

            const skip = ( page - 1 ) * limit

            let allLeaveRequests = []
            let totalLeaveRequests = 0

            let baseQuery = { isDeleted: { $ne: true } }

            if(companyId && companyId !== 'allCompany'){
                baseQuery['companyId'] = companyId
            } else if(req.user.role !== 'Superadmin'){
                baseQuery['locationId'] = { $in: req.user.locationId }
                baseQuery['companyId'] = req.user.companyId
            }
            
            if(req.user.role == 'Superadmin'){
                baseQuery['userId'] = { $in: await User.find({ role: { $in: ['Administrator', 'Manager', 'Employee'] }, isDeleted: { $ne: true } }).select('_id') }
            } else if(req.user.role == 'Administrator'){
                baseQuery['companyId'] = req.user.companyId
                // baseQuery['locationId'] = { $in: req.user.locationId }
                baseQuery['userId'] = { $in: await User.find({ role: { $in: ['Manager', 'Employee'] }, isDeleted: { $ne: true } }).select('_id') }
            } else if(req.user.role == 'Manager'){
                const employees = await User.find({
                    jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
                    isDeleted: { $ne: true }
                }).select('_id')
                baseQuery['userId'] = { $in: employees.map(emp => emp._id) }
                baseQuery['companyId'] = req.user.companyId
                // baseQuery['locationId'] = { $in: req.user.locationId }
                // baseQuery['userId'] = { $in: await User.find({ role: { $in: ['Employee'] }, isDeleted: { $ne: true } }).select('_id') }
            }

            let leaveRequests = await Leave.find(baseQuery)
                .populate('userId', 'personalDetails.firstName personalDetails.lastName')
                .sort({ createdAt: -1 })

            if(searchQuery){
                const regex = new RegExp(searchQuery.replace(/[-\s]/g, "[-\\s]*"), "i")
                leaveRequests = leaveRequests.filter(leave => {
                    const firstName = leave?.userId?.personalDetails?.firstName || ''
                    const lastName = leave?.userId?.personalDetails?.lastName || ''
                    return regex.test(`${firstName} ${lastName}`) || regex.test(firstName) || regex.test(lastName)
                })
            }

            totalLeaveRequests = leaveRequests.length
            allLeaveRequests = leaveRequests.slice(skip, skip + limit)

            let selectionDurationType = ['First-Half', 'Second-Half', 'Multiple', 'Full-Day']
            const formattedLeaves = allLeaveRequests.length > 0 ? allLeaveRequests.map(leave => ({
                ...leave.toObject(),
                userId: leave?.userId?._id,
                userName: `${leave?.userId?.personalDetails?.lastName ? `${leave?.userId?.personalDetails?.firstName} ${leave?.userId?.personalDetails?.lastName}` : `${leave?.userId?.personalDetails?.firstName}`}`,
                selectionDuration: selectionDurationType.includes(leave?.selectionDuration) ? leave?.selectionDuration : `${leave?.selectionDuration} Hours`,
                totalRequestedLeaves: selectionDurationType.includes(leave?.selectionDuration) ? leave?.totalLeaveDays : leave?.totalLeaveHours,
                totalApprovedLeaves: selectionDurationType.includes(leave?.selectionDuration) ? leave?.numberOfApproveLeaves : leave?.numberOfApproveLeaveHours,
            })) : []

            return res.send({
                status: 200,
                message: 'All leave requests fetched successfully.',
                allLeaveRequests: formattedLeaves.length > 0 ? formattedLeaves : [],
                totalLeaveRequests,
                totalPages: Math.ceil(totalLeaveRequests / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching own company employees leave requests:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching own company employees leave requests!' })
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
    //     if(allowedRoles.includes(req.user.role)){
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50

    //         const skip = ( page - 1 ) * limit

    //         let allLeaveRequests
    //         let totalLeaveRequests
            
    //         if(req.user.role == 'Superadmin'){
    //             const allLeaveRequestsOfAdmin = await Leave.find({ isDeleted: { $ne: true } }).populate('userId', 'personalDetails.firstName personalDetails.lastName').sort({ createdAt: -1 })

    //             let allAdminLR = []
    //             for(const LR of allLeaveRequestsOfAdmin){
    //                 const existingUser = await User.findOne({ _id: LR.userId, isDeleted: { $ne: true } })
    //                 if (existingUser.role === 'Administrator') {
    //                     allAdminLR.push(LR)
    //                 }
    //             }
    //             allLeaveRequests = allAdminLR.slice(skip, skip + limit)
    //             totalLeaveRequests = allAdminLR?.length
    //         } else if(req.user.role == 'Administrator'){
    //             const allLeaveRequestsOfEmployees = await Leave.find({
    //                 companyId: req.user.companyId,
    //                 locationId: { $in: req.user.locationId },
    //                 isDeleted: { $ne: true }
    //             }).populate('userId', 'personalDetails.firstName personalDetails.lastName').sort({ createdAt: -1 })

    //             let allEmployeesLR = []
    //             for (const LR of allLeaveRequestsOfEmployees) {
    //                 const existingUser = await User.findOne({ _id: LR.userId, isDeleted: { $ne: true } })
    //                 if (existingUser.role === 'Manager') {
    //                     allEmployeesLR.push(LR)
    //                 }
    //             }
    //             allLeaveRequests = allEmployeesLR.slice(skip, skip + limit)
    //             totalLeaveRequests = allEmployeesLR?.length
    //         } else if(req.user.role == 'Manager'){
    //             const employees = await User.find({
    //                 jobDetails: { $elemMatch: { assignManager: req.user._id.toString() } },
    //                 isDeleted: { $ne: true }
    //             }).select("_id")

    //             const employeeIds = employees.map(emp => emp._id)

    //             const leaveRequests = await Leave.find({
    //                 userId: { $in: employeeIds },
    //                 companyId: req.user.companyId,
    //                 locationId: { $in: req.user.locationId },
    //                 isDeleted: { $ne: true }
    //             }).populate('userId', 'personalDetails.firstName personalDetails.lastName').sort({ createdAt: -1 });

    //             allLeaveRequests = leaveRequests.slice(skip, skip + limit)
    //             totalLeaveRequests = leaveRequests.length
    //         }

    //         const formattedLeaves = allLeaveRequests.length > 0 ? allLeaveRequests.map(leave => ({
    //             ...leave.toObject(),
    //             userName: `${leave?.userId?.personalDetails?.lastName ? `${leave?.userId?.personalDetails?.firstName} ${leave?.userId?.personalDetails?.lastName}` : `${leave?.userId?.personalDetails?.firstName}`}`,
    //             userId: leave?.userId?._id
    //         })) : []

    //         return res.send({
    //             status: 200,
    //             message: 'All leave requests fetched successfully.',
    //             allLeaveRequests: formattedLeaves.length > 0 ? formattedLeaves : [],
    //             totalLeaveRequests,
    //             totalPages: Math.ceil(totalLeaveRequests / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while fetching own company employees leave requests:', error)
    //     return res.send({ status: 500, message: 'Error occurred while fetching own company employees leave requests!' })
    // }
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

            let paidLeaveBalance

            leaveCountResponse?.leaveCount.map(leaveCount => {
                if(leaveCount?.leaveType == leaveType){
                    paidLeaveBalance = leaveCount?.count
                }
            })

            // const remainingLeaves = leaveCountResponse.leaveCount
            // let paidLeaveBalance = remainingLeaves[leaveType].count || 0

            const holidays = await Holiday.find({
                companyId: user.companyId,
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
            // let weekends = 0
            let holidaysInLeavePeriod = 0

            for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'days')) {
                let formattedDate = date.format('YYYY-MM-DD')

                // if (date.isoWeekday() === 6 || date.isoWeekday() === 7) {
                //     weekends++
                //     continue
                // }

                if (holidayDates.includes(formattedDate)) {
                    holidaysInLeavePeriod++
                    continue
                }

                effectiveLeaveDays++
            }

            if (effectiveLeaveDays <= 0) {
                return res.send({ status: 400, message: "Selected leave period contains holidays, no leave required!" })
            }

            let leaveDays
            let leaveHours
            if (selectionDuration === 'First-Half' || selectionDuration === 'Second-Half') {
                leaveDays = 0.5
            } else if (selectionDuration === 'Multiple') {
                leaveDays = effectiveLeaveDays
            } else if(selectionDuration === 'Full-Day'){
                leaveDays = 1
            } else {
                leaveHours = parseInt(selectionDuration)
            }

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
                    } else if(selectionDuration === 'Full-Day' || selectionDuration === 'Multiple') {
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
                    } else {
                        if(paidLeaveBalance > 0){
                            isPaidLeave = true;
                            paidLeaveBalance -= parseInt(selectionDuration);
                            usedPaidLeave += parseInt(selectionDuration);
                        } else {
                            usedPaidLeave += parseInt(selectionDuration);
                        }

                        leaves.push({
                            leaveDate,
                            leaveType,
                            isPaidLeave,
                            isHourlyLeave: true,
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
                        totalLeaveHours: leaveHours,
                        leaves,
                        reasonOfLeave,
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Leave request updated successfully', updatedLeaveRequest })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating leave request:', error)
        return res.send({ status: 500, message: 'Error occurred while updating leave request!' })
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
        return res.send({ status: 500, message: 'Error occurred while deleting leave request!' })
    }
}

exports.approveLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const leaveRequestId = req.params.id
            const { leaves, approvalReason, approvedLeaveHours } = req.body

            // if(!approvalReason){
            //     return res.send({ status: 400, message: 'Approval reason is required' })
            // }

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
                    } else if(leave.selectionDuration === 'Full-Day' || leave.selectionDuration === 'Multiple') {
                        approvedLeavesCount += 1
                    }
                }
            })
            // console.log('approvedLeavesCount:', approvedLeavesCount)

            leave.status = 'Approved'
            leave.numberOfApproveLeaves = approvedLeavesCount
            leave.numberOfApproveLeaveHours = approvedLeaveHours ? approvedLeaveHours : isNaN(parseInt(leave.selectionDuration)) ? 0 : parseInt(leave.selectionDuration)
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

            let notificationMessage = `${firstName} ${lastName} has approved your ${leave.leaveType} leave request.${ approvalReason ? `( Reason: ${approvalReason} )` : '' }`
            if (approvedLeavesCount < leave?.totalLeaveDays) {
                notificationMessage = `${firstName} ${lastName} has partially approved your ${leave.leaveType} leave request [ Approved : ${approvedLeavesCount} and Rejected : ${leave?.totalLeaveDays - approvedLeavesCount} ]. ${ approvalReason ? ` ( Reason: ${approvalReason} )` : '' }`
            }

            const notification = new Notification({
                userId: req.user._id,
                // userName: `${firstName} ${lastName}`,
                companyId: leave?.companyId,
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
        return res.send({ status: 500, message: 'Error occurred while approving leave request!' })
    }
}

exports.rejectLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const leaveRequestId = req.params.id
            const { rejectionReason } = req.body

            // if(!rejectionReason){
            //     return res.send({ status: 400, message: 'Rejection reason is required' })
            // }

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
            leave.numberOfApproveLeaveHours = 0
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

            const notification = new Notification({
                userId: req.user._id,
                // userName: `${firstName} ${lastName}`,
                companyId: leave?.companyId,
                notifiedId,
                type: 'Leave Request Reject',
                message: `${firstName} ${lastName} has reject your ${leave.leaveType} leave request. ${rejectionReason ? `( Reason: ${rejectionReason} )` : ''}`,
                readBy
            })
            // console.log('notification/..', notification)
            
            await notification.save()
            return res.send({ status: 200, message: 'Leave request rejected.', leave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while rejecting leave request:', error)
        return res.send({ status: 500, message: 'Error occurred while rejecting leave request!' })
    }
}
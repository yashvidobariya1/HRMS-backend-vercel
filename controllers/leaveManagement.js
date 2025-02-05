const Leave = require('../models/leaveRequest')
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
                leaveDays,
                reasonOfLeave,
                isPaidLeave,
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
            if(remainingLeaves[leaveType] !== 0){
                if (remainingLeaves[leaveType] < leaveDays) {
                    return res.send({ status: 400, message: 'Leave limit exceeded for the selected leave type.' })
                }
            }

            let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 401, message: 'JobTitle not found!' })
            }
            let locationId = jobDetail?.location

            const existLeave = await Leave.findOne({
                userId,
                jobId,
                startDate,
                status: 'Pending'
            })

            if (existLeave) {
                return res.status(400).json({ status: 400, message: 'You already have a leave request for this period!' });
            }

            let firstName = req.user?.personalDetails?.firstName || ''
            let lastName = req.user?.personalDetails?.lastName || ''

            let leaves = [];
            if (selectionDuration === 'Multiple') {
                const start = moment(startDate)
                const end = moment(endDate)
                
                const totalDays = end.diff(start, 'days') + 1
            
                leaves = Array.from({ length: totalDays }, (_, index) => ({
                    leaveDate: start.clone().add(index, 'days').format('YYYY-MM-DD'),
                    leaveType,
                }))
            } else {
                leaves.push({
                    leaveDate: moment(startDate).format('YYYY-MM-DD'),
                    leaveType,
                })
            }

            const newLeave = await Leave.create({
                userId: req.user.id,
                jobId,
                userName: `${firstName} ${lastName}`,
                userEmail: req.user?.personalDetails?.email,
                companyId: req.user?.companyId,
                locationId,
                leaveType,
                selectionDuration,
                startDate,
                endDate,
                leaveDays,
                leaves,
                reasonOfLeave,
                isPaidLeave,
                status: 'Pending',
            })

            // ---------------send notification---------------
            let notifiedId = []
            let readBy = []
            if (req.user.role === 'Employee') {
                if (jobDetail && jobDetail.assignManager) {
                    const assignManager = await User.find({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
                    // console.log('assignManager', assignManager)
                    notifiedId.push(jobDetail.assignManager);
                    readBy.push({
                        userId: jobDetail.assignManager,
                        role: assignManager[0].role
                    })
                    // console.log('readBy1/..', readBy)
                }

                const administrator = await User.find({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
                // console.log('administrator', administrator)
                if (administrator.length > 0) {
                    notifiedId.push(administrator[0]._id);
                    readBy.push({
                        userId: administrator[0]._id,
                        role: administrator[0].role
                    })
                }
            } else if (req.user.role === 'Manager') {
                const administrator = await User.find({ role: 'Administrator', companyId: user?.companyId, isDeleted: { $ne: true } });
                if (administrator.length > 0) {
                    notifiedId.push(administrator[0]._id);
                    readBy.push({
                        userId: administrator[0]._id,
                        role: administrator[0].role
                    })
                }
            } else if (req.user.role === 'Administrator' && user?.creatorId) {
                notifiedId.push(user.creatorId);
                readBy.push({
                    userId: user.creatorId,
                    role: user.createdBy
                })
            }

            const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            superAdmin.map((sa) => {
                notifiedId.push(sa?._id)
                readBy.push({
                    userId: sa?._id,
                    role: sa?.role
                })
            })

            const notification = new Notification({
                userId,
                userName: `${firstName} ${lastName}`,
                notifiedId,
                type: 'Leave request',
                message: `${firstName} ${lastName} has submitted a ${leaveType} leave request ${endDate ? `from ${startDate} to ${endDate}.` : `on ${startDate}.`}`,
                readBy
            });
            // console.log('notification/..', notification)
            await notification.save();

            return res.send({ status:200, message: 'Leave request submitted.', newLeave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while leaving request.', error)
        res.send({ message: 'Error occurred while leaving request!' })
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
                return res.send({ status: 401, message: 'JobTitle not found' });
            }

            const allLeaves = await Leave.find({ userId, jobId, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit)

            const totalLeaves = await Leave.find({ userId, jobId, isDeleted: { $ne: true } }).countDocuments()
            
            return res.send({
                status: 200,
                message: 'All leave requests getted successfully.',
                allLeaves,
                totalLeaves,
                totalPages: Math.ceil(totalLeaves / limit),
                currentPage: page
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while getting all leaves requests:', error)
        res.send({ message: 'Error occurred while getting all leave requests!' })
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
                return res.send({ status: 401, message: 'JobTitle not found' });
            }

            const currentYear = new Date().getFullYear()
            const startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0)
            const endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999)

            const allLeavesOfUser = await Leave.find({
                userId,
                status: 'Approved',
                jobId,
                isDeleted: { $ne: true },
                createdAt: { $gte: startDate, $lte: endDate }
            })

            const leaveCountByType = allLeavesOfUser.reduce((acc, leave) => {
                const leaveDays = parseFloat(leave.leaveDays)
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
        console.error('Error occurred while getting leave count:', error)
        res.send({ message: 'Error occurred while getting leave count!' })
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
                allLeaveRequests = await Leave.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit)
                totalLeaveRequests = await Leave.find({ isDeleted: { $ne: true } }).countDocuments()
            } else if(req.user.role == 'Administrator'){
                allLeaveRequests = await Leave.find({
                    companyId: req.user.companyId,
                    locationId: { $in: req.user.locationId },
                    isDeleted: { $ne: true }
                }).sort({ createdAt: -1 }).skip(skip).limit(limit)

                totalLeaveRequests = await Leave.find({
                    companyId: req.user.companyId,
                    locationId: { $in: req.user.locationId },
                    isDeleted: { $ne: true }
                }).countDocuments()
            } else if(req.user.role == 'Manager'){
                const leaveRequests = await Leave.find({
                    companyId: req.user.companyId,
                    locationId: { $in: req.user.locationId },
                    isDeleted: { $ne: true }
                }).sort({ createdAt: -1 }).skip(skip).limit(limit)

                let allEmployeesLR = []
                for (const LR of leaveRequests) {
                    const existingUser = await User.findOne({ _id: LR.userId })
                    if (existingUser.role === 'Employee') {
                        allEmployeesLR.push(LR)
                    }
                }
                allLeaveRequests = allEmployeesLR
                totalLeaveRequests = allEmployeesLR.length
            }

            return res.send({
                status: 200,
                message: 'All leave requests getted successfully.',
                allLeaveRequests: allLeaveRequests ? allLeaveRequests : [],
                totalLeaveRequests,
                totalPages: Math.ceil(totalLeaveRequests / limit),
                currentPage: page
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while getting own company employees leave requests:', error)
        res.send({ message: 'Error occurred while getting own company employees leave requests!' })
    }
}

exports.updateLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const LRId = req.params.id
            const {
                leaveType,
                slectionDuration,
                startDate,
                endDate,
                leaveDays,
                reasonOfLeave,
                isPaidLeave,
            } = req.body
            const leaveRequest = await Leave.findOne({_id: LRId, isDeleted: { $ne: true }})
            if(!leaveRequest){
                return res.send({ status: 404, message: 'Leave request not found' })
            }
            if(leaveRequest.status !== 'Pending'){
                return res.send({ status: 403, message: `Leave request has already been ${leaveRequest.status}.` })
            }

            const updatedLeaveRequest = await Leave.findByIdAndUpdate(
                { _id: LRId },
                {
                    $set: {
                        leaveType,
                        slectionDuration,
                        startDate,
                        endDate,
                        leaveDays,
                        reasonOfLeave,
                        isPaidLeave,
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Leave request update successfully', updatedLeaveRequest })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating leave request:', error)
        res.send({ message: 'Error occurred while updating leave request!' })
    }
}

// pending work
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
            const { updates, approvalReason } = req.body

            const leave = await Leave.findOne({ _id: leaveRequestId, isDeleted: { $ne: true } })

            if (!leave) {
                return res.send({ status: 404, message: 'Leave request not found.' })
            }

            if(leave.selectionDuration == 'Multiple'){
                updates.forEach(update => {
                    const leaveDay = leave.leaves.find(leave => leave.leaveDate === update.date);
                    if (leaveDay) {
                        leaveDay.isApproved = update.isApproved
                    }
                })
            } else {
                leave.leaves[0].isApproved = true
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
            let firstName = req.user.personalDetails.firstName
            let lastName = req.user.personalDetails.lastName

            let notifiedId = []
            let readBy = []

            const existingUser = await User.findOne({ _id: leave.userId, isDeleted: { $ne: true } })
            if(!existingUser){
                return res.send({ status: 404, message: 'User not found.' })
            }

            notifiedId.push(existingUser?._id)
            readBy.push({
                userId: existingUser?._id,
                role: existingUser?.role
            })

            const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            superAdmin.map((sa) => {
                notifiedId.push(sa?._id)
                readBy.push({
                    userId: sa?._id,
                    role: sa?.role
                })
            })

            const notification = new Notification({
                userId: req.user._id,
                notifiedId,
                type: 'Leave request approveral',
                message: `${firstName} ${lastName} has approved your ${leave.leaveType} leave request.`,
                readBy
            })
            // console.log('notification/..', notification)

            await notification.save()
            return res.send({ status: 200, message: 'Leave request approved.', leave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while accepting leave request:', error)
        return res.send({ message: 'Error occurred while accepting leave request!' })
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

            leave.status = 'Rejected'
            leave.numberOfApproveLeaves = 0
            leave.rejectionReason = rejectionReason
            leave.rejectorId = req.user._id
            leave.rejectorRole = req.user.role
            await leave.save()

            // ---------------send notification---------------
            let firstName = req.user.personalDetails.firstName
            let lastName = req.user.personalDetails.lastName

            let notifiedId = []
            let readBy = []

            const existingUser = await User.findOne({ _id: leave.userId, isDeleted: { $ne: true } })
            if(!existingUser){
                return res.send({ status: 404, message: 'User not found.' })
            }

            notifiedId.push(existingUser?._id)
            readBy.push({
                userId: existingUser?._id,
                role: existingUser?.role
            })

            const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            superAdmin.map((sa) => {
                notifiedId.push(sa?._id)
                readBy.push({
                    userId: sa?._id,
                    role: sa?.role
                })
            })

            const notification = new Notification({
                userId: req.user._id,
                notifiedId,
                type: 'Leave request reject',
                message: `${firstName} ${lastName} has reject your ${leave.leaveType} leave request.`,
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
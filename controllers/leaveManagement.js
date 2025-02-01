const Leave = require('../models/leaveRequest')
const Notification = require('../models/notification')
const User = require('../models/user')

exports.leaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.user._id

            const user = await User.findById(userId)
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const {
                leaveType,
                jobTitle,
                selectionDuration,
                startDate,
                endDate,
                leaveDays,
                reasonOfLeave,
                isPaidLeave,
            } = req.body

            let jobDetail = user?.jobDetails.find((job) => job.jobTitle === jobTitle)
            let locationId = jobDetail.location

            const existLeave = await Leave.findOne({
                userId,
                startDate,
                status: 'Pending'
            })

            if (existLeave) {
                return res.status(400).json({ status: 400, message: 'You already have a leave request for this period!' });
            }

            let firstName = req.user?.personalDetails?.firstName || ''
            let lastName = req.user?.personalDetails?.lastName || ''

            const newLeave = await Leave.create({
                userId: req.user.id,
                jobTitle,
                userName: `${firstName} ${lastName}`,
                userEmail: req.user?.personalDetails?.email,
                companyId: req.user?.companyId,
                locationId,
                leaveType,
                selectionDuration,
                startDate,
                endDate,
                leaveDays,
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
                message: `${firstName} ${lastName} has submitted a ${leaveType} leave request from ${startDate} to ${endDate}.`,
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
            const allLeaves = await Leave.find({ userId }).skip(skip).limit(limit)

            const totalLeaves = await Leave.countDocuments({ userId })

            if(!allLeaves){
                return res.send({ status: 404, message: 'Leaves not found' })
            }
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
            const { jobTitle } = req.body
            const userId = req.user._id
            const user = await User.findById(userId)

            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }
            
            const jobExists = user.jobDetails.some(job => job.jobTitle === jobTitle);
            if (!jobExists) {
                return res.send({ status: 404, message: 'Job title not found' });
            }

            const currentYear = new Date().getFullYear()
            const startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0)
            const endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999)

            const allLeavesOfUser = await Leave.find({
                userId,
                status: 'Approved',
                jobTitle,
                createdAt: { $gte: startDate, $lte: endDate }
            })

            const leaveCountByType = allLeavesOfUser.reduce((acc, leave) => {
                acc[leave.leaveType] = (acc[leave.leaveType] || 0) + 1;
                return acc;
            }, {});

            let jobDetails = user.jobDetails.find(job => job.jobTitle === jobTitle) || user.jobDetails[0]
            console.log('jobDetails/..', jobDetails)

            const totalSickLeaves = jobDetails.sickLeavesAllow
            const totalAllowLeaves = jobDetails.leavesAllow

            let leaveCount ={
                Causal: (leaveCountByType.Causal) ? ( totalAllowLeaves - (leaveCountByType.Causal) ) : totalAllowLeaves,
                Sick: (leaveCountByType.Sick) ? ( totalSickLeaves - (leaveCountByType.Sick) ) : totalSickLeaves
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
            
            if(req.user.role == 'Superadmin'){
                // superadmin can get all leave requests
                const allLeaveRequests = await Leave.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit)

                const totalLeaveRequests = await Leave.countDocuments()
                if(!allLeaveRequests){
                    return res.send({ status: 404, message: 'Leave requests not found' })
                }
                return res.send({
                    status: 200,
                    message: 'All leave requests getted successfully.',
                    allLeaveRequests,
                    totalLeaveRequests,
                    totalPages: Math.ceil(totalLeaveRequests / limit),
                    currentPage: page
                })
            } else if(req.user.role == 'Administrator'){
                // administrator can get all leave requests of own company
                const allLeaveRequests = await Leave.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit)
                const totalLeaveRequests = await Leave.countDocuments({ companyId: req.user.companyId })
                return res.send({
                    status: 200,
                    message: 'All leave requests getted successfully.',
                    allLeaveRequests,
                    totalLeaveRequests,
                    totalPages: Math.ceil(totalLeaveRequests / limit),
                    currentPage: page
                })
            } else if(req.user.role == 'Manager'){
                // manager can get all leave requests of thier company
                const allLeaveRequests = await Leave.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit)
                let allEmployeesLR = []
                for (const LR of allLeaveRequests) {
                    const existingUser = await User.findOne({ _id: LR.userId })
                    if (existingUser.role === 'Employee') {
                        allEmployeesLR.push(LR)
                    }
                }
                const totalLeaveRequests = allEmployeesLR.length
                return res.send({
                    status: 200,
                    message: 'All leave requests getted successfully.',
                    allLeaveRequests: allEmployeesLR,
                    totalLeaveRequests,
                    totalPages: Math.ceil(totalLeaveRequests / limit),
                    currentPage: page
                })
            }
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
            const leaveRequest = await Leave.findOne({_id: LRId, status: 'Pending'})
            if(!leaveRequest){
                return res.send({ status: 404, message: 'Leave request not found' })
            }

            if(leaveRequest.status !== 'Pending'){
                return res.send({ status: 403, message: 'Leave request is not in pending status' })
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
                return res.send({ status: 404, messgae: 'Leave request not found' })
            }
            if(leave.status !== 'Pending'){
                return res.send({ status: 403, message: 'Leave request is not in pending status' })
            }

            leave.isDeleted = true
            await leave.save()

            return res.send({ status: 200, messgae: 'Leave reuqest deleted successfully.' })
        } else return res.send({ status: 403, messgae: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deleting leave reqest:', error)
        res.send({ messgae: 'Error occurred while deleting leave request!' })
    }
}

exports.approveLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const leaveRequestId = req.params.id
            const { approvalReason } = req.body

            const leave = await Leave.findOne({ _id: leaveRequestId, status: 'Pending' })

            if (!leave) {
                return res.send({ status: 404, message: 'Leave request not found.' })
            }

            leave.status = 'Approved'
            leave.approvalReason = approvalReason
            leave.approverId = req.user._id
            leave.approverRole = req.user.role
            await leave.save()

            // ---------------send notification---------------
            let firstName = req.user.personalDetails.firstName
            let lastName = req.user.personalDetails.lastName

            let notifiedId = []
            let readBy = []

            const existingUser = await User.findById(leave.userId)
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

            const leave = await Leave.findOne({ _id: leaveRequestId, status: 'Pending' })

            if (!leave) {
                return res.send({ status: 404, message: 'Leave request not found.' })
            }

            leave.status = 'Rejected'
            leave.rejectionReason = rejectionReason
            leave.rejectorId = req.user._id
            leave.rejectorRole = req.user.role
            await leave.save()

            // ---------------send notification---------------
            let firstName = req.user.personalDetails.firstName
            let lastName = req.user.personalDetails.lastName

            let notifiedId = []
            let readBy = []

            const existingUser = await User.findById(leave.userId)
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
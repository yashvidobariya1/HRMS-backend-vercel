const Leave = require('../models/leaveRequest')

exports.leaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const {
                leaveType,
                slectionDuration,
                startDate,
                endDate,
                leaveDays,
                reasonOfLeave,
                isPaidLeave,
            } = req.body
            const leave = await Leave.findOne({ where: { userId: req.user.id, startDate, endDate } })
            if (!leave) {
                let firstName = req.user?.personalDetails?.firstName || ''
                let lastName = req.user?.personalDetails?.lastName || ''
                const newLeave = await Leave.create({
                    userId: req.user.id,
                    userName: `${firstName} ${lastName}`,
                    userEmail: req.user?.personalDetails?.email,
                    companyId: req.user?.companyId,
                    locationId: req.user?.locationId,
                    leaveType,
                    slectionDuration,
                    startDate,
                    endDate,
                    leaveDays,
                    reasonOfLeave,
                    isPaidLeave,
                    status: 'Pending',
                })
                return res.send({ status:200, message: 'Leave request submitted.', newLeave })
            } else {
                return res.send({ status: 400, message: 'You already have a leave request for this day!' })
            }
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
                message: 'All leave requests get successfully.',
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

exports.getAllLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = ( page - 1 ) * limit
            const allLeaveRequests = await Leave.find().skip(skip).limit(limit)

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
        } else return res.send({ status: 403, messgae: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while getting all leave requests.', error)
        res.send({ message: 'Error occurred while getting all leave requests!' })
    }
}

// pending work
exports.getAllOwnCompanyEmployeesLR = async (req, res) => {
    // try {
    //     const allowedRoles = ['Administrator', 'Manager']
    //     if(allowedRoles.includes(req.user.role)){
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 10

    //         const skip = ( page - 1 ) * limit
            
    //         if(req.user.role == 'Administrator'){
    //             const allLeaveRequests = await Leave.find({ companyId: req.user.companyId }).skip(skip).limit(limit)
    //             const totalLeaveRequests = await Leave.countDocuments({ companyId: req.user.companyId })
    //             return res.send({
    //                 status: 200,
    //                 message: 'All leave requests getted successfully.',
    //                 allLeaveRequests,
    //                 totalLeaveRequests,
    //                 totalPages: Math.ceil(totalLeaveRequests / limit),
    //                 currentPage: page
    //             })
    //         } else if(req.user.role == 'Manager'){
    //             const allLeaveRequests = await Leave.find({ companyId: req.user.companyId })
    //             let allEmployeesLR = []
    //             allLeaveRequests.map((LR) => {
                    
    //             })
    //         }
    //     } else return res.send({ status: 403, messgae: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while getting own company employees leave requests:', error)
    //     res.send({ message: 'Error occurred while getting own company employees leave requests!' })
    // }
}

// pending work
exports.updateLeaveRequest = async (req, res) => {
    // try {
    //     const allowedRoles = ['Administrator', 'Manager', 'Employee']
    //     if(allowedRoles.includes(req.user.role)){
    //         const LRId = req.params.id
    //         const {
    //             leaveType,
    //             slectionDuration,
    //             startDate,
    //             endDate,
    //             leaveDays,
    //             reasonOfLeave,
    //             isPaidLeave,
    //         } = req.body
    //         const leaveRequest = await Leave.findById(LRId)
    //         if(!leaveRequest){
    //             return res.send({ status: 404, message: 'Leave request not found' })
    //         }

    //         const updatedLeaveRequest = await Leave.findByIdAndUpdate(
    //             { _id: LRId },
    //             {
    //                 $set: {
    //                     leaveType,
    //                     slectionDuration,
    //                     startDate,
    //                     endDate,
    //                     leaveDays,
    //                     reasonOfLeave,
    //                     isPaidLeave,
    //                 }
    //             }, { new: true }
    //         )

    //         return res.send({ status: 200, message: 'Leave request update successfully', updatedLeaveRequest })
    //     } else return res.send({ status: 403, messgae: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while updating leave request:', error)
    //     res.send({ message: 'Error occurred while updating leave request!' })
    // }
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
            return res.send({ status: 200, message: 'Leave request rejected.', leave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while rejecting leave request:', error)
        return res.send({ message: 'Error occurred while rejecting leave request!' })
    }
}
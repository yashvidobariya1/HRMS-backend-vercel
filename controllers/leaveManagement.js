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

// show pending leave request in user panel ( count pending leave requests )
// administrator and manager are aprove or reject leave request
// if leave request from manager then they show only administrator and leave request from employee then they show in administrator and manager
// show leave history in user panel
// show leave history in administartor panel

exports.approveLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const leaveRequestId = req.params.id
            const { approvalReason } = req.body
            const leave = await Leave.find({ _id: leaveRequestId, status: 'Pending' })
            if (!leave) {
                return res.send({ status: 404, message: 'Leave request not found.' })
            }
            leave.status = 'Approved'
            leave.approvalReason = approvalReason
            leave.approverId = req.user._id
            leave.approverRole = req.user.role
            leave.save()
            return res.send({ status: 200, message: 'Leave request approved.', leave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while accepting leave request:', error)
        return res.send({ message: 'Error occurred while accepting leave request!' })
    }
}

exports.rejectLeaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const leaveRequestId = req.params.id
            const { rejectionReason } = req.body
            const leave = await Leave.find({ _id: leaveRequestId, status: 'Pending' })
            if (!leave) {
                return res.send({ status: 404, message: 'Leave request not found.' })
            }
            leave.status = 'Rejected'
            leave.rejectionReason = rejectionReason
            leave.rejectorId = req.user._id
            leave.rejectorRole = req.user.role
            leave.save()
            return res.send({ status: 200, message: 'Leave request rejected.', leave })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while rejecting leave request:', error)
        return res.send({ message: 'Error occurred while rejecting leave request!' })
    }
}
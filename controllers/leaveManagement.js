const Leave = require('../models/leaveRequest')

exports.leaveRequest = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const {
                leaveType,
                startDate,
                endDate,
                reason,
            } = req.body
            const leave = await Leave.findOne({ where: { userId: req.user.id, leaveType, startDate, endDate } })
            if (leave) {
                leave.update({ status: 'Rejected' })
                res.json({ message: 'Leave request rejected' })
            } else {
                const newLeave = await Leave.create({
                    employeeId: req.user.id,
                    leaveType,
                    startDate,
                    endDate,
                    reason,
                    status: 'Pending',
                })
                res.json({ message: 'Leave request submitted', newLeave })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while leaving request.', error)
        res.send({ message: 'Error occurred while leaving request!' })
    }
}
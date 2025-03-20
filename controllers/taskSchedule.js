const Task = require('../models/task')
const TaskSchedule = require('../models/taskSchedule')

exports.assignTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const {
                users,
                assignedTask
            } = req.body

            const task = await Task.findOne({ _id: assignedTask, isDeleted: { $ne: true } })
            if(!task){
                return res.send({ status: 404, message: 'Task not found' })
            }

            const newTask = {
                users,
                startDate: task?.startDate,
                startTime: task?.startTime,
                endDate: task?.endDate,
                endTime: task?.endTime,
                assignedTask,
                assignedBy: req.user.role,
                assignerId: req.user._id
            }

            const taskSchedule = await TaskSchedule.create(newTask)

            return res.send({ status: 200, message: 'Task schedule assign successfully', taskSchedule })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while assigning the task:', error)
        res.send({ message: 'Error occurred while assigning the task!' })
    }
}

exports.getAssignedTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id

            const assignedTask = await TaskSchedule.findOne({ _id: taskId, isDeleted: { $ne: true } })
            if(!assignedTask){
                return res.send({ status: 404, message: 'Assigned task not found' })
            }

            return res.send({ status: 200, message: 'Assigned task fetched successfully', assignedTask })            
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occured while fetching the scheduled task:', error)
        res.send({ message: 'Error occurred while fetching the scheduled task!' })
    }
}

exports.getAllAssignedTasks = async (req, res) => {
    try {
        const allowedRoles = ['Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            const tasks = await TaskSchedule.find({ "users.userId": req.user._id, isDeleted: { $ne: true } }).skip(skip).limit(limit)
            const totalTasks = await TaskSchedule.find({ "users.userId": req.user._id, isDeleted: { $ne: true } }).countDocuments()

            return res.send({
                status: 200,
                message: 'All tasks fetched successfully',
                tasks,
                totalTasks,
                totalPages: Math.ceil(totalTasks / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching scheduled tasks:', error)
        res.send({ message: 'Error occurred while fetching scheduled tasks!' })
    }
}

// test pending
exports.updateAssignedTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id
            const {
                users
            } = req.body

            const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
            if(!task){
                return res.send({ status: 404, message: 'Task not found' })
            }

            const updatedAssignedTask = await Task.findOneAndUpdate(
                { _id: taskId, isDeleted: { $ne: true } },
                {
                    $set: {
                        users
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Task updated successfully', updatedAssignedTask })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating the scheduled task:', error)
        res.send({ message: 'Error occurred while updating the scheduled task!' })
    }
}

// pending
exports.completeAssignedTask = async (req, res) => {
    try {
        const allowedRoles = ['Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while completing the schedule:', error)
        res.send({ message: 'Error occurred while completing the schedule!' })
    }
}

// pending
exports.cancelAssignedTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while canceling the schedule:', error)
        res.send({ message: 'Error occurred while canceling the schedule!' })
    }
}
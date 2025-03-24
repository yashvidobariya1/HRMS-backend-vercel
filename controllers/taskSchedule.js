const Task = require('../models/task')
const TaskSchedule = require('../models/taskSchedule')
const moment = require('moment')

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

            return res.send({ status: 200, message: 'Task assign successfully', taskSchedule })
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
        console.error('Error occured while fetching the task:', error)
        res.send({ message: 'Error occurred while fetching the task!' })
    }
}

exports.getAllAssignedTasks = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            const tasks = await TaskSchedule.find({ "users.userId": req.user._id, isDeleted: { $ne: true } }).skip(skip).limit(limit)
            const totalTasks = await TaskSchedule.find({ "users.userId": req.user._id, isDeleted: { $ne: true } }).countDocuments()

            return res.send({
                status: 200,
                message: 'All assigned tasks fetched successfully',
                tasks,
                totalTasks,
                totalPages: Math.ceil(totalTasks / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching tasks:', error)
        res.send({ message: 'Error occurred while fetching tasks!' })
    }
}

// test pending work
exports.updateAssignedTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const assignedTaskId = req.params.id
            const {
                users
            } = req.body

            const task = await TaskSchedule.findOne({ _id: assignedTaskId, isDeleted: { $ne: true } })
            if(!task){
                return res.send({ status: 404, message: 'Assigned task not found' })
            }

            const updatedAssignedTask = await TaskSchedule.findOneAndUpdate(
                { _id: assignedTaskId, isDeleted: { $ne: true } },
                {
                    $set: {
                        users
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Assigned task updated successfully', updatedAssignedTask })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating the task:', error)
        res.send({ message: 'Error occurred while updating the task!' })
    }
}

// pending work
exports.completeAssignedTask = async (req, res) => {
    try {
        const allowedRoles = ['Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const assignedTaskId = req.params.id

            const assignedTask = await TaskSchedule.findOne({ _id: assignedTaskId, isDeleted: { $ne: true } })
            if(!assignedTask){
                return res.send({ status: 404, message: 'Assigned task not found' })
            }

            const isAssigned = assignedTask.users.find(user => user.userId == req.user._id.toString())
            if(!isAssigned){
                return res.send({ status: 400, message: 'You are not assigned to this task' })
            }

            assignedTask.users.map(user => {
                if(user.userId == req.user._id.toString() && user.taskStatus == 'Pending'){
                    user.taskStatus = 'Completed'
                }
            })

            await assignedTask.save()

            return res.send({ status: 200, message: 'Assigned task completed successfully', assignedTask })

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while completing the task:', error)
        res.send({ message: 'Error occurred while completing the task!' })
    }
}

// pending work
exports.cancelAssignedTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const { users } = req.body
            const assignedTaskId = req.params.id

            const assignedTask = await TaskSchedule.findOne({ _id: assignedTaskId, isDeleted: { $ne: true } })
            if(!assignedTask){
                return res.send({ status: 404, message: 'Assigned task not found' })
            }

            if (!users || users.length === 0) {
                return res.send({ status: 400, message: 'At least select one employee to cancel' })
            }

            assignedTask.users = assignedTask.users.filter(taskUser =>
                !users.some(reqUser => reqUser.userId === taskUser.userId.toString() && reqUser.jobId === taskUser.jobId.toString())
            )

            await assignedTask.save()

            return res.send({ status: 200, message: 'Selected users removed from assigned task', assignedTask })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while canceling the schedule:', error)
        res.send({ message: 'Error occurred while canceling the schedule!' })
    }
}

exports.deleteAssignedTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const assignedTaskId = req.params.id

            const assignedTask = await TaskSchedule.findOne({ _id: assignedTaskId, isDeleted: { $ne: true } })
            if(!assignedTask){
                return res.send({ status: 404, message: 'Assigned task not found' })
            }

            const deletedAssignedTask = await TaskSchedule.findOneAndUpdate(
                { _id: assignedTaskId, isDeleted: { $ne: true } },
                {
                    $set: {
                        status: 'Cancelled',
                        isDeleted: true,
                        canceledAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Assigned task deleted successfully', deletedAssignedTask })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deleting assigned task:', error)
        res.send({ message: 'Error occurred while deleting assigned task!' })
    }
}
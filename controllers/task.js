const Task = require('../models/task')
const moment = require('moment')

exports.createTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const {
                taskName,
                taskType,
                taskDescription,
                startDate,
                startTime,
                endDate,
                endTime,
                companyId,
                locationId
            } = req.body

            const newTask = {
                taskName,
                taskType,
                taskDescription,
                startDate,
                startTime,
                endDate,
                endTime,
                companyId,
                locationId,
                createdBy: req.user.role,
                creatorName: `${req.user?.personalDetails?.lastName ? `${req.user?.personalDetails?.firstName} ${req.user?.personalDetails?.lastName}` : `${req.user?.personalDetails?.firstName}`}`,
                creatorId: req.user._id
            }

            const task = await Task.create(newTask)

            return res.send({ status: 200, message: 'Task created successfully', task })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while creating the task:', error)
        res.send({ message: 'Error occurred while creating the task!' })
    }
}

exports.getTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id

            const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
            if(!task){
                return res.send({ status: 404, message: 'Task not found' })
            }

            return res.send({ status: 200, message: 'Task fetched successfully', task })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching the task:', error)
        res.send({ message: 'Error occurred while fetching the task!' })
    }
}

exports.getAllTasks = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            let tasks
            let totalTasks

            if(req.user.role == 'Superadmin'){
                tasks = await Task.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalTasks = await Task.find({ isDeleted: { $ne: true } }).countDocuments()
            } else if(req.user.role == 'Administrator'){
                tasks = await Task.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalTasks = await Task.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()
            } else if(req.user.role == 'Manager'){
                tasks = await Task.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, creatorId: req.user._id, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalTasks = await Task.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, creatorId: req.user._id, isDeleted: { $ne: true } }).countDocuments()
            }            

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
        console.error('Error occurred while fetching the task:', error)
        res.send({ message: 'Error occurred while fetching the task!' })
    }
}

exports.updateTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id
            const {
                taskName,
                taskType,
                taskDescription,
                startDate,
                endDate
            } = req.body

            const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
            if(!task){
                return res.send({ status: 404, message: 'Task not found' })
            }

            const updatedTask = await Task.findOneAndUpdate(
                { _id: taskId, isDeleted: { $ne: true } },
                {
                    $set: {
                        taskName,
                        taskType,
                        taskDescription,
                        startDate,
                        endDate
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Task updated successfully', updatedTask })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating the task:', error)
        res.send({ message: 'Error occurred while updating the task!' })
    }
}

exports.deleteTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id

            const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
            if(!task){
                return res.send({ status: 404, message: 'Task not found' })
            }

            const deletedTask = await Task.findOneAndUpdate(
                { _id: taskId, isDeleted: { $ne: true } },
                {
                    $set: {
                        isDeleted: true,
                        canceledAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Task deleted successfully', deletedTask })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deleting the task:', error)
        res.send({ message: 'Error occurred while deleting the task!' })
    }
}
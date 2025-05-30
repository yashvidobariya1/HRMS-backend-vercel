const Task = require('../models/task')
const moment = require('moment')
const User = require('../models/user')
const Client = require('../models/client')
const Location = require('../models/location')
const momentTimeZone = require('moment-timezone')
const { convertToEuropeanTimezone } = require('../utils/timezone')

// exports.createTask = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
//         if(allowedRoles.includes(req.user.role)){
//             const {
//                 taskName,
//                 taskType,
//                 taskDescription,
//                 startDate,
//                 startTime,
//                 endDate,
//                 endTime,
//                 companyId,
//                 locationId
//             } = req.body

//             const newTask = {
//                 taskName,
//                 taskType,
//                 taskDescription,
//                 startDate,
//                 startTime,
//                 endDate,
//                 endTime,
//                 companyId,
//                 locationId,
//                 createdBy: req.user.role,
//                 creatorName: `${req.user?.personalDetails?.lastName ? `${req.user?.personalDetails?.firstName} ${req.user?.personalDetails?.lastName}` : `${req.user?.personalDetails?.firstName}`}`,
//                 creatorId: req.user._id
//             }

//             const task = await Task.create(newTask)

//             return res.send({ status: 200, message: 'Task created successfully', task })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while creating the task:', error)
//         return res.send({ status: 500, message: 'Error occurred while creating the task!' })
//     }
// }

// exports.getTask = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user.role)){
//             const taskId = req.params.id

//             const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
//             if(!task){
//                 return res.send({ status: 404, message: 'Task not found' })
//             }

//             return res.send({ status: 200, message: 'Task fetched successfully', task })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while fetching the task:', error)
//         return res.send({ status: 500, message: 'Error occurred while fetching the task!' })
//     }
// }

// exports.getAllTasks = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
//         if(allowedRoles.includes(req.user.role)){
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 50

//             const skip = (page - 1) * limit

//             let tasks
//             let totalTasks

//             if(req.user.role == 'Superadmin'){
//                 tasks = await Task.find({ isDeleted: { $ne: true } }).populate('creatorId', 'personalDetails.firstName personalDetails.lastName').skip(skip).limit(limit)
//                 totalTasks = await Task.find({ isDeleted: { $ne: true } }).countDocuments()
//             } else if(req.user.role == 'Administrator'){
//                 tasks = await Task.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).populate('creatorId', 'personalDetails.firstName personalDetails.lastName').skip(skip).limit(limit)
//                 totalTasks = await Task.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()
//             } else if(req.user.role == 'Manager'){
//                 tasks = await Task.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, creatorId: req.user._id, isDeleted: { $ne: true } }).populate('creatorId', 'personalDetails.firstName personalDetails.lastName').skip(skip).limit(limit)
//                 totalTasks = await Task.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, creatorId: req.user._id, isDeleted: { $ne: true } }).countDocuments()
//             }            

//             let filteredTasks = tasks.map(task => ({
//                 ...task,
//                 createdBy: task?.creatorId?.personalDetails
//                     ? `${task?.creatorId?.personalDetails?.firstName} ${task?.creatorId?.personalDetails?.lastName || ''}`.trim()
//                     : '',
//                 creatorId: task?.creatorId?._id
//             }))

//             return res.send({
//                 status: 200,
//                 message: 'All tasks fetched successfully',
//                 tasks: filteredTasks,
//                 totalTasks,
//                 totalPages: Math.ceil(totalTasks / limit) || 1,
//                 currentPage: page || 1
//             })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while fetching the task:', error)
//         return res.send({ status: 500, message: 'Error occurred while fetching the task!' })
//     }
// }

// exports.updateTask = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
//         if(allowedRoles.includes(req.user.role)){
//             const taskId = req.params.id
//             const {
//                 taskName,
//                 taskType,
//                 taskDescription,
//                 startDate,
//                 endDate
//             } = req.body

//             const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
//             if(!task){
//                 return res.send({ status: 404, message: 'Task not found' })
//             }

//             const updatedTask = await Task.findOneAndUpdate(
//                 { _id: taskId, isDeleted: { $ne: true } },
//                 {
//                     $set: {
//                         taskName,
//                         taskType,
//                         taskDescription,
//                         startDate,
//                         endDate
//                     }
//                 }, { new: true }
//             )

//             return res.send({ status: 200, message: 'Task updated successfully', updatedTask })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while updating the task:', error)
//         return res.send({ status: 500, message: 'Error occurred while updating the task!' })
//     }
// }

// exports.deleteTask = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
//         if(allowedRoles.includes(req.user.role)){
//             const taskId = req.params.id

//             const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
//             if(!task){
//                 return res.send({ status: 404, message: 'Task not found' })
//             }

//             const deletedTask = await Task.findOneAndUpdate(
//                 { _id: taskId, isDeleted: { $ne: true } },
//                 {
//                     $set: {
//                         isDeleted: true,
//                         canceledAt: moment().toDate()
//                     }
//                 }, { new: true }
//             )

//             return res.send({ status: 200, message: 'Task deleted successfully', deletedTask })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while deleting the task:', error)
//         return res.send({ status: 500, message: 'Error occurred while deleting the task!' })
//     }
// }

exports.createTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const {
                taskName,
                taskDescription,
                startDate,
                endDate,
                startTime,
                endTime,
                userId,
                jobId,
                clientId,
            } = req.body

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobDetail = user?.jobDetails.find(job => job?._id?.toString() == jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            // const newTask = {
            //     taskName,
            //     taskDescription,
            //     taskDate,
            //     startTime,
            //     endTime,
            //     userId,
            //     jobId,
            //     creatorId: req.user._id,
            // }

            let locationId = ""
            if(jobDetail?.isWorkFromOffice){
                const location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
                if(!location){
                    return res.send({ status: 404, message: 'Location not found' })
                }
                locationId = jobDetail?.location
            } else {
                if(!clientId || ['undefined', 'null', ''].includes(clientId)){
                    return res.send({ status: 400, message: 'Client ID is required' })
                }

                const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if(!client){
                    return res.send({ status: 404, message: 'Client not found' })
                }
                // newTask.clientId = clientId
            }

            if(startDate !== "" && endDate !== "" && startDate && endDate){
                const start = moment(startDate)
                const end = moment(endDate)
                if(!start.isValid() || !end.isValid() || end.isBefore(start)){
                    return res.send({ status: 400, message: 'Invalid start date or end date' })
                }

                const tasks = []
                const dates = []

                for(let m = moment(start); m.isSameOrBefore(end); m.add(1, 'days')){
                    dates.push(m.format('YYYY-MM-DD'))
                }

                for (const date of dates) {
                    const newTask = {
                        taskName,
                        taskDescription,
                        taskDate: date,
                        startTime: momentTimeZone.tz(`${date}T${startTime}`, 'Europe/London').utc().format('HH:mm'),
                        endTime: momentTimeZone.tz(`${date}T${endTime}`, 'Europe/London').utc().format('HH:mm'),
                        userId,
                        jobId,
                        creatorId: req.user._id,
                    }

                    if (locationId) {
                        newTask.locationId = locationId
                    } else {
                        newTask.clientId = clientId
                    }

                    tasks.push(newTask)
                }

                await Task.insertMany(tasks)
            } else if(startDate !== "" && (!endDate || endDate == "")){
                const start = moment(startDate)
                if(!start.isValid()){
                    return res.send({ status: 400, message: 'Invalid start date' })
                }

                const newTask = {
                    taskName,
                    taskDescription,
                    taskDate: startDate,
                    startTime: momentTimeZone.tz(`${startDate}T${startTime}`, 'Europe/London').utc().format('HH:mm'),
                    endTime: momentTimeZone.tz(`${startDate}T${endTime}`, 'Europe/London').utc().format('HH:mm'),
                    userId,
                    jobId,
                    creatorId: req.user._id,
                }

                if (locationId) {
                    newTask.locationId = locationId
                } else {
                    newTask.clientId = clientId
                }

                await Task.create(newTask)
            }

            return res.send({ status: 200, message: 'Task created successfully' })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while creating the task:', error)
        return res.send({ status: 500, message: 'Error occurred while creating the task!' })
    }
}

exports.getTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id
            const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } }).populate('creatorId', 'personalDetails.firstName personaldetails.lastName')
            if(!task){
                return res.send({ status: 404, message: 'Task not found' })
            }
            const formattedTask = {
                ...task.toObject(),
                createdBy: `${ task?.creatorId?.personalDetails?.lastName ? `${task?.creatorId?.personalDetails?.firstName} ${task?.creatorId?.personalDetails?.lastName}` : `${task?.creatorId?.personalDetails?.firstName}` }`,
                creatorId: task?.creatorId?._id 
            }
            return res.send({ status: 200, message: 'Task fetched successfully', task: formattedTask })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching the task:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching the task!' })
    }
}

exports.getAllTasks = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(req.user?.role === 'Superadmin' && req.body.userId == ""){
            return res.send({
                status: 200,
                message: 'Tasks fetched successfully',
                task: []
            })
        }
        if(allowedRoles.includes(req.user.role)){
            const { jobId, clientId } = req.body
            const userId = req.body.userId || req.user._id
            const { month, year } = req.query

            let startDate, endDate
            
            if(year && month){
                startDate = moment(`${year}-${month}-01`, 'YYYY-MM-DD').startOf('month').format('YYYY-MM-DD')
                endDate = moment(startDate, 'YYYY-MM-DD').endOf('month').format('YYYY-MM-DD')
            } else if(year){
                startDate = moment(`${year}-01-01`, 'YYYY-MM-DD').startOf('year').format('YYYY-MM-DD')
                endDate = moment(startDate, 'YYYY-MM-DD').endOf('year').format('YYYY-MM-DD')
            } else if(month){
                const currentYear = moment().year()
                startDate = moment(`${currentYear}-${month}-01`, 'YYYY-MM-DD').startOf('month').format('YYYY-MM-DD')
                endDate = moment(startDate, 'YYYY-MM-DD').endOf('month').format('YYYY-MM-DD')
            } else {
                startDate = moment().startOf('month').format('YYYY-MM-DD')
                endDate = moment().endOf('month').format('YYYY-MM-DD')
            }

            let baseQuery = {
                isDeleted: { $ne: true },
                userId: userId || req.user._id,
                taskDate: { $gte: startDate, $lte: endDate },
                jobId,
            }

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobDetail = user?.jobDetails.find(job => job?._id.toString() == jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'Job title not found' })
            }

            if(jobDetail?.isWorkFromOffice){
                const location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
                if(!location){
                    return res.send({ status: 404, message: 'Location not found' })
                }
                baseQuery.locationId = jobDetail?.location
            } else {
                if(!clientId || ['undefined', 'null', ''].includes(clientId)){
                    return res.send({ status: 400, message: 'Client ID is required' })
                }

                const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if(!client){
                    return res.send({ status: 404, message: 'Client not found' })
                }
                baseQuery.clientId = clientId
            }

            const tasks = await Task.find({
                userId: userId || req.user._id,
                jobId,
                isDeleted: { $ne: true },
                taskDate: { $gte: startDate, $lte: endDate }
            }).populate('creatorId', 'personalDetails.firstName personaldetails.lastName')

            const formattedTasks = tasks.map(task => {
                return {
                    ...task.toObject(),
                    startTime: convertToEuropeanTimezone(`${task.taskDate}T${task.startTime}:00.000Z`).format('HH:mm'),
                    endTime: convertToEuropeanTimezone(`${task.taskDate}T${task.endTime}:00.000Z`).format('HH:mm'),
                    createdBy: `${ task?.creatorId?.personalDetails?.lastName ? `${task?.creatorId?.personalDetails?.firstName} ${task?.creatorId?.personalDetails?.lastName}` : `${task?.creatorId?.personalDetails?.firstName}` }`,
                    creatorId: task?.creatorId?._id
                }
            })

            return res.send({ status: 200, message: 'All tasks fetched successfully', tasks: formattedTasks })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching all tasks:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching all tasks!' })
    }
}

exports.updateTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id
            const {
                taskName,
                taskDescription,
                taskDate,
                startTime,
                endTime,
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
                        taskDescription,
                        taskDate,
                        startTime,
                        endTime,
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Task updated successfully', updatedTask })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating the task:', error)
        return res.send({ status: 500, message: 'Error occurred while updating the task!' })
    }
}

exports.canceledTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id

            const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
            if(!task){
                return res.send({ status: 404, message: 'Task not found' })
            }

            task.status = 'Cancelled'
            task.isDeleted = true
            task.canceledAt = moment().toDate()
            await task.save()

            return res.send({ status: 200, message: 'Task cancelled successfully', task })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while canceling the task:', error)
        return res.send({ status: 500, message: 'Error occurred while canceling the task!' })
    }
}

exports.getCountOfLateClockIn = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const { userId, jobId } = req.body

            const startDate = moment().startOf('month').toDate()
            const endDate = moment().endOf('month').toDate()

            const totalCountOfLateClockIn = await Task.find({ userId, jobId, isLate: true, createdAt: { $gte: startDate, $lte: endDate } }).countDocuments()

            return res.send({ status: 200, message: "User's late count fetched successfully", totalCountOfLateClockIn: totalCountOfLateClockIn > 0 ? totalCountOfLateClockIn : 0 })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching count of late clock-IN:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching count of late clock-IN' })
    }
}
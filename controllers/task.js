const Task = require('../models/task')
const moment = require('moment')
const User = require('../models/user')
const Client = require('../models/client')
const Location = require('../models/location')
const Company = require("../models/company")
const momentTimeZone = require('moment-timezone')
const { convertToEuropeanTimezone } = require('../utils/timezone')
const { default: mongoose } = require('mongoose')
const jwt = require('jsonwebtoken')
const { JWT_SECRET_JOB_ROLES } = process.env

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
                assignUsers
            } = req.body

            if (!Array.isArray(assignUsers) || assignUsers.length === 0) {
                return res.send({ status: 400, message: "Please select at least one user to assign the task!" })
            }

            const decodedTokens = []
            const userIds = new Set()
            const clientIds = new Set()
            const locationIds = new Set()

            for (const assigned of assignUsers) {
                try {
                    const decoded = jwt.verify(assigned, JWT_SECRET_JOB_ROLES)
                    decodedTokens.push(decoded)
                    userIds.add(decoded.userId)
                    if (decoded.clientId) clientIds.add(decoded.clientId)
                    if (decoded.locationId) locationIds.add(decoded.locationId)
                } catch (err) {
                    return res.send({ status: 400, message: 'Invalid or expired job-role token.' })
                }
            }

            const users = await User.find({ _id: { $in: Array.from(userIds) }, isDeleted: { $ne: true } })
            const userMap = new Map(users.map(u => [u._id.toString(), u]))

            const locations = await Location.find({ _id: { $in: Array.from(locationIds) }, isDeleted: { $ne: true } })
            const locationMap = new Map(locations.map(l => [l._id.toString(), l]))

            const clients = await Client.find({ _id: { $in: Array.from(clientIds) }, isDeleted: { $ne: true } })
            const clientMap = new Map(clients.map(c => [c._id.toString(), c]))

            const start = moment(startDate)
            const end = endDate ? moment(endDate) : null

            if (!start.isValid() || (endDate && (!end.isValid() || end.isBefore(start)))) {
                return res.send({ status: 400, message: 'Invalid start or end date' })
            }

            const dateRange = []
            for (let m = moment(start); end ? m.isSameOrBefore(end) : m.isSame(start); m.add(1, 'days')) {
                dateRange.push(m.format('YYYY-MM-DD'))
            }

            let tasks = [], existTasks = []

            for (const tokenData of decodedTokens) {
                const { userId, jobId, clientId, locationId, userName, jobName } = tokenData
                const user = userMap.get(userId)
                if (!user) {
                    return res.send({ status: 404, message: `User not found` })
                }

                const jobDetail = user.jobDetails.find(job => job?._id?.toString() === jobId)
                if (!jobDetail) {
                    return res.send({ status: 404, message: `JobTitle not found` })
                }

                if (locationId && !locationMap.has(locationId)) {
                    return res.send({ status: 404, message: `Location not found` })
                }

                if (clientId && !clientMap.has(clientId)) {
                    return res.send({ status: 404, message: `Client not found` })
                }

                for (const date of dateRange) {
                    const taskStartTime = momentTimeZone.tz(`${date}T${startTime}`, 'Europe/London').utc().format('HH:mm')
                    const taskEndTime = momentTimeZone.tz(`${date}T${endTime}`, 'Europe/London').utc().format('HH:mm')

                    let existTask
                    if(locationId){
                        existTask = await Task.findOne({ userId, jobId, taskDate: date, locationId, startTime: { $lt: taskEndTime }, endTime: { $gt: taskStartTime }, isDeleted: { $ne: true } })
                    }
                    
                    if(clientId){
                        existTask = await Task.findOne({ userId, jobId, taskDate: date, clientId, startTime: { $lt: taskEndTime }, endTime: { $gt: taskStartTime }, isDeleted: { $ne: true } })
                    }

                    if(existTask){
                        existTasks.push(`${userName} (${jobName})`)
                    } else {
                        const task = {
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
                            task.locationId = locationId
                        } else {
                            task.clientId = clientId
                        }
    
                        tasks.push(task)
                    }
                }
            }

            if(existTasks.length > 0){
                return res.send({ status: 400, message: 'Already assign the task for user(s)', existTaskUsers: existTasks })
            }

            const assignedTasks = await Task.insertMany(tasks, { ordered: false })

            return res.send({ status: 200, message: 'Task(s) assigned successfully.', assignedTasks })
            
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while creating the task:', error)
        return res.send({ status: 500, message: 'Error occurred while creating the task!' })
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
    //     if(allowedRoles.includes(req.user.role)){
    //         const {
    //             taskName,
    //             taskDescription,
    //             startDate,
    //             endDate,
    //             startTime,
    //             endTime,
    //             assignUsers,
    //         } = req.body

    //         if (!Array.isArray(assignUsers) || assignUsers.length === 0) {
    //             return res.send({ status: 400, message: "Please select atleast one user for assign task!" });
    //         }

    //         const tasks = []

    //         for (const assigned of assignUsers) {
    //             const { userId, jobId, clientId, locationId } = assigned

    //             const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    //             if (!user) {
    //                 return res.send({ status: 404, message: `User not found: ${userId}` })
    //             }

    //             const jobDetail = user.jobDetails.find(job => job?._id?.toString() === jobId)
    //             if (!jobDetail) {
    //                 return res.send({ status: 404, message: `JobTitle not found for user ${userId}` })
    //             }

    //             if (locationId) {
    //                 const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
    //                 if (!location) {
    //                     return res.send({ status: 404, message: `Location not found: ${locationId}` })
    //                 }
    //             }

    //             if (clientId) {
    //                 const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
    //                 if (!client) {
    //                     return res.send({ status: 404, message: `Client not found: ${clientId}` })
    //                 }
    //             }

    //             const start = moment(startDate);
    //             const end = endDate ? moment(endDate) : null;

    //             if (!start.isValid() || (endDate && (!end.isValid() || end.isBefore(start)))) {
    //                 return res.send({ status: 400, message: 'Invalid start or end date' })
    //             }

    //             const dateRange = [];
    //             for (let m = moment(start); end ? m.isSameOrBefore(end) : m.isSame(start); m.add(1, 'days')) {
    //                 dateRange.push(m.format('YYYY-MM-DD'))
    //             }

    //             for (const date of dateRange) {
    //                 const task = {
    //                     taskName,
    //                     taskDescription,
    //                     taskDate: date,
    //                     startTime: momentTimeZone.tz(`${date}T${startTime}`, 'Europe/London').utc().format('HH:mm'),
    //                     endTime: momentTimeZone.tz(`${date}T${endTime}`, 'Europe/London').utc().format('HH:mm'),
    //                     userId,
    //                     jobId,
    //                     creatorId: req.user._id
    //                 }

    //                 if (locationId) task.locationId = locationId
    //                 if (clientId) task.clientId = clientId

    //                 tasks.push(task)
    //             }
    //         }

    //         const assignedTasks = await Task.insertMany(tasks)
    //         return res.send({ status: 200, message: 'Task assigned successfully.', assignedTasks })
            
    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while creating the task:', error)
    //     return res.send({ status: 500, message: 'Error occurred while creating the task!' })
    // }
    // old method
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
    //     if(allowedRoles.includes(req.user.role)){
    //         const {
    //             taskName,
    //             taskDescription,
    //             startDate,
    //             endDate,
    //             startTime,
    //             endTime,
    //             userId,
    //             jobId,
    //             clientId,
    //         } = req.body

    //         const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    //         if(!user){
    //             return res.send({ status: 404, message: 'User not found' })
    //         }

    //         const jobDetail = user?.jobDetails.find(job => job?._id?.toString() == jobId)
    //         if(!jobDetail){
    //             return res.send({ status: 404, message: 'JobTitle not found' })
    //         }

    //         // const newTask = {
    //         //     taskName,
    //         //     taskDescription,
    //         //     taskDate,
    //         //     startTime,
    //         //     endTime,
    //         //     userId,
    //         //     jobId,
    //         //     creatorId: req.user._id,
    //         // }

    //         let locationId = ""
    //         if(jobDetail?.isWorkFromOffice){
    //             const location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
    //             if(!location){
    //                 return res.send({ status: 404, message: 'Location not found' })
    //             }
    //             locationId = jobDetail?.location
    //         } else {
    //             if(!clientId || ['undefined', 'null', ''].includes(clientId)){
    //                 return res.send({ status: 400, message: 'Client ID is required' })
    //             }

    //             const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
    //             if(!client){
    //                 return res.send({ status: 404, message: 'Client not found' })
    //             }
    //             // newTask.clientId = clientId
    //         }

    //         if(startDate !== "" && endDate !== "" && startDate && endDate){
    //             const start = moment(startDate)
    //             const end = moment(endDate)
    //             if(!start.isValid() || !end.isValid() || end.isBefore(start)){
    //                 return res.send({ status: 400, message: 'Invalid start date or end date' })
    //             }

    //             const tasks = []
    //             const dates = []

    //             for(let m = moment(start); m.isSameOrBefore(end); m.add(1, 'days')){
    //                 dates.push(m.format('YYYY-MM-DD'))
    //             }

    //             for (const date of dates) {
    //                 const newTask = {
    //                     taskName,
    //                     taskDescription,
    //                     taskDate: date,
    //                     startTime: momentTimeZone.tz(`${date}T${startTime}`, 'Europe/London').utc().format('HH:mm'),
    //                     endTime: momentTimeZone.tz(`${date}T${endTime}`, 'Europe/London').utc().format('HH:mm'),
    //                     userId,
    //                     jobId,
    //                     creatorId: req.user._id,
    //                 }

    //                 if (locationId) {
    //                     newTask.locationId = locationId
    //                 } else {
    //                     newTask.clientId = clientId
    //                 }

    //                 tasks.push(newTask)
    //             }

    //             await Task.insertMany(tasks)
    //         } else if(startDate !== "" && (!endDate || endDate == "")){
    //             const start = moment(startDate)
    //             if(!start.isValid()){
    //                 return res.send({ status: 400, message: 'Invalid start date' })
    //             }

    //             const newTask = {
    //                 taskName,
    //                 taskDescription,
    //                 taskDate: startDate,
    //                 startTime: momentTimeZone.tz(`${startDate}T${startTime}`, 'Europe/London').utc().format('HH:mm'),
    //                 endTime: momentTimeZone.tz(`${startDate}T${endTime}`, 'Europe/London').utc().format('HH:mm'),
    //                 userId,
    //                 jobId,
    //                 creatorId: req.user._id,
    //             }

    //             if (locationId) {
    //                 newTask.locationId = locationId
    //             } else {
    //                 newTask.clientId = clientId
    //             }

    //             await Task.create(newTask)
    //         }

    //         return res.send({ status: 200, message: 'Task created successfully' })
    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while creating the task:', error)
    //     return res.send({ status: 500, message: 'Error occurred while creating the task!' })
    // }
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

function getStartAndEndDate({ startDate, endDate }) {
    let start, end

    if(startDate && endDate){
        start = moment(startDate).startOf('day')
        end = moment(endDate).endOf('day')
    } else if(startDate && (!endDate || endDate == "")) {
        start = moment(startDate).startOf('day')
        end = moment().endOf('day')
    } else {
        start = moment().startOf('day')
        end = moment().endOf('day')
    }

    return {
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD')
    }
}

async function getOptimizedAllTasks (users, clientIds, locationIds, fromDate, toDate, skip, limit, isWorkFromOffice) {
    try {
        const finalResponse = []

        const userFilter = Array.isArray(users) && users.length > 0 ? users.map(id => new mongoose.Types.ObjectId(id)) : null

        const clientFilter = Array.isArray(clientIds) && clientIds.length > 0 ? clientIds : null
        const locationFilter = Array.isArray(locationIds) && locationIds.length > 0 ? locationIds : null

        let clientQuery = clientFilter ? { _id: { $in: clientFilter } } : {}
        let locationQuery = locationFilter ? { _id: { $in: locationFilter } } : {}
        
        const clientDocs = await Client.find(clientQuery).lean()
        const locationDocs = await Location.find(locationQuery).lean()
        const clientMap = new Map(clientDocs.map(client => [client?._id?.toString(), client]))
        const locationMap = new Map(locationDocs.map(location => [location?._id?.toString(), location]))

        const matchQuery = {
            isDeleted: { $ne: true },
            taskDate: {
                $gte: moment(fromDate).format('YYYY-MM-DD'),
                $lte: moment(toDate).format('YYYY-MM-DD')
            }
        }

        if(isWorkFromOffice == "false") {
            if (clientFilter) matchQuery.clientId = { $in: clientFilter }
        } else if(isWorkFromOffice == "true"){
            if (locationFilter) matchQuery.locationId = { $in: locationFilter }
        }

        if (userFilter) matchQuery.userId = { $in: userFilter }

        const [taskDocs] = await Task.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            { $sort: { taskDate: -1 } },
            {
                $facet: {
                    task: [
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                _id: 1,
                                taskName: 1,
                                taskDescription: 1,
                                taskDate: 1,
                                userId: 1,
                                jobId: 1,
                                clientId: 1,
                                locationId: 1,
                                startTime: 1,
                                endTime: 1,
                                'user._id': 1,
                                'user.personalDetails': 1,
                                'user.jobDetails': 1
                            }
                        }
                    ],
                    count: [{ $count: 'count' }]
                }
            },
        ])

        for(const doc of taskDocs?.task){
            const user = doc?.user
            let client, location

            if(isWorkFromOffice == 'false'){
                client = clientMap.get(doc?.clientId?.toString())
                if (!client) continue
            } else if(isWorkFromOffice == 'true') {
                location = locationMap.get(doc?.locationId?.toString())
                if (!location) continue
            }

            for(const job of user?.jobDetails){
                if(job?._id.toString() !== doc?.jobId.toString()) continue
                if(isWorkFromOffice == 'false' && job?.isWorkFromOffice == false){
                    const assignedClientIds = job?.assignClient?.map(c => c?.toString())
                    if (!assignedClientIds.includes(doc?.clientId?.toString())) continue
                } else if(isWorkFromOffice == 'true' && job?.isWorkFromOffice == true) {
                    const assignedLocationIds = job?.location?.map(c => c?.toString())
                    if (!assignedLocationIds.includes(doc?.locationId?.toString())) continue
                }

                const userName = user?.personalDetails?.lastName
                    ? `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}`
                    : user?.personalDetails?.firstName

                finalResponse.push({
                    _id: doc?._id,
                    userId: doc?.userId,
                    userName,
                    jobRole: job?.jobTitle,
                    clientName: client?.clientName,
                    locationName: location?.locationName,
                    taskDate: doc?.taskDate,
                    // startTime: doc?.startTime,
                    // endTime: doc?.endTime,
                    startTime: convertToEuropeanTimezone(`${doc?.taskDate}T${doc?.startTime}:00.000Z`).format('HH:mm'),
                    endTime: convertToEuropeanTimezone(`${doc?.taskDate}T${doc?.endTime}:00.000Z`).format('HH:mm'),
                })
            }
        }

        return { finalResponse, count: taskDocs?.count[0]?.count }
    } catch (error) {
        console.error('Error occurred while fetching optimized tasks:', error)
    }
}

exports.getAllTasks = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50

            const skip = (page - 1) * limit

            const { userId, clientId, locationId } = req.body
            const { isWorkFromOffice, companyId } = req.query
            let { startDate, endDate } = req.query

            const user = await User.findOne({ _id: req.user._id.toString(), isDeleted: { $ne: true } }).lean()
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            if((!startDate || startDate == "") && (!endDate || endDate == "")){
                startDate = moment(user.createdAt).format('YYYY-MM-DD')
                endDate = moment().format('YYYY-MM-DD')
            }

            const { startDate: fromDate, endDate: toDate } = getStartAndEndDate({ startDate, endDate })

            let users, userIds = [], clients, clientIds = [], locations, locationIds = []

            const userMatch = { isDeleted: { $ne: true } }
            if (companyId !== 'allCompany') userMatch.companyId = companyId

            if(isWorkFromOffice == "true"){
                if ((userId == 'allUsers' || userId == "" || !userId) && (locationId == 'allLocations' || locationId == "" || !locationId)) {
                    users = await User.find(userMatch)
                    userIds = users.map(user => user._id.toString())
                    locations = await Location.find(userMatch)
                    locationIds = locations.map(location => location._id.toString())
                } else if (userId !== 'allUsers' && (locationId == 'allLocations' || locationId == "" || !locationId)) {
                    users = await User.find({ _id: userId, ...userMatch })
                    userIds = users.map(user => user._id.toString())
    
                    users.forEach(user => {
                        user.jobDetails?.forEach(job => {
                            job.assignClient?.forEach(client => {
                                if (client) {
                                    clientIds.push(client.toString());
                                }
                            })
                        })
                    })

                    locations = await Location.find(userMatch)
                    locationIds = locations.map(location => location._id.toString())
                } else if ((userId == 'allUsers' || userId == "" || !userId) && locationId !== 'allLocations') {
                    users = await User.find(userMatch)
                    // userIds = users.map(user => user._id.toString())
    
                    users.forEach(user => {
                        user.jobDetails?.forEach(job => {
                            job.assignClient?.forEach(client => {
                                if(clientId == client){
                                    userIds.push(user._id.toString())
                                }
                            })
                        })
                    })

                    locations = await Location.find({ _id: locationId, ...userMatch })
                    locationIds = locations.map(location => location._id.toString())
                } else if (userId !== 'allUsers' && locationId !== 'allLocations') {
                    users = await User.find({ _id: userId, ...userMatch })
                    userIds = users.map(user => user._id.toString())
                    locations = await Location.find({ _id: locationId, ...userMatch })
                    locationIds = locations.map(location => location._id.toString())
                }
            } else if(isWorkFromOffice == "false"){
                if ((userId == 'allUsers' || userId == "" || !userId) && (clientId == 'allClients' || clientId == "" || !clientId)) {
                    users = await User.find(userMatch)
                    userIds = users.map(user => user._id.toString())
                    clients = await Client.find(userMatch)
                    clientIds = clients.map(client => client._id.toString())
                } else if (userId !== 'allUsers' && (clientId == 'allClients' || clientId == "" || !clientId)) {
                    users = await User.find({ _id: userId, ...userMatch })
                    userIds = users.map(user => user._id.toString())

                    users.forEach(user => {
                        user.jobDetails?.forEach(job => {
                            job.assignClient?.forEach(client => {
                                if (client) {
                                    clientIds.push(client.toString());
                                }
                            })
                        })
                    })

                    clients = await Client.find(userMatch)
                    clientIds = clients.map(client => client._id.toString())
                } else if ((userId == 'allUsers' || userId == "" || !userId) && clientId !== 'allClients') {
                    users = await User.find(userMatch)
                    // userIds = users.map(user => user._id.toString())

                    users.forEach(user => {
                        user.jobDetails?.forEach(job => {
                            job.assignClient?.forEach(client => {
                                if(clientId == client){
                                    userIds.push(user._id.toString())
                                }
                            })
                        })
                    })

                    clients = await Client.find({ _id: clientId, ...userMatch })
                    clientIds = clients.map(client => client._id.toString())
                } else if (userId !== 'allUsers' && clientId !== 'allClients') {
                    users = await User.find({ _id: userId, ...userMatch })
                    userIds = users.map(user => user._id.toString())
                    clients = await Client.find({ _id: clientId, ...userMatch })
                    clientIds = clients.map(client => client._id.toString())
                }
            }

            const finalResponse = await getOptimizedAllTasks(userIds, clientIds, locationIds, fromDate, toDate, skip, limit, isWorkFromOffice)

            return res.send({
                status: 200,
                message: 'All tasks fetched successfully',
                reports: finalResponse.finalResponse,
                totalReports: finalResponse.count,
                totalPages: Math.ceil(finalResponse.count / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching all tasks:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching all tasks!' })
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
    //     if(req.user?.role === 'Superadmin' && req.body.userId == ""){
    //         return res.send({
    //             status: 200,
    //             message: 'Tasks fetched successfully',
    //             task: []
    //         })
    //     }
    //     if(allowedRoles.includes(req.user.role)){
    //         const { jobId, clientId } = req.body
    //         const userId = req.body.userId || req.user._id
    //         const { month, year } = req.query

    //         let startDate, endDate
            
    //         if(year && month){
    //             startDate = moment(`${year}-${month}-01`, 'YYYY-MM-DD').startOf('month').format('YYYY-MM-DD')
    //             endDate = moment(startDate, 'YYYY-MM-DD').endOf('month').format('YYYY-MM-DD')
    //         } else if(year){
    //             startDate = moment(`${year}-01-01`, 'YYYY-MM-DD').startOf('year').format('YYYY-MM-DD')
    //             endDate = moment(startDate, 'YYYY-MM-DD').endOf('year').format('YYYY-MM-DD')
    //         } else if(month){
    //             const currentYear = moment().year()
    //             startDate = moment(`${currentYear}-${month}-01`, 'YYYY-MM-DD').startOf('month').format('YYYY-MM-DD')
    //             endDate = moment(startDate, 'YYYY-MM-DD').endOf('month').format('YYYY-MM-DD')
    //         } else {
    //             startDate = moment().startOf('month').format('YYYY-MM-DD')
    //             endDate = moment().endOf('month').format('YYYY-MM-DD')
    //         }

    //         let baseQuery = {
    //             isDeleted: { $ne: true },
    //             userId: userId || req.user._id,
    //             taskDate: { $gte: startDate, $lte: endDate },
    //             jobId,
    //         }

    //         const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    //         if(!user){
    //             return res.send({ status: 404, message: 'User not found' })
    //         }

    //         const jobDetail = user?.jobDetails.find(job => job?._id.toString() == jobId)
    //         if(!jobDetail){
    //             return res.send({ status: 404, message: 'Job title not found' })
    //         }

    //         if(jobDetail?.isWorkFromOffice){
    //             const location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
    //             if(!location){
    //                 return res.send({ status: 404, message: 'Location not found' })
    //             }
    //             baseQuery.locationId = jobDetail?.location
    //         } else {
    //             if(!clientId || ['undefined', 'null', ''].includes(clientId)){
    //                 return res.send({ status: 400, message: 'Client ID is required' })
    //             }

    //             const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
    //             if(!client){
    //                 return res.send({ status: 404, message: 'Client not found' })
    //             }
    //             baseQuery.clientId = clientId
    //         }

    //         const tasks = await Task.find({
    //             userId: userId || req.user._id,
    //             jobId,
    //             isDeleted: { $ne: true },
    //             taskDate: { $gte: startDate, $lte: endDate }
    //         }).populate('creatorId', 'personalDetails.firstName personaldetails.lastName')

    //         const formattedTasks = tasks.map(task => {
    //             return {
    //                 ...task.toObject(),
    //                 startTime: convertToEuropeanTimezone(`${task.taskDate}T${task.startTime}:00.000Z`).format('HH:mm'),
    //                 endTime: convertToEuropeanTimezone(`${task.taskDate}T${task.endTime}:00.000Z`).format('HH:mm'),
    //                 createdBy: `${ task?.creatorId?.personalDetails?.lastName ? `${task?.creatorId?.personalDetails?.firstName} ${task?.creatorId?.personalDetails?.lastName}` : `${task?.creatorId?.personalDetails?.firstName}` }`,
    //                 creatorId: task?.creatorId?._id
    //             }
    //         })

    //         return res.send({ status: 200, message: 'All tasks fetched successfully', tasks: formattedTasks })
    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while fetching all tasks:', error)
    //     return res.send({ status: 500, message: 'Error occurred while fetching all tasks!' })
    // }
}

exports.updateTask = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const taskId = req.params.id
            const {
                taskName,
                taskDescription,
                startTime,
                endTime,
            } = req.body

            const task = await Task.findOne({ _id: taskId, isDeleted: { $ne: true } })
            if(!task){
                return res.send({ status: 404, message: 'Task not found' })
            }

            const taskStartTime = momentTimeZone.tz(`${task?.taskDate}T${startTime}`, 'Europe/London').utc().format('HH:mm')
            const taskEndTime = momentTimeZone.tz(`${task?.taskDate}T${endTime}`, 'Europe/London').utc().format('HH:mm')

            const existingTask = await Task.findOne({
                userId: task?.userId,
                jobId: task?.jobId,
                taskDate: task?.taskDate,
                startTime: { $lt: taskEndTime },
                endTime: { $gt: taskStartTime },
                isDeleted: { $ne: true },
            })

            if(existingTask){
                return res.send({ status: 400, message: 'Already assign a task between provided schedule!' })
            }

            const updatedTask = await Task.findOneAndUpdate(
                { _id: taskId, isDeleted: { $ne: true } },
                {
                    $set: {
                        taskName,
                        taskDescription,
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

exports.getAllUsersWithJobRoles = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.query.companyId

            let baseQuery = { isDeleted: { $ne: true } }

            if(companyId && companyId !== 'allCompany'){
                baseQuery.companyId = companyId
            } else if(req.user.role !== 'Superadmin'){
                baseQuery.companyId = req.user.companyId
                baseQuery.locationId = { $in: req.user.locationId }
            }

            if (req.user.role === 'Superadmin') {
                baseQuery.role = { $in: ["Administrator", "Manager", "Employee"] }
            } else if (req.user.role === 'Administrator') {
                baseQuery.role = { $in: ["Manager", "Employee"] }
            } else if(req.user.role === 'Manager') {
                baseQuery.role = { $in: ["Employee"] }
                baseQuery.jobDetails = {
                    $elemMatch: { assignManager: req.user._id.toString() }
                }
            }

            const users = await User.find(baseQuery).select('_id personalDetails.firstName personalDetails.lastName jobDetails')

            const allClientIds = new Set()
            const allLocationIds = new Set()

            users.forEach(user => {
                user?.jobDetails.forEach(job => {
                    if (job?.isWorkFromOffice === false && Array.isArray(job?.assignClient)) {
                        job?.assignClient.forEach(cid => allClientIds.add(cid?.toString()))
                    } else if (job?.isWorkFromOffice === true && Array.isArray(job?.location)) {
                        job?.location.forEach(lid => allLocationIds.add(lid?.toString()))
                    }
                })
            })

            const clients = await Client.find({ _id: { $in: Array.from(allClientIds) } }, '_id clientName companyId')
            const locations = await Location.find({ _id: { $in: Array.from(allLocationIds) } }, '_id locationName companyId')

            const clientMap = new Map(clients.map(c => [c._id.toString(), { clientName: c.clientName, companyId: c.companyId }]))
            const locationMap = new Map(locations.map(l => [l._id.toString(), { locationName: l.locationName, companyId: l.companyId }]))

            const allCompanyIds = new Set()
            clients.forEach(c => {
                if (c.companyId) allCompanyIds.add(c.companyId.toString())
            })
            locations.forEach(l => {
                if (l.companyId) allCompanyIds.add(l.companyId.toString())
            })

            const companies = await Company.find({ _id: { $in: Array.from(allCompanyIds) } }, '_id companyDetails.businessName')
            const companyMap = new Map(companies.map(c => [c._id.toString(), c.companyDetails.businessName]))

            const finalUsers = []

            for (const user of users) {
                const userId = user?._id
                const userName = user.personalDetails?.lastName ? `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}` : `${user?.personalDetails?.firstName}`
                const jobRoles = []

                for (const job of user.jobDetails) {
                    const { _id: jobId, jobTitle, isWorkFromOffice } = job

                    if (!isWorkFromOffice && Array.isArray(job?.assignClient)) {
                        for (const clientId of job?.assignClient) {
                            const clientInfo = clientMap.get(clientId?.toString())
                            if (!clientInfo) continue

                            // const companyName = companyMap.get(clientInfo?.companyId?.toString())

                            const payload = {
                                userName,
                                jobName: `${jobTitle} - ${clientInfo?.clientName}`,
                                userId,
                                jobId,
                                clientId,
                                companyId: clientInfo?.companyId
                            }

                            const token = jwt.sign(payload, JWT_SECRET_JOB_ROLES)

                            jobRoles.push({
                                // userId,
                                // jobId,
                                jobName: `${jobTitle} - ${clientInfo?.clientName}`,
                                isWorkFromOffice: false,
                                // clientId,
                                // companyId: clientInfo?.companyId,
                                // companyName,
                                token,
                            })
                        }
                    } else if (isWorkFromOffice && Array.isArray(job?.location)) {
                        for (const locationId of job?.location){
                            const locationInfo = locationMap.get(locationId?.toString())
                            if (!locationInfo) continue

                            const companyName = companyMap.get(locationInfo?.companyId?.toString())

                            const payload = {
                                userName,
                                jobName: `${jobTitle} - ${locationInfo?.locationName}`,
                                userId,
                                jobId,
                                locationId,
                                companyId: locationInfo?.companyId
                            }

                            const token = jwt.sign(payload, JWT_SECRET_JOB_ROLES)

                            jobRoles.push({
                                // userId,
                                // jobId,
                                jobName: `${jobTitle} - ${locationInfo?.locationName} (${companyName})`,
                                isWorkFromOffice: true,
                                // locationId,
                                // companyId: locationInfo?.companyId,
                                token,
                            })
                        }
                    }
                }

                finalUsers.push({ userId, userName, jobRoles })
            }

            res.send({
                status: 200,
                message: "All users' job roles fetched successfully.",
                data: finalUsers
            })

        } else return res.send({ sttus: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching users with job locations:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching users with job locations!' })
    }
}
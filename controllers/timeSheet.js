const User = require("../models/user");
const geolib = require('geolib')
const Timesheet = require("../models/timeSheet");
const Notification = require("../models/notification");
const Location = require("../models/location");
const QR = require('../models/qrCode');
const Leave = require("../models/leaveRequest");
const moment = require('moment');
const Holiday = require("../models/holiday");
const ejs = require("ejs");
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs")
const path = require("path");
const EmployeeReport = require("../models/employeeReport");
const Task = require("../models/task");
const Client = require("../models/client");
const { default: mongoose } = require("mongoose");
const { convertToEuropeanTimezone } = require("../utils/timezone");
const Company = require("../models/company");
const jwt = require('jsonwebtoken');
const { transporter } = require('../utils/nodeMailer');
const momentTimeZone = require('moment-timezone');

exports.clockInFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const { userId, location, jobId, isMobile, qrValue, clientId, locationId } = req.body
            console.log('Location:', location)

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            if(isMobile === true) {
                let qrCode
                let companyId = existUser?.companyId.toString()
                if(jobDetail?.isWorkFromOffice){
                    qrCode = await QR.findOne({
                        qrValue,
                        locationId,
                        companyId,
                        isActive: { $ne: false }
                    })
                } else {
                    qrCode = await QR.findOne({
                        qrValue,
                        clientId,
                        companyId,
                        isActive: { $ne: false }
                    })
                }
                
                if (!qrCode) {
                    return res.send({ status: 400, message: 'Invalid QR code' })
                }
            }

            let user_location
            if(jobDetail?.isWorkFromOffice){
                user_location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
                if(!user_location){
                    return res.send({ status: 404, message: 'Location not found' })
                }
            } else {
                user_location = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if(!user_location){
                    return res.send({ status: 404, message: 'Client not found' })
                }                
            }

            const latLongOfLocation = {
                latitude: user_location?.latitude,
                longitude: user_location?.longitude,
                radius: user_location?.radius
            }

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 404, message: "Location coordinator data is not found!" })
            }

            await User.updateOne(
                { _id: existUser._id },
                { $set: { lastKnownLocation: location } }
            )            
            
            const GEOFENCE_CENTER = {
                latitude: latLongOfLocation?.latitude,
                longitude: latLongOfLocation?.longitude
            }
            const GEOFENCE_RADIUS = latLongOfLocation?.radius // meters

            if (!geolib.isPointWithinRadius(
                { latitude: location.latitude, longitude: location.longitude },
                GEOFENCE_CENTER,
                GEOFENCE_RADIUS
            )) {
                return res.send({ status: 403, message: 'You are outside the company location area.' })
            }

            const currentDate = moment().format('YYYY-MM-DD')

            let timesheet, assignedTask
            if(jobDetail?.isWorkFromOffice){
                timesheet = await Timesheet.findOne({ userId, locationId, jobId, date: currentDate, isDeleted: { $ne: true } })
                if(!timesheet){
                    timesheet = await Timesheet.findOne({ userId, locationId, jobId, isDeleted: { $ne: true } }).sort({ createdAt: -1 })
                }
                assignedTask = await Task.findOne({ userId, jobId, locationId, taskDate: currentDate, isDeleted: { $ne: true } })
            } else {
                timesheet = await Timesheet.findOne({ userId, clientId, jobId, date: currentDate, isDeleted: { $ne: true } })
                if(!timesheet){
                    timesheet = await Timesheet.findOne({ userId, clientId, jobId, isDeleted: { $ne: true } }).sort({ createdAt: -1 })
                }
                assignedTask = await Task.findOne({ userId, jobId, clientId, taskDate: currentDate, isDeleted: { $ne: true } })
            }

            // const assignedTask = await Task.findOne({ userId, jobId, taskDate: currentDate, isDeleted: { $ne: true } })
            if(!assignedTask && req.user.role == 'Employee'){
                return res.send({ status: 404, message: "You don't have any tasks assigned for today!" })
            }

            const taskStartTime = moment(assignedTask?.startTime, 'HH:mm')
            const checkInTime = moment().utc()

            if (checkInTime.isBefore(taskStartTime)) {
                return res.send({ status: 400, message: `You can only clock in after the task time ${convertToEuropeanTimezone(`${assignedTask.taskDate}T${assignedTask.startTime}:00.000Z`).format('LT')}.` })
            }
            
            if (!timesheet || timesheet?.date !== currentDate) {
                timesheet = new Timesheet({
                    userId,
                    jobId,
                    clientId: clientId || "",
                    locationId: locationId || "",
                    date: currentDate,
                    clockinTime: [],
                    totalHours: '0h 0m 0s'
                })
                if(assignedTask){
                    // console.log('assignedTask.startTime', assignedTask.startTime)
                    // console.log('time now:', moment().format('HH:mm'))
                    const taskStartTime = moment(assignedTask?.startTime, 'HH:mm')
                    const allowedClockInTime = moment(taskStartTime).add(user_location?.graceTime, 'minutes')
                    const currentTime = moment()
                    if (currentTime.isAfter(allowedClockInTime)) {
                        await Task.findOneAndUpdate({ _id: assignedTask._id }, { $set: { isLate: true } })
                    }
                }
            }

            const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]

            if (lastClockin && !lastClockin.clockOut) {
                return res.send({ status: 400, message: "Please clock out before clockin again." })
            }

            timesheet.clockinTime.push({
                clockIn: moment.utc().toDate(),
                clockOut: "",
                isClockin: true
            })
            
            timesheet.isTimerOn = true
            await timesheet.save()

            //------entry notification-----------
            let notifiedId = []
            let readBy = []
            // if (existUser.role === 'Employee') {
            //     if (jobDetail && jobDetail.assignManager) {
            //         const assignManager = await User.findOne({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
            //         // console.log('assignManager', assignManager)
            //         notifiedId.push(jobDetail.assignManager);
            //         readBy.push({
            //             userId: jobDetail.assignManager,
            //             role: assignManager?.role
            //         })
            //         // console.log('readBy1/..', readBy)
            //     }

            //     // const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
            //     // // console.log('administrator', administrator)
            //     // if (administrator.length > 0) {
            //     //     notifiedId.push(administrator[0]._id);
            //     //     readBy.push({
            //     //         userId: administrator[0]._id,
            //     //         role: administrator[0].role
            //     //     })
            //     // }
            // } else if (existUser.role === 'Manager') {
            //     const administrator = await User.findOne({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
            //     if (administrator) {
            //         notifiedId.push(administrator?._id);
            //         readBy.push({
            //             userId: administrator?._id,
            //             role: administrator?.role
            //         })
            //     }
            // } else if (existUser.role === 'Administrator') {
            //     notifiedId.push(existUser.creatorId)
            //     readBy.push({
            //         userId: existUser?.creatorId,
            //         role: existUser?.createdBy
            //     })
            // }

            if (existUser.role === 'Employee' || existUser.role === 'Manager') {
                if (jobDetail && jobDetail.assignManager) {
                    const assignManager = await User.findOne({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
                    notifiedId.push(jobDetail.assignManager);
                    readBy.push({
                        userId: jobDetail.assignManager,
                        role: assignManager?.role
                    })
                }
                const administrators = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                administrators.map((admin) => {
                    notifiedId.push(admin?._id)
                    readBy.push({
                        userId: admin?._id,
                        role: admin?.role
                    })
                })
            }

            const superAdmins = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            superAdmins.map((sa) => {
                notifiedId.push(sa?._id)
                readBy.push({
                    userId: sa?._id,
                    role: sa?.role
                })
            })

            const firstName = existUser.personalDetails?.firstName || ""
            const lastName = existUser.personalDetails?.lastName || ""
            const notification = new Notification({
                userId,
                // userName: `${firstName} ${lastName}`,
                companyId: existUser?.companyId,
                notifiedId,
                type: 'Clock In',
                message: `${firstName} ${lastName} clocked in successfully at ${currentDate}`,
                readBy
            });
            await notification.save();

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while clock in:", error);
        return res.send({ status: 500, message: "Something went wrong while clock in!" })
    }
}

// count total hours between two timing
const formatDuration = (clockInTime, clockOutTime) => {
    let diffInSeconds = Math.floor((clockOutTime - clockInTime) / 1000)
    const hours = Math.floor(diffInSeconds / 3600)
    diffInSeconds %= 3600
    const minutes = Math.floor(diffInSeconds / 60)
    const seconds = diffInSeconds % 60

    return `${hours}h ${minutes}m ${seconds}s`
}

// separate hours, minitues, second
const parseTime = (duration) => {
    const regex = /(\d+)h|(\d+)m|(\d+)s/g
    let hours = 0, minutes = 0, seconds = 0
    let match

    while ((match = regex.exec(duration)) !== null) {
        if (match[1]) hours = parseInt(match[1], 10)
        if (match[2]) minutes = parseInt(match[2], 10)
        if (match[3]) seconds = parseInt(match[3], 10)
    }

    return { hours, minutes, seconds }
}

// add one time (5h 5m 0s) in second time (1h 1m 1s) then return (6h 6m 1s)
const addDurations = (duration1, duration2) => {
    const time1 = parseTime(duration1)
    const time2 = parseTime(duration2)

    let totalSeconds = time1.seconds + time2.seconds
    let totalMinutes = time1.minutes + time2.minutes + Math.floor(totalSeconds / 60)
    let totalHours = time1.hours + time2.hours + Math.floor(totalMinutes / 60)

    totalSeconds %= 60
    totalMinutes %= 60

    return `${totalHours}h ${totalMinutes}m ${totalSeconds}s`
}

// count over time from total duration and total working hours
const subtractDurations = (totalDuration, threshold) => {
    const totalTime = parseTime(totalDuration)
    const thresholdTime = parseTime(threshold)

    let totalSeconds = totalTime.seconds - thresholdTime.seconds
    let totalMinutes = totalTime.minutes - thresholdTime.minutes
    let totalHours = totalTime.hours - thresholdTime.hours

    if (totalSeconds < 0) {
        totalMinutes--
        totalSeconds += 60
    }
    if (totalMinutes < 0) {
        totalHours--
        totalMinutes += 60
    }

    if (totalHours < 0) return "0h 0m 0s"
    return `${totalHours}h ${totalMinutes}m ${totalSeconds}s`
}

// calculate break time
function subtractBreakTimeFromTotalWorkingHours(durationStr, breakMinutes) {
    console.log('durationStr:', durationStr, 'breakMinutes:', breakMinutes)
    const [h, m, s] = durationStr.split(/[hms ]/).filter(Boolean).map(Number);
    const totalSeconds = h * 3600 + m * 60 + s;
    console.log('totalSeconds:', totalSeconds)
    const remainingSeconds = Math.max(0, totalSeconds - breakMinutes * 60);
    console.log('remainingSeconds:', remainingSeconds)

    const newH = Math.floor(remainingSeconds / 3600);
    const newM = Math.floor((remainingSeconds % 3600) / 60);
    const newS = remainingSeconds % 60;

    console.log('newH:', newH, 'newM:', newM, 'newS:', newS)

    return `${newH}h ${newM}m ${newS}s`;
}

exports.clockOutFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const { userId, location, jobId, isMobile, qrValue, clientId, locationId } = req.body
            console.log('Location:', location)

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            if(isMobile === true) {
                let qrCode
                let companyId = existUser?.companyId.toString()
                if(jobDetail?.isWorkFromOffice){
                    qrCode = await QR.findOne({
                        qrValue,
                        locationId,
                        companyId,
                        isActive: { $ne: false }
                    })
                } else {
                    qrCode = await QR.findOne({
                        qrValue,
                        clientId,
                        companyId,
                        isActive: { $ne: false }
                    })
                }
                
                if (!qrCode) {
                    return res.send({ status: 400, message: 'Invalid QR code' })
                }
            }

            let user_location
            if(jobDetail?.isWorkFromOffice){
                user_location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
                if(!user_location){
                    return res.send({ status: 404, message: 'Location not found' })
                }
            } else {
                user_location = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if(!user_location){
                    return res.send({ status: 404, message: 'Client not found' })
                }
            }

            const latLongOfLocation = {
                latitude: user_location?.latitude,
                longitude: user_location?.longitude,
                radius: user_location?.radius
            }

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 404, message: "Location coordinator data is not found!" })
            }

            await User.updateOne(
                { _id: existUser._id },
                { $set: { lastKnownLocation: location } }
            )

            const GEOFENCE_CENTER = {
                latitude: latLongOfLocation?.latitude,
                longitude: latLongOfLocation?.longitude
            }
            const GEOFENCE_RADIUS = latLongOfLocation?.radius // meters

            if (!geolib.isPointWithinRadius(
                { latitude: location.latitude, longitude: location.longitude },
                GEOFENCE_CENTER,
                GEOFENCE_RADIUS
            )) {
                return res.send({ status: 403, message: 'You are outside the company location area.' })
            }

            const currentDate = moment().format('YYYY-MM-DD')
            let timesheet, assignedTask
            if(jobDetail?.isWorkFromOffice){
                timesheet = await Timesheet.findOne({ userId, locationId, jobId, isDeleted: { $ne: true } }).sort({ createdAt: -1 })                
                assignedTask = await Task.findOne({ userId, jobId, locationId, taskDate: currentDate, isDeleted: { $ne: true } })
            } else {
                timesheet = await Timesheet.findOne({ userId, clientId, jobId, isDeleted: { $ne: true } }).sort({ createdAt: -1 })                
                assignedTask = await Task.findOne({ userId, jobId, clientId, taskDate: currentDate, isDeleted: { $ne: true } })
            }

            // if (!timesheet) {
            //     return res.send({ status: 404, message: "No timesheet found for today." })
            // }

            const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]
            if (!lastClockin || lastClockin.clockOut) {
                return res.send({ status: 400, message: "You can't clock-out without an active clock-in." })
            }

            // lastClockin.clockOut = moment().subtract(companyLocation?.breakTime, 'minutes').toDate()
            lastClockin.clockOut = moment.utc().toDate()
            lastClockin.isClockin = false

            const clockInTime = moment(lastClockin.clockIn).toDate()
            const clockOutTime = moment(lastClockin.clockOut).toDate()            

            let duration = formatDuration(clockInTime, clockOutTime)
            lastClockin.totalTiming = duration

            if (timesheet.totalHours === '0h 0m 0s') {
                timesheet.totalHours = duration
            } else {
                const result = addDurations(timesheet.totalHours, duration)
                timesheet.totalHours = result
            }

            if (!timesheet.breakTimeDeducted) {
                const [hours, minutes, seconds] = timesheet.totalHours.match(/\d+/g).map(Number)
                const totalMinutes = hours * 60 + minutes + Math.floor(seconds / 60)
            
                if (totalMinutes > user_location?.breakTime) {
                    duration = subtractBreakTimeFromTotalWorkingHours(timesheet.totalHours, user_location?.breakTime)
                    timesheet.totalHours = duration
                    timesheet.breakTimeDeducted = true
                } else {
                    timesheet.breakTimeDeducted = false
                }
            }

            timesheet.isTimerOn = false
            // await timesheet.save()

            // task wise calculate over time
            // const assignedTask = await Task.findOne({ userId, jobId, taskDate: currentDate, isDeleted: { $ne: true } })

            if(req.user.role == 'Employee'){
                // count over time task wise for employees

                const [startHour, startMinute] = assignedTask?.startTime.split(':').map(Number)
                const [endHour, endMinute] = assignedTask?.endTime.split(':').map(Number)

                const today = new Date()
                const startDate = new Date(today.setHours(startHour, startMinute, 0, 0))
                const endDate = new Date(today.setHours(endHour, endMinute, 0, 0))

                const totalSeconds = Math.floor((endDate - startDate) / 1000)
                const hours = Math.floor(totalSeconds / 3600)
                const minutes = Math.floor((totalSeconds % 3600) / 60)
                const seconds = totalSeconds % 60

                const totalHours = `${hours}h ${minutes}m ${seconds}s`

                const overTime = subtractDurations(timesheet?.totalHours, totalHours)

                if(overTime !== "0h 0m 0s"){
                    timesheet.isOverTime = true
                    timesheet.overTime = overTime
                }
            } else if(req.user.role == 'Administrator' || req.user.role == 'Manager'){
                // count over time weekly for administrator and manager

                // weekly overtime calculate
                const startOfWeek = moment().startOf('isoWeek').format('YYYY-MM-DD')
                const endOfWeek = moment().endOf('isoWeek').format('YYYY-MM-DD')
                // console.log('startOfWeek:', startOfWeek, 'endOfWeek:', endOfWeek)            

                const weeklyTimesheets = await Timesheet.find({
                    userId,
                    date: { $gte: startOfWeek, $lte: endOfWeek }
                })
                // console.log('weeklyTimesheets:', weeklyTimesheets)

                const totalWeeklyHours = weeklyTimesheets.reduce((total, ts) => {
                    return addDurations(total, ts.totalHours)
                }, "0h 0m 0s")
                // console.log('totalWeeklyHours:', totalWeeklyHours)

                const weeklyWorkingHours = jobDetail?.weeklyWorkingHours
                // console.log('weeklyWorkingHours:', weeklyWorkingHours)

                const weeklyOvertime = subtractDurations(totalWeeklyHours, `${weeklyWorkingHours}h 0m 0s`)
                // console.log('weeklyOvertime:', weeklyOvertime)
                
                if(weeklyOvertime !== '0h 0m 0s') {
                    timesheet.isOverTime = true
                    timesheet.overTime = weeklyOvertime
                }
            }

            await timesheet.save()

            //------exit notification-----------
            let notifiedId = []
            let readBy = []
            // if (existUser.role === 'Employee') {
            //     if (jobDetail && jobDetail.assignManager) {
            //         const assignManager = await User.findOne({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
            //         // console.log('assignManager', assignManager)
            //         notifiedId.push(jobDetail.assignManager);
            //         readBy.push({
            //             userId: jobDetail.assignManager,
            //             role: assignManager?.role
            //         })
            //         // console.log('readBy1/..', readBy)
            //     }

            //     // const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
            //     // // console.log('administrator', administrator)
            //     // if (administrator.length > 0) {
            //     //     notifiedId.push(administrator[0]._id);
            //     //     readBy.push({
            //     //         userId: administrator[0]._id,
            //     //         role: administrator[0].role
            //     //     })
            //     // }
            // } else if (existUser.role === 'Manager') {
            //     const administrator = await User.findOne({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
            //     if (administrator) {
            //         notifiedId.push(administrator?._id);
            //         readBy.push({
            //             userId: administrator?._id,
            //             role: administrator?.role
            //         })
            //     }
            // } else if (existUser.role === 'Administrator') {
            //     notifiedId.push(existUser?.creatorId)
            //     readBy.push({
            //         userId: existUser?.creatorId,
            //         role: existUser?.createdBy
            //     })
            // }

            if (existUser.role === 'Employee' || existUser.role === 'Manager') {
                if (jobDetail && jobDetail.assignManager) {
                    const assignManager = await User.findOne({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
                    notifiedId.push(jobDetail.assignManager);
                    readBy.push({
                        userId: jobDetail.assignManager,
                        role: assignManager?.role
                    })
                }
                const administrators = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                administrators.map((admin) => {
                    notifiedId.push(admin?._id)
                    readBy.push({
                        userId: admin?._id,
                        role: admin?.role
                    })
                })
            }

            const superAdmins = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            superAdmins.map((sa) => {
                notifiedId.push(sa?._id)
                readBy.push({
                    userId: sa?._id,
                    role: sa?.role
                })
            })

            const firstName = existUser.personalDetails?.firstName || ""
            const lastName = existUser.personalDetails?.lastName || ""
            const notification = new Notification({
                userId,
                // userName: `${firstName} ${lastName}`,
                companyId: existUser?.companyId,
                notifiedId,
                type: 'Clock Out',
                message: `${firstName} ${lastName} clocked out successfully at ${currentDate}`,
                readBy
            });
            await notification.save();

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while clock out:", error);
        return res.send({ status: 500, message: "Something went wrong while clock out!" })
    }
}

exports.getUsersAssignClients = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.body.userId || req.user._id.toString()
            const { jobId } = req.body

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
            if(!jobDetail){
                return res.send({ status: 403, message: 'Job title not found' })
            }

            const clients = await Client.find({ _id: { $in: jobDetail?.assignClient }, isDeleted: { $ne: true } }).select('_id clientName')

            const assignClients = clients.map(client => ({
                clientId: client?._id,
                clientName: client?.clientName
            }))

            return res.send({ status: 200, message: 'Clients fetched successfully', assignClients })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error("Error occurred while fetching user's clients:", error)
        return res.send({ status: 500, message: "Error occurred while fetching user's clients!" })
    }
}

exports.getUsersAssignLocations = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.body.userId || req.user._id.toString()
            const { jobId } = req.body

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobDetail = existUser?.jobDetails.find(job => job._id.toString() == jobId)
            if(!jobDetail){
                return res.send({ status: 403, message: 'Job title not found' })
            }

            const locations = await Location.find({ _id: { $in: jobDetail?.location }, isDeleted: { $ne: true } }).select('_id locationName')

            const assignLocations = locations.map(loc => ({
                locationId: loc?._id,
                locationName: loc?.locationName
            }))

            return res.send({ status: 200, message: 'Locations fetched successfully', assignLocations })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error("Error occurred while fetching user's locations:", error)
        return res.send({ status: 500, message: "Error occurred while fetching user's locations!" })
    }
}

exports.clockInForEmployee = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
    //     if(allowedRoles.includes(req.user.role)){
    //         const {
    //             date,
    //             startTime,
    //             userId,
    //             jobId,
    //             clientId
    //         } = req.body

    //         if(!date || !startTime){
    //             return res.send({ status: 400, message: "Date and start time are required" })
    //         }

    //         const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    //         if (!existUser) {
    //             return res.send({ status: 404, message: "User not found" })
    //         }

    //         let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
    //         if(!jobDetail){
    //             return res.send({ status: 404, message: 'JobTitle not found' })
    //         }

    //         let user_location
    //         if(jobDetail?.isWorkFromOffice){
    //             user_location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
    //             if(!user_location){
    //                 return res.send({ status: 404, message: 'Location not found' })
    //             }
    //         } else {
    //             user_location = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
    //             if(!user_location){
    //                 return res.send({ status: 404, message: 'Client not found' })
    //             }
    //         }

    //         let timesheet
    //         if(jobDetail?.isWorkFromOffice){
    //             timesheet = await Timesheet.findOne({ userId, locationId: jobDetail?.location, jobId, date, isDeleted: { $ne: true } })
    //         } else {
    //             timesheet = await Timesheet.findOne({ userId, clientId, jobId, date, isDeleted: { $ne: true } })
    //         }

    //         const assignedTask = await Task.findOne({ userId, clientId, jobId, taskDate: date, isDeleted: { $ne: true } })
    //         if(!assignedTask){
    //             return res.send({ status: 404, message: `No tasks were assigned for ${existUser?.personalDetails?.lastName ? `'${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}'` : `'${existUser?.personalDetails?.firstName}'`} today!` })
    //         }

    //         if (!timesheet) {
    //             timesheet = new Timesheet({
    //                 userId,
    //                 jobId,
    //                 date,
    //                 locationId: jobDetail?.location || "",
    //                 clientId: clientId || "",
    //                 clockinTime: [],
    //                 totalHours: '0h 0m 0s'
    //             })
    //             if(assignedTask){
    //                 const taskStartTime = moment(assignedTask?.startTime, 'HH:mm')
    //                 const allowedClockInTime = moment(taskStartTime).add(user_location?.graceTime, 'minutes')
    //                 const currentTime = moment().utc()
    //                 if (currentTime.isAfter(allowedClockInTime)) {
    //                     await Task.findOneAndUpdate({ _id: assignedTask._id }, { $set: { isLate: true } })
    //                 }
    //             }
    //         }

    //         const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]

    //         if (lastClockin && !lastClockin.clockOut) {
    //             return res.send({ status: 400, message: "Please clock out before clockin again." })
    //         }

    //         timesheet.clockinTime.push({
    //             clockIn: momentTimeZone.tz(`${date}T${startTime}`, 'Europe/London').utc().toDate(),
    //             clockOut: "",
    //             isClockin: true
    //         })
            
    //         timesheet.isTimerOn = true
    //         await timesheet.save()

    //         return res.send({ status: 200, message: 'Clock IN successfully', timesheet })

    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while clock-IN:', error)
    //     return res.send({ status: 500, message: 'Error occurred while clock-IN!' })
    // }
}

exports.clockOutForEmployee = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
    //     if(allowedRoles.includes(req.user.role)){
    //         const {
    //             date,
    //             endTime,
    //             userId,
    //             jobId,
    //             clientId
    //         } = req.body

    //         if(!date || !endTime){
    //             return res.send({ status: 400, message: "Date and end time are required" })
    //         }

    //         const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    //         if (!existUser) {
    //             return res.send({ status: 404, message: "User not found" })
    //         }

    //         let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
    //         if(!jobDetail){
    //             return res.send({ status: 404, message: 'JobTitle not found' })
    //         }

    //         let user_location
    //         if(jobDetail?.isWorkFromOffice){
    //             user_location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
    //             if(!user_location){
    //                 return res.send({ status: 404, message: 'Location not found' })
    //             }
    //         } else {
    //             user_location = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
    //             if(!user_location){
    //                 return res.send({ status: 404, message: 'Client not found' })
    //             }
    //         }

    //         let timesheet
    //         if(jobDetail?.isWorkFromOffice){
    //             timesheet = await Timesheet.findOne({ userId, locationId: jobDetail?.location, jobId, date, isDeleted: { $ne: true } })
    //         } else {
    //             timesheet = await Timesheet.findOne({ userId, clientId, jobId, date, isDeleted: { $ne: true } })
    //         }

    //         if (!timesheet) {
    //             return res.send({ status: 404, message: "No timesheet found for today." })
    //         }

    //         const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]
    //         if (!lastClockin || lastClockin.clockOut) {
    //             return res.send({ status: 400, message: "You can't clock-out without an active clock-in." })
    //         }

    //         lastClockin.clockOut = momentTimeZone.tz(`${date}T${endTime}`, 'Europe/London').subtract(user_location?.breakTime, 'minutes').utc().toDate()
    //         lastClockin.isClockin = false

    //         const clockInTime = moment(lastClockin.clockIn).toDate()
    //         const clockOutTime = moment(lastClockin.clockOut).toDate()            

    //         const duration = formatDuration(clockInTime, clockOutTime)
    //         lastClockin.totalTiming = duration

    //         if (timesheet.totalHours == '0h 0m 0s') {
    //             timesheet.totalHours = duration
    //         } else {
    //             const result = addDurations(timesheet.totalHours, duration)
    //             timesheet.totalHours = result
    //         }

    //         timesheet.isTimerOn = false
    //         await timesheet.save()

    //         const startOfWeek = moment().startOf('isoWeek').format('YYYY-MM-DD')
    //         const endOfWeek = moment().endOf('isoWeek').format('YYYY-MM-DD')           

    //         const weeklyTimesheets = await Timesheet.find({
    //             userId,
    //             isDeleted: { $ne: true },
    //             date: { $gte: startOfWeek, $lte: endOfWeek }
    //         })

    //         const totalWeeklyHours = weeklyTimesheets.reduce((total, ts) => {
    //             return addDurations(total, ts.totalHours);
    //         }, "0h 0m 0s")

    //         const weeklyWorkingHours = jobDetail?.weeklyWorkingHours

    //         const weeklyOvertime = subtractDurations(totalWeeklyHours, `${weeklyWorkingHours}h 0m 0s`)
            
    //         if(weeklyOvertime !== '0h 0m 0s') {
    //             timesheet.isOverTime = true
    //             timesheet.overTime = weeklyOvertime
    //         }

    //         await timesheet.save()

    //         return res.send({ status: 200, message: 'Clock OUT successfully', timesheet })

    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while clock-OUT:', error)
    //     return res.send({ status: 500, message: 'Error occurred while clock-OUT!' })
    // }
}

// for clock in/out frontend page
exports.getOwnTodaysTimeSheet = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50

            const skip = (page - 1) * limit

            const userId = req.body.userId || req.user._id
            const { clientId, locationId } = req.body
            const { jobId } = req.body

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: 'User not found' })
            }

            let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const currentDate = moment().format('YYYY-MM-DD')
            let timesheet
            let totalTimesheets

            if(jobDetail?.isWorkFromOffice){
                // timesheet = await Timesheet.findOne({ userId, locationId: jobDetail?.location, jobId, date: currentDate, isDeleted: { $ne: true } }).lean().skip(skip).limit(limit)
                // totalTimesheets = await Timesheet.findOne({ userId, locationId: jobDetail?.location, clientId, jobId, date: currentDate, isDeleted: { $ne: true } }).countDocuments()
                // const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
                const location = jobDetail?.location?.find(locationIds => locationIds == locationId)
                if(!location){
                    return res.send({ status: 404, message: 'Location not found' })
                }
                timesheet = await Timesheet.findOne({ userId, locationId, jobId, isTimerOn: true, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean()
                if(!timesheet){
                    timesheet = await Timesheet.findOne({ userId, locationId, jobId, date: currentDate, isDeleted: { $ne: true } })
                }
            } else {
                const client = jobDetail?.assignClient?.find(clientIds => clientIds == clientId)
                if(!client){
                    return res.send({ status: 404, message: 'Client not found' })
                }

                // timesheet = await Timesheet.findOne({ userId, clientId, jobId, date: currentDate, isDeleted: { $ne: true } }).lean().skip(skip).limit(limit)
                // totalTimesheets = await Timesheet.findOne({ userId, clientId, jobId, date: currentDate, isDeleted: { $ne: true } }).countDocuments()
                timesheet = await Timesheet.findOne({ userId, clientId, jobId, isTimerOn: true, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean()
                if(!timesheet){
                    timesheet = await Timesheet.findOne({ userId, clientId, jobId, date: currentDate, isDeleted: { $ne: true } })
                }
            }

            if (timesheet) {
                timesheet.clockinTime = timesheet.clockinTime.map(entry => {
                    const clockInStr = entry.clockIn ? convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss") : ""
                    const clockOutStr = entry.clockOut ? convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""

                    return {
                        ...entry.toObject?.() ?? entry,
                        clockIn: clockInStr,
                        clockOut: clockOutStr,
                    }
                })
            }

            return res.send({
                status: 200,
                message: 'Timesheet fetched successfully.',
                timesheet: timesheet ? timesheet : {},
                // totalTimesheets,
                // totalPages: Math.ceil(totalTimesheets / limit) || 1,
                // currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error occurred while fetching timesheet:', error);
        return res.send({ status: 500, message: "Something went wrong while fetching the timesheet!" });
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50

    //         const skip = (page - 1) * limit

    //         const userId = req.body.userId || req.user._id
    //         const clientId = req.body.clientId
    //         const { jobId } = req.body

    //         const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    //         if (!existUser) {
    //             return res.send({ status: 404, message: 'User not found' })
    //         }

    //         let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
    //         if(!jobDetail){
    //             return res.send({ status: 404, message: 'JobTitle not found' })
    //         }

    //         const currentDate = moment().format('YYYY-MM-DD')
    //         let timesheet
    //         let totalTimesheets

    //         if(jobDetail?.isWorkFromOffice){
    //             // timesheet = await Timesheet.findOne({ userId, locationId: jobDetail?.location, jobId, date: currentDate }).lean().skip(skip).limit(limit)
    //             // totalTimesheets = await Timesheet.findOne({ userId, locationId: jobDetail?.location, clientId, jobId, date: currentDate }).countDocuments()
    //             timesheet = await Timesheet.findOne({ userId, locationId: jobDetail?.location, jobId }).sort({ createdAt: -1 }).lean()
    //         } else {
    //             const client = jobDetail?.assignClient?.map(clientIds => clientIds == clientId)
    //             if(!client){
    //                 return res.send({ status: 404, message: 'Client not found' })
    //             }

    //             // timesheet = await Timesheet.findOne({ userId, clientId, jobId, date: currentDate }).lean().skip(skip).limit(limit)
    //             // totalTimesheets = await Timesheet.findOne({ userId, clientId, jobId, date: currentDate }).countDocuments()
    //             timesheet = await Timesheet.findOne({ userId, clientId, jobId }).sort({ createdAt: -1 }).lean()
    //         }

    //         if (timesheet) {
    //             timesheet.clockinTime = timesheet.clockinTime.map(entry => {
    //                 const clockInStr = entry.clockIn ? convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss") : ""
    //                 const clockOutStr = entry.clockOut ? convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""

    //                 return {
    //                     ...entry.toObject?.() ?? entry,
    //                     clockIn: clockInStr,
    //                     clockOut: clockOutStr,
    //                 }
    //             })
    //         }

    //         return res.send({
    //             status: 200,
    //             message: 'Timesheet fetched successfully.',
    //             timesheet: timesheet ? timesheet : {},
    //             // totalTimesheets,
    //             // totalPages: Math.ceil(totalTimesheets / limit) || 1,
    //             // currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error('Error occurred while fetching timesheet:', error);
    //     return res.send({ status: 500, message: "Something went wrong while fetching the timesheet!" });
    // }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50

    //         const skip = (page - 1) * limit

    //         const userId = req.body.userId || req.user._id
    //         const clientId = req.body.clientId
    //         const { jobId } = req.body

    //         const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    //         if (!existUser) {
    //             return res.send({ status: 404, message: 'User not found' })
    //         }

    //         let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
    //         if(!jobDetail){
    //             return res.send({ status: 404, message: 'JobTitle not found' })
    //         }

    //         const currentDate = moment().format('YYYY-MM-DD')
    //         let timesheet
    //         let totalTimesheets

    //         if(jobDetail?.isWorkFromOffice){
    //             console.log('in location work')
    //             timesheet = await Timesheet.findOne({ userId, locationId: jobDetail?.location, jobId, date: currentDate }).lean().skip(skip).limit(limit)
    //             totalTimesheets = await Timesheet.findOne({ userId, locationId: jobDetail?.location, clientId, jobId, date: currentDate }).countDocuments()
    //         } else {
    //             const client = jobDetail?.assignClient?.map(clientIds => clientIds == clientId)
    //             if(!client){
    //                 return res.send({ status: 404, message: 'Client not found' })
    //             }

    //             timesheet = await Timesheet.findOne({ userId, clientId, jobId, date: currentDate }).lean().skip(skip).limit(limit)
    //             totalTimesheets = await Timesheet.findOne({ userId, clientId, jobId, date: currentDate }).countDocuments()
    //         }

    //         if (timesheet) {
    //             timesheet.clockinTime = timesheet.clockinTime.map(entry => {
    //                 const clockInStr = entry.clockIn ? convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss") : ""
    //                 const clockOutStr = entry.clockOut ? convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""

    //                 return {
    //                     ...entry.toObject?.() ?? entry,
    //                     clockIn: clockInStr,
    //                     clockOut: clockOutStr,
    //                 }
    //             })
    //         }

    //         return res.send({
    //             status: 200,
    //             message: 'Timesheet fetched successfully.',
    //             timesheet: timesheet ? timesheet : {},
    //             totalTimesheets,
    //             totalPages: Math.ceil(totalTimesheets / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error('Error occurred while fetching timesheet:', error);
    //     return res.send({ status: 500, message: "Something went wrong while fetching the timesheet!" });
    // }
}

function getStartAndEndDateForViewHours ({ startDate, endDate }) {
    let start, end
    if(startDate && endDate){
        start = moment(startDate).startOf('day')
        end = moment(endDate).endOf('day')
    } else if(startDate && (!endDate || endDate == "")) {
        start = moment(startDate).startOf('day')
        end = null
    } else if((!startDate || startDate == "") && endDate){
        start = null
        end = moment(endDate).endOf('day')
    } else {
        start = null
        end = null
    }

    return {
        startDate: start ? start.format('YYYY-MM-DD') : null,
        endDate: end ? end.format('YYYY-MM-DD') : null
    }
}

async function getTimesheetReportForViewHours (users, clientIds, locationIds, fromDate, toDate, isWorkFromOffice) {
    const finalResponse = []

    const userFilter = Array.isArray(users) && users.length > 0 ? users.map(id => new mongoose.Types.ObjectId(id)) : null

    const clientFilter = Array.isArray(clientIds) && clientIds.length > 0 ? clientIds : null
    const locationFilter = Array.isArray(locationIds) && locationIds.length > 0 ? locationIds : null

    let clientQuery = clientFilter ? { _id: { $in: clientFilter } } : {}
    let locationQuery = locationFilter ? { _id: { $in: locationFilter } } : {}

    const clientDocs = await Client.find(clientQuery).lean()
    const locationDocs = await Location.find(locationQuery).lean()
    // console.log('clientDocs:', clientDocs)
    const clientMap = new Map(clientDocs.map(client => [client?._id?.toString(), client]))
    const locationMap = new Map(locationDocs.map(location => [location?._id?.toString(), location]))

    const matchQuery = {
        isDeleted: { $ne: true },
        date: {
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

    // console.log('matchQuery:', matchQuery)

    const timesheetDocs = await Timesheet.aggregate([
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
        {
            $addFields: {
                clockinTime: {
                    $filter: {
                        input: '$clockinTime',
                        as: 'entry',
                        cond: { $eq: ['$$entry.isDeleted', false] }
                    }
                }
            }
        },
        { $sort: { createdAt: -1 } },
        // {
        //     $facet: {
        //         timesheet: [
        //             { $skip: skip },
        //             { $limit: limit },
        //             {
        //                 $project: {
        //                     _id: 1,
        //                     userId: 1,
        //                     clientId: 1,
        //                     date: 1,
        //                     totalHours: 1,
        //                     overTime: 1,
        //                     clockinTime: 1,
        //                     'user._id': 1,
        //                     'user.personalDetails': 1,
        //                     'user.jobDetails': 1
        //                 }
        //             }
        //         ],
        //         count: [{ $count: 'count' }]
        //     }
        // },
        {
            $project: {
                _id: 1,
                userId: 1,
                jobId: 1,
                clientId: 1,
                locationId: 1,
                date: 1,
                totalHours: 1,
                overTime: 1,
                clockinTime: 1,
                'user._id': 1,
                'user.personalDetails': 1,
                'user.jobDetails': 1
            }
        }
    ])

    for(const TS of timesheetDocs){
        const user = TS?.user
        let client, location
        if(isWorkFromOffice == 'false'){
            client = clientMap.get(TS?.clientId?.toString())
            if (!client) continue
        } else if(isWorkFromOffice == 'true') {
            location = locationMap.get(TS?.locationId?.toString())
            if (!location) continue
        }
        for(const job of user?.jobDetails){
            if(job?._id?.toString() == TS?.jobId?.toString()){
                for(const CI of TS?.clockinTime){
                    finalResponse.push({
                        _id: TS?._id,
                        entryId: CI?._id,
                        userName: user?.personalDetails?.lastName ? `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}` : `${user?.personalDetails?.firstName}`,
                        jobTitle: job?.jobTitle,
                        clientName: client?.clientName,
                        locationName: location?.locationName,
                        clockIn: CI?.clockIn ? convertToEuropeanTimezone(CI?.clockIn).format("YYYY-MM-DD HH:mm:ss") : "",
                        clockOut: CI?.clockOut ? convertToEuropeanTimezone(CI?.clockOut).format("YYYY-MM-DD HH:mm:ss") : "",
                        totalTiming: CI?.totalTiming,
                    })
                }
            }
        }
    }

    return finalResponse
}

// for view hours frontend page
exports.getAllTimeSheets = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const search = req.query.search?.toLowerCase() || ""

            const skip = (page - 1) * limit
            // const userId = req.body.userId || req.user._id

            const { userId, clientId, locationId } = req.body
            let { startDate, endDate, isWorkFromOffice, companyId } = req.query
            // const { month, year } = req.query

            const user = await User.findOne({ _id: req.user._id.toString(), isDeleted: { $ne: true } })
            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }

            if(!startDate || startDate == ""){
                startDate = moment('2025-01-01T00:00:01.000Z').format('YYYY-MM-DD')
            }

            const { startDate: fromDate, endDate: toDate } = getStartAndEndDateForViewHours({ startDate, endDate })

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

            const reports = await getTimesheetReportForViewHours(userIds, clientIds, locationIds, fromDate, toDate, isWorkFromOffice)

            let filteredReports = reports

            if (search) {
                filteredReports = reports.filter(item => {
                    return (
                        item?.userName?.toLowerCase().includes(search) ||
                        item?.jobTitle?.toLowerCase().includes(search) ||
                        item?.clientName?.toLowerCase().includes(search) ||
                        item?.locationName?.toLowerCase().includes(search)
                    )
                })
            }

            const timesheets = filteredReports.slice(skip, skip + limit)
            const totalTimesheets = filteredReports.length

            return res.send({
                status: 200,
                message: 'Timesheets fetched successfully.',
                timesheets: timesheets.length > 0 ? timesheets : [],
                totalTimesheets,
                totalPages: Math.ceil(totalTimesheets / limit) || 1,
                currentPage: page || 1
            })

        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error occurred while fetching time sheet:', error)
        return res.send({ status: 500, message: 'Something went wrong while fetching time sheet!' })
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50

    //         const skip = (page - 1) * limit
    //         const userId = req.body.userId || req.user._id

    //         const { jobId, clientId } = req.body
    //         const { month, year } = req.query

    //         const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    //         if (!user) {
    //             return res.send({ status: 404, message: 'User not found' })
    //         }

    //         const jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
    //         if(!jobDetail){
    //             return res.send({ status: 404, message: 'JobTitle not found' })
    //         }

    //         let baseQuery = {
    //             userId,
    //             jobId: jobId.toString(),
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

    //         const currentDate = moment()
    //         let filterYear = year || currentDate.format('YYYY')
    //         let filterMonth = month ? month.padStart(2, '0') : null

    //         const joiningDate = jobDetail?.joiningDate ? moment(jobDetail?.joiningDate).startOf('day') : null
    //         const joiningYear = joiningDate ? joiningDate.format('YYYY') : null

    //         let startDate, endDate

    //         if (!month && !year) {
    //             filterYear = currentDate.format('YYYY')
    //             filterMonth = currentDate.format('MM')
    //             startDate = moment(`${filterYear}-${filterMonth}-01`).startOf('month').toDate()
    //             endDate = moment(startDate).endOf('month').toDate()
    //             if(filterYear === joiningYear && filterMonth === joiningDate.format('MM')){
    //                 startDate = moment(joiningDate).toDate()
    //                 endDate = moment(startDate).endOf('month').toDate()
    //             }
    //         } else if (month && !year) {
    //             filterYear = currentDate.format('YYYY');
    //             startDate = moment(`${filterYear}-${filterMonth}-01`).startOf('month').toDate()
    //             endDate = moment(startDate).endOf('month').toDate()
    //             if(month === joiningDate.format('MM') && filterYear === joiningYear){
    //                 startDate = moment(joiningDate).toDate()
    //                 endDate = moment(startDate).endOf('month').toDate()
    //             }               
    //         } else if (!month && year) {
    //             startDate = moment(`${filterYear}-01-01`).startOf('year').toDate()
    //             endDate = moment(startDate).endOf('year').toDate()
    //             if(filterYear === joiningYear){
    //                 startDate = moment(joiningDate).toDate()
    //                 endDate = moment(startDate).endOf('year').toDate()
    //             }
    //         } else {
    //             startDate = moment(`${filterYear}-${filterMonth}-01`).startOf('month').toDate()
    //             endDate = moment(startDate).endOf('month').toDate()
    //             if(filterYear === joiningYear && filterMonth === joiningDate.format('MM')) {
    //                 startDate = moment(joiningDate).toDate()
    //                 endDate = moment(startDate).endOf('month').toDate()
    //             }
    //         }

    //         baseQuery.createdAt = { $gte: startDate, $lte: endDate }

    //         const timesheets = await Timesheet.find(baseQuery).lean().sort({ createdAt: -1 }).skip(skip).limit(limit)

    //         const totalTimesheets = await Timesheet.find(baseQuery).sort({ createdAt: -1 }).countDocuments()

    //         for(const timesheet of timesheets){
    //             timesheet.clockinTime = timesheet.clockinTime.map(entry => {
    //                 const clockInStr = entry.clockIn ? convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss") : ""
    //                 const clockOutStr = entry.clockOut ? convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""
    
    //                 return {
    //                     ...entry.toObject?.() ?? entry,
    //                     clockIn: clockInStr,
    //                     clockOut: clockOutStr,
    //                 }
    //             })
    //         }

    //         return res.send({
    //             status: 200,
    //             message: 'Timesheets fetched successfully.',
    //             timesheets: timesheets.length > 0 ? timesheets : [],
    //             totalTimesheets,
    //             totalPages: Math.ceil(totalTimesheets / limit) || 1,
    //             currentPage: page || 1
    //         })

    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error('Error occurred while fetching time sheet:', error)
    //     return res.send({ status: 500, message: 'Something went wrong while fetching time sheet!' })
    // }
}

exports.getUsersJobLocations = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { companyId, userId } = req.query

            let matchConditions = [ { isDeleted: { $ne: true } } ]
        
            if (companyId && companyId !== 'allCompany') {
                matchConditions.push({
                    companyId: new mongoose.Types.ObjectId(String(companyId))
                })
            }

            if (mongoose.Types.ObjectId.isValid(userId)) {
                matchConditions.push({ _id: new mongoose.Types.ObjectId(String(userId)) })
            }

            let pipeline = [
                { $match: { $and: matchConditions } },
                { $unwind: "$jobDetails" },
                { $match: { "jobDetails.isWorkFromOffice": true } },
                { $unwind: "$jobDetails.location" },
                { $addFields: {
                    locationObjectId: {
                        $convert: {
                            input: "$jobDetails.location",
                            to: "objectId",
                            onError: null,
                            onNull: null
                        }
                    }
                } },
                { $match: { locationObjectId: { $ne: null } } },
                { $group: { _id: "$locationObjectId" } },
                { $lookup: {
                    from: "locations",
                    localField: "_id",
                    foreignField: "_id",
                    as: "location"
                } },
                { $unwind: "$location" },
                { $match: { "location.isDeleted": { $ne: true } } },
                { $project: {
                    _id: 1,
                    locationName: "$location.locationName"
                } },
                { $sort: { locationName: 1 } },
            ]

            const userLocations = await User.aggregate(pipeline)

            return res.send({ status: 200, message: "User's job locations fetched successfully", locations: userLocations })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error("Error occurred while fetching user's job locations:", error)
        return res.send({ status: 500, message: "Error occurred while fetching user's job locations!" })
    }
}

exports.addTimesheetEntry = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const { userId, jobId, clientId, locationId, clockIn, clockOut, isWorkFromOffice, comment } = req.body

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobDetail = user?.jobDetails.find(job => job._id.toString() === jobId.toString())
            if(!jobDetail){
                return res.send({ status: 404, message: 'Job title not found' })
            }

            const timesheetDate = moment(clockIn).format('YYYY-MM-DD')

            const assignedTask = await Task.findOne({ userId, jobId, taskDate: timesheetDate, isDeleted: { $ne: true } })
            if(!assignedTask && user.role == 'Employee'){
                return res.send({ status: 404, message: "You don't have any tasks assigned for today!" })
            }

            const taskStartTime = moment(`${timesheetDate} ${assignedTask.startTime}`, 'YYYY-MM-DD HH:mm')
            const checkInTime = moment(clockIn, 'YYYY-MM-DD HH:mm')

            if(checkInTime.isBefore(taskStartTime)){
                return res.send({ status: 400, message: `You can only clock in after the task time ${convertToEuropeanTimezone(`${assignedTask.taskDate}T${assignedTask.startTime}:00.000Z`).format('LT')}.` })
            }
            
            let existTimesheet, location, client, breakTime
            console.log('isWorkFromOffice:', isWorkFromOffice)
            console.log('jobDetail?.isWorkFromOffice:', jobDetail)
            if(isWorkFromOffice == true && jobDetail?.isWorkFromOffice == true){
                const existAssignLocation = jobDetail?.location.find(loc => loc?.toString() == locationId)
                if(!existAssignLocation){
                    return res.send({ status: 404, message: 'Location not assigned to this job'})
                }
                existTimesheet = await Timesheet.findOne({ userId, jobId, locationId, date: timesheetDate, isDeleted: { $ne: true } })
                location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
                breakTime = location?.breakTime || 0
            } else if(isWorkFromOffice == false && jobDetail?.isWorkFromOffice == false){
                const existAssignClient = jobDetail?.assignClient.find(client => client?.toString() == clientId)
                if(!existAssignClient){
                    return res.send({ status: 404, message: 'Client not assigned to this job'})
                }
                existTimesheet = await Timesheet.findOne({ userId, jobId, clientId, date: timesheetDate, isDeleted: { $ne: true } })
                client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                console.log('client:', client)
                breakTime = client?.breakTime || 0
            }

            if(existTimesheet && existTimesheet?.isTimerOn){
                return res.send({ status: 403, message: 'You have already clocked in. Please clock out before starting a new session.' })
            } else if(existTimesheet && !existTimesheet?.isTimerOn) {
                const timesheetId = existTimesheet?._id.toString()

                const duration = formatDuration(new Date(clockIn), new Date(clockOut))

                const newEntry = {
                    clockIn: momentTimeZone.tz(clockIn, 'YYYY-MM-DD HH:mm', 'Europe/London').utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                    clockOut: momentTimeZone.tz(clockOut, 'YYYY-MM-DD HH:mm', 'Europe/London').utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                    totalTiming: duration,
                    isClockin: false,
                    comment,
                }

                await Timesheet.findOneAndUpdate(
                    { _id: new mongoose.Types.ObjectId(timesheetId) },
                    {
                        $push: {
                            clockinTime: newEntry
                        }
                    },
                    { new: true }
                )

                const updatedTimesheet = await Timesheet.findOne({ _id: timesheetId, isDeleted: { $ne: true } })
                let shouldDeductBreak = updatedTimesheet?.breakTimeDeducted

                let totalSeconds = updatedTimesheet.clockinTime.reduce((acc, entry) => acc + convertToSeconds(entry.totalTiming), 0)
                const taskTotalHours = formatDuration(new Date(`${timesheetDate} ${assignedTask?.startTime}`), new Date(`${timesheetDate} ${assignedTask?.endTime}`))

                if(!updatedTimesheet?.breakTimeDeducted && totalSeconds > (breakTime * 60)){
                    shouldDeductBreak = true
                }

                totalSeconds -= (breakTime * 60)

                let isOverTime = false
                let overTime = subtractDurations(formatTimeFromSeconds(totalSeconds), taskTotalHours)

                if(overTime !== "0h 0m 0s"){
                    isOverTime = true
                }

                await Timesheet.findByIdAndUpdate(timesheetId, {
                    totalHours: formatTimeFromSeconds(totalSeconds),
                    isOverTime,
                    overTime,
                    breakTimeDeducted: shouldDeductBreak
                })
                
                return res.send({ status: 200, message: 'Timesheet entry created successfully' })
            } else {
                const duration = formatDuration(new Date(clockIn), new Date(clockOut))
                const taskTotalHours = formatDuration(new Date(`${timesheetDate} ${assignedTask?.startTime}`), new Date(`${timesheetDate} ${assignedTask?.endTime}`))
                // const totalHours = convertToSeconds(duration) - (breakTime * 60)
                const totalHours = subtractBreakTimeFromTotalWorkingHours(duration, breakTime)
                console.log('duration:', duration)
                console.log('taskTotalHours:', taskTotalHours)
                console.log('totalHours:', totalHours)

                let isOverTime = false
                let overTime = subtractDurations(duration, taskTotalHours)
                console.log('overTime:', overTime)

                if(overTime !== "0h 0m 0s"){
                    isOverTime = true
                }

                const newTimesheet = {
                    userId,
                    jobId,
                    clientId,
                    locationId,
                    date: timesheetDate,
                    clockinTime: [{
                        clockIn: momentTimeZone.tz(clockIn, 'YYYY-MM-DD HH:mm', 'Europe/London').utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                        clockOut: momentTimeZone.tz(clockOut, 'YYYY-MM-DD HH:mm', 'Europe/London').utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                        totalTiming: duration,
                        isClockin: false,
                        comment,
                    }],
                    breakTimeDeducted: true, // true or false
                    // totalHoursFormated: formatTimeFromSeconds(totalHours),
                    totalHours,
                    isOverTime, // true or false
                    overTime,
                }
                
                const timesheet = await Timesheet.create(newTimesheet)

                return res.send({ status: 200, message: 'Timesheet entry created successfully', timesheet })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while creating timesheet entry:', error)
        return res.send({ status: 500, message: 'Error occurred while creating timesheet entry!' })
    }
}

exports.getTimesheetEntryData = async (req, res) => {
    try {
        const allowedRole = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRole.includes(req.user.role)){
            const { timesheetId, entryId } = req.query

            const timesheet = await Timesheet.findOne({ _id: timesheetId, isDeleted: { $ne: true } })
            if(!timesheet){
                return res.send({ status: 404, message: 'Timesheet not found' })
            }

            const user = await User.findOne({ _id: timesheet?.userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobDetail = user?.jobDetails.find(job => job._id.toString() === timesheet?.jobId.toString())
            if(!jobDetail){
                return res.send({ status: 404, message: 'Job title not found' })
            }

            const entry = timesheet?.clockinTime.find(entry => entry?._id.toString() == entryId)
            if(!entry){
                return res.send({ status: 404, message: 'Timesheet entry not found' })
            }

            let isWorkFromOffice = false

            if(timesheet?.locationId && timesheet?.locationId !== ""){
                isWorkFromOffice = true
            }

            let location, client
            if(isWorkFromOffice == false){
                client = await Client.findOne({ _id: timesheet?.clientId, isDeleted: { $ne: true } }).select('_id clientName')
                if(!client){
                    return res.send({ status: 404, message: 'Client not found' })
                }
            } else if(isWorkFromOffice == true){
                location = await Location.findOne({ _id: timesheet?.locationId, isDeleted: { $ne: true } }).select('_id locationName')
                if(!location){
                    return res.send({ status: 404, message: 'Location not found' })
                }
            }

            const timesheetData = {
                isWorkFromOffice,
                userId: timesheet?.userId,
                jobId: timesheet?.jobId,
                clientId: timesheet?.clientId,
                locationId: timesheet?.locationId,
                comment: timesheet?.comment,
                clockIn: entry?.clockIn ? convertToEuropeanTimezone(entry?.clockIn).format('YYYY-MM-DD HH:mm:ss') : "",
                clockOut: entry?.clockOut ? convertToEuropeanTimezone(entry?.clockOut).format('YYYY-MM-DD HH:mm:ss') : "",
                userName: user?.personalDetails?.lastName ? `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}` : `${user?.personalDetails?.firstName}`,
                jobTitle: jobDetail?.jobTitle,
                clientName: client?.clientName,
                locationName: location?.locationName,
            }

            return res.send({ status: 200, message: 'Timesheet data fetched successfully', timesheetData })

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching timesheet data:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching timesheet data!' })
    }
}

exports.updateTimesheetEntry = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const { timesheetId, entryId } = req.query
            const { userId, jobId, clientId, locationId, clockIn, clockOut, isWorkFromOffice, comment } = req.body

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobDetail = user?.jobDetails.find(job => job._id.toString() === jobId.toString())
            if(!jobDetail){
                return res.send({ status: 404, message: 'Job title not found' })
            }

            const timesheet = await Timesheet.findOne({ _id: timesheetId, isDeleted: { $ne: true } })
            if(!timesheet){
                return res.send({ status: 404, message: 'Timesheet not found' })
            }

            const entry = timesheet?.clockinTime.find(entry => entry?._id.toString() == entryId)
            if(!entry){
                return res.send({ status: 404, message: 'Timesheet entry not found' })
            }

            if (userId && userId !== timesheet.userId.toString()) {
                return res.send({ status: 400, message: 'Mismatch: Selected employee does not belong to this timesheet' })
            }

            if (jobId && jobId !== timesheet.jobId.toString()) {
                return res.send({ status: 400, message: 'Mismatch: Selected job title does not match the original job title in this timesheet entry' })
            }

            if(isWorkFromOffice == 'true'){
                if (locationId && locationId !== timesheet.locationId.toString()) {
                    return res.send({ status: 400, message: 'Mismatch: Selected location does not match the original location in this timesheet entry' })
                }
            } else if(isWorkFromOffice == 'false') {
                if (clientId && clientId !== timesheet.clientId.toString()) {
                    return res.send({ status: 400, message: 'Mismatch: Selected client does not match the original client in this timesheet entry' })
                }
            }

            const duration = formatDuration(new Date(clockIn), new Date(clockOut))
            const timesheetDate = moment(clockIn).format('YYYY-MM-DD')

            const assignedTask = await Task.findOne({ userId, jobId, taskDate: timesheetDate, isDeleted: { $ne: true } })
            if(!assignedTask && user.role == 'Employee'){
                return res.send({ status: 404, message: "You don't have any tasks assigned for today!" })
            }

            let location, client, breakTime
            if(isWorkFromOffice == 'true' && jobDetail?.isWorkFromOffice == true){
                const existAssignLocation = jobDetail?.location.find(loc => loc?.toString() == locationId)
                if(!existAssignLocation){
                    return res.send({ status: 404, message: 'Location not assigned to this job'})
                }
                location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
                breakTime = location?.breakTime
            } else if(isWorkFromOffice == 'false' && jobDetail?.isWorkFromOffice == false){
                const existAssignClient = jobDetail?.assignClient.find(client => client?.toString() == clientId)
                if(!existAssignClient){
                    return res.send({ status: 404, message: 'Client not assigned to this job'})
                }
                client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                breakTime = client?.breakTime
            }

            timesheet.isTimerOn = false
            entry.isClockin = false
            entry.comment = comment
            entry.clockIn = momentTimeZone.tz(clockIn, 'YYYY-MM-DD HH:mm', 'Europe/London').utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
            entry.clockOut = momentTimeZone.tz(clockOut, 'YYYY-MM-DD HH:mm', 'Europe/London').utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
            entry.totalTiming = duration

            let shouldDeductBreak = timesheet?.breakTimeDeducted
            let totalSeconds = timesheet.clockinTime.reduce((acc, entry) => acc + convertToSeconds(entry.totalTiming), 0)
            const taskTotalHours = formatDuration(new Date(`${timesheetDate} ${assignedTask?.startTime}`), new Date(`${timesheetDate} ${assignedTask?.endTime}`))

            if(!timesheet?.breakTimeDeducted && totalSeconds > (breakTime * 60)){
                shouldDeductBreak = true
            }

            totalSeconds -= (breakTime * 60)

            let isOverTime = false
            let overTime = subtractDurations(formatTimeFromSeconds(totalSeconds), taskTotalHours)

            if(overTime !== "0h 0m 0s"){
                isOverTime = true
            }

            timesheet.totalHours = formatTimeFromSeconds(totalSeconds)
            timesheet.isOverTime = isOverTime
            timesheet.overTime = overTime
            timesheet.breakTimeDeducted = shouldDeductBreak

            await timesheet.save()

            return res.send({ status: 200, message: 'Timesheet entry updated successfully' })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating timesheet entry:', error)
        return res.send({ status: 500, message: 'Error ocurred while updating timesheet entry!' })
    }
}

exports.deleteTimesheetEntry = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const { timesheetId, entryId } = req.query

            const timesheet = await Timesheet.findOne({ _id: timesheetId, isDeleted: { $ne: true } })
            if(!timesheet){
                return res.send({ status: 404, message: 'Timesheet not found' })
            }

            const entry = timesheet?.clockinTime.find(entry => entry?._id.toString() == entryId)
            if(!entry){
                return res.send({ status: 404, message: 'Timesheet entry not found' })
            }

            entry.isDeleted = true
            await timesheet.save()

            const totalHours = convertToSeconds(timesheet?.totalHours) - convertToSeconds(entry?.totalTiming)

            let overTime, isOverTime
            if(convertToSeconds(timesheet?.overTime) > convertToSeconds(entry?.totalTiming)){
                overTime = convertToSeconds(timesheet?.overTime) - convertToSeconds(entry?.totalTiming)
                if(overTime > 0){
                    isOverTime = true
                } else isOverTime = false
            } else {
                overTime = 0
                isOverTime = false
            }

            if(timesheet?.clockinTime?.length > 1){
                await Timesheet.updateOne(
                    { _id: new mongoose.Types.ObjectId(timesheetId) },
                    {
                        $set: {
                            totalHours: formatTimeFromSeconds(totalHours),
                            overTime: formatTimeFromSeconds(overTime),
                            isOverTime: isOverTime,
                        },
                    }                    
                )
            } else {
                await Timesheet.findOneAndUpdate(
                    { _id: timesheetId },
                    { $set: {
                        isDeleted: true
                    } },
                    { new: true },
                )
            }
            return res.send({ status: 200, message: 'Timesheet entry deleted successfully' })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deleting timesheet entry:', error)
        return res.send({ status: 500, message: 'Error occurred while deleting timesheet entry!' })
    }
}

function getStartAndEndDate({ timesheetFrequency, weekDate, startDate, endDate }) {
    let start, end

    if(timesheetFrequency == 'Daily'){
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
    } else if(timesheetFrequency == 'Weekly'){
        if(weekDate){
            const weekDateStr = moment(weekDate)
    
            start = weekDateStr.clone().startOf('isoWeek')
            end = weekDateStr.clone().endOf('isoWeek')
        } else {
            start = moment().startOf('isoWeek')
            end = moment().endOf('isoWeek')
        }
    } else if(timesheetFrequency == 'Monthly'){
        if(startDate && endDate){
            start = moment(startDate).startOf('month')
            end = moment(endDate).endOf('month')
        } else if(startDate && (!endDate || endDate == "")) {
            start = moment(startDate).startOf('month')
            end = moment().endOf('month')
        }  else {
            start = moment().startOf('month')
            end = moment().endOf('month')
        }
    } else {
        start = moment().startOf('day')
        end = moment().endOf('day')
    }

    // if (startDate && endDate) {
    //     start = moment(startDate).startOf('day')
    //     end = moment(endDate).endOf('day')
    // } else if (year && month && month !== "All") {
    //     start = moment({ year: parseInt(year), month: parseInt(month) - 1 }).startOf('month')
    //     end = moment({ year: parseInt(year), month: parseInt(month) - 1 }).endOf('month')
    // } else if (year && month === "All") {
    //     start = moment({ year: parseInt(year) }).startOf('year')
    //     end = moment({ year: parseInt(year) }).endOf('year')
    // } else if (year && week) {
    //     start = moment().year(parseInt(year)).week(parseInt(week)).startOf('week')
    //     end = moment().year(parseInt(year)).week(parseInt(week)).endOf('week')
    // } else if (week) {
    //     const currentYear = moment().year()
    //     start = moment().year(currentYear).week(parseInt(week)).startOf('week')
    //     end = moment().year(currentYear).week(parseInt(week)).endOf('week')
    // } else {
    //     const now = moment()
    //     start = now.startOf('month')
    //     end = now.endOf('month')
    // }

    // if (joiningDate && start.isBefore(joiningDate)) {
    //     start = moment(joiningDate).startOf('day')
    // }

    return {
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD')
    }
}

// exports.getTimesheetReport = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user?.role) || req.token?.role === "Client"){
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 50

//             const skip = (page - 1) * limit

//             const { userIds, clientIds } = req.body
//             const { timesheetFrequency, weekDate } = req.query

//             const { startDate, endDate } = getStartAndEndDate({ timesheetFrequency, weekDate, startDate: req.query.startDate, endDate: req.query.endDate })        


//             const data = await Timesheet.aggregate([
//                 {
//                     $match: {
//                         userId: { $in: userIds.map(id => new mongoose.Types.ObjectId(String(id))) },
//                         clientId: { $in: clientIds.map(id => id) },
//                         date: {
//                             $gte: new Date(startDate),
//                             $lte: new Date(endDate)
//                         }
//                     }
//                 },
//                 // {
//                 //     $lookup: {
//                 //         from: "users",
//                 //         localField: "userId",
//                 //         foreignField: "_id",
//                 //         as: "user"
//                 //     }
//                 // },
//                 // { $unwind: "$user" },
//                 // { $unwind: "$user.jobDetails" },
//                 // {
//                 //     $match: {
//                 //         $expr: {
//                 //             $in: [ "$clientId", "$user.jobDetails.assignClient" ]
//                 //         }
//                 //     }
//                 // },
//                 {
//                     $project: {
//                         _id: 0,
//                         timesheetId: "$_id",
//                         userId: "$userId",
//                         userName: {
//                             $concat: [
//                                 "$user.personalDetails.firstName",
//                                 " ",
//                                 "$user.personalDetails.lastName"
//                             ]
//                         },
//                         // jobRole: "$user.jobDetails.jobTitle",
//                         // clientId: "$clientId",
//                         // date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
//                         // totalHours: "$totalHours",
//                         // checkInTime: "$checkInTime",
//                         // checkOutTime: "$checkOutTime",
//                         // remarks: "$remarks"
//                     }
//                 },
//                 // { $sort: { date: 1, userName: 1 } },
//                 // { $skip: skip },
//                 // { $limit: limit }
//             ])

//             return res.status(200).json({
//                 status: 200,
//                 message: "Timesheet report generated successfully",
//                 data
//             })

//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while fetching timesheet report:', error)
//         return res.send({ status: 500, message: 'Error occurred while fetching timesheet report!' })
//     }
// }

// async function getOptimizedTimesheetReport(users, clientIds, fromDate, toDate, timesheetFrequency) {
//     const finalResponse = [];
//     const weeklyMap = {};

//     // Preload all clients and build a map
//     const clientDocs = await Client.find({ _id: { $in: clientIds } }).lean();
//     const clientMap = new Map(clientDocs.map(client => [client._id.toString(), client]));

//     // Preload all relevant timesheets with user data
//     const timesheetDocs = await Timesheet.aggregate([
//         {
//             $match: {
//                 clientId: { $in: clientIds },
//                 date: {
//                     $gte: moment(fromDate).format('YYYY-MM-DD'),
//                     $lte: moment(toDate).format('YYYY-MM-DD')
//                 }
//             }
//         },
//         {
//             $lookup: {
//                 from: 'users',
//                 localField: 'userId',
//                 foreignField: '_id',
//                 as: 'user'
//             }
//         },
//         { $unwind: '$user' },
//         {
//             $project: {
//                 _id: 1,
//                 userId: 1,
//                 clientId: 1,
//                 date: 1,
//                 totalHours: 1,
//                 overTime: 1,
//                 clockinTime: 1,
//                 'user._id': 1,
//                 'user.personalDetails': 1,
//                 'user.jobDetails': 1
//             }
//         }
//     ]);

//     for (const doc of timesheetDocs) {
//         const user = doc.user;
//         const client = clientMap.get(doc.clientId.toString());
//         if (!client) continue;

//         for (const job of user.jobDetails) {
//             const assignedClientIds = job.assignClient.map(c => c.toString());
//             if (!assignedClientIds.includes(doc.clientId.toString())) continue;

//             const convertedTiming = doc.clockinTime.map(entry => ({
//                 isClockin: entry.isClockin,
//                 clockIn: entry.clockIn ? convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss") : "",
//                 clockOut: entry.clockOut ? convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""
//             }));

//             const totalSeconds = convertToSeconds(doc.totalHours);
//             const overtimeSeconds = convertToSeconds(doc.overTime);
//             const workingSeconds = totalSeconds - overtimeSeconds;

//             const userName = user.personalDetails.lastName
//                 ? `${user.personalDetails.firstName} ${user.personalDetails.lastName}`
//                 : user.personalDetails.firstName;

//             if (timesheetFrequency === 'Weekly') {
//                 const key = `${doc.userId}_${doc.clientId}_${job.jobTitle}`;
//                 if (!weeklyMap[key]) {
//                     weeklyMap[key] = {
//                         userId: doc.userId,
//                         userName,
//                         jobRole: job.jobTitle,
//                         clientName: client.clientName,
//                         clientId: doc.clientId,
//                         workingHoursSeconds: 0,
//                         overTimeSeconds: 0,
//                         totalHoursSeconds: 0,
//                         weeklyDate: []
//                     };
//                 }

//                 weeklyMap[key].weeklyDate.push({
//                     date: doc.date,
//                     clockinTime: convertedTiming
//                 });

//                 weeklyMap[key].workingHoursSeconds += workingSeconds;
//                 weeklyMap[key].overTimeSeconds += overtimeSeconds;
//                 weeklyMap[key].totalHoursSeconds += totalSeconds;
//             } else {
//                 finalResponse.push({
//                     userId: doc.userId,
//                     userName,
//                     jobRole: job.jobTitle,
//                     clientId: client._id.toString(),
//                     clientName: client.clientName,
//                     date: doc.date,
//                     workingHours: formatTimeFromSeconds(workingSeconds),
//                     overTime: doc.overTime,
//                     totalHours: doc.totalHours,
//                     clockinTime: convertedTiming
//                 });
//             }
//         }
//     }

//     // Prepare final weekly responses
//     if (timesheetFrequency === 'Weekly') {
//         for (const key in weeklyMap) {
//             const item = weeklyMap[key];
//             finalResponse.push({
//                 userId: item.userId,
//                 userName: item.userName,
//                 jobRole: item.jobRole,
//                 clientId: item.clientId,
//                 clientName: item.clientName,
//                 workingHours: formatTimeFromSeconds(item.workingHoursSeconds),
//                 overTime: formatTimeFromSeconds(item.overTimeSeconds),
//                 totalHours: formatTimeFromSeconds(item.totalHoursSeconds),
//                 weeklyDate: item.weeklyDate
//             });
//         }
//     }

//     return finalResponse;
// }

// const buildTimesheetPipeline = (matchQuery, timesheetFrequency, skip, limit) => {
//   const base = [
//     { $match: matchQuery },
//     {
//       $lookup: {
//         from: 'users',
//         localField: 'userId',
//         foreignField: '_id',
//         as: 'user'
//       }
//     },
//     { $unwind: '$user' }
//   ]

//   if (timesheetFrequency === 'Weekly') {
//     base.push(
//       { $unwind: '$user.jobDetails' },                       // 1 row per job
//       {
//         // calculate ISO-week & ISO-year from the "date" string
//         $addFields: {
//           isoWeek: { $isoWeek: { $toDate: '$date' } },
//           isoYear: { $isoWeekYear: { $toDate: '$date' } }
//         }
//       },
//       {
//         $group: {
//           _id: {
//             userId: '$userId',
//             clientId: '$clientId',
//             jobTitle: '$user.jobDetails.jobTitle',
//             isoWeek: '$isoWeek',
//             isoYear: '$isoYear'
//           },
//           // keep the daily rows for the front-end calendar popover
//           weeklyData: {
//             $push: { date: '$date', clockinTime: '$clockinTime' }
//           },
//           totalHoursArr: { $push: '$totalHours' },
//           overTimeArr: { $push: '$overTime' },
//           user: { $first: '$user' }
//         }
//       }
//     )
//   }

//   base.push({
//     $facet: {
//       timesheet: [{ $skip: skip }, { $limit: limit }],
//       count: [{ $count: 'count' }]
//     }
//   })
//   return base
// }

// async function getOptimizedTimesheetReport(users, clientIds, fromDate, toDate, timesheetFrequency, skip, limit){
//   try {
//     /* ----------------------------------------------------------- */
//     /* Maps & filters                                               */
//     /* ----------------------------------------------------------- */
//     const userFilter =
//       Array.isArray(users) && users.length > 0
//         ? users.map(id => new mongoose.Types.ObjectId(id))
//         : null

//     const clientFilter =
//       Array.isArray(clientIds) && clientIds.length > 0 ? clientIds : null

//     const matchQuery = {
//       date: {
//         $gte: moment(fromDate).format('YYYY-MM-DD'),
//         $lte: moment(toDate).format('YYYY-MM-DD')
//       }
//     }
//     if (clientFilter) matchQuery.clientId = { $in: clientFilter }
//     if (userFilter) matchQuery.userId = { $in: userFilter }

//     /* ----------------------------------------------------------- */
//     /* Build & run aggregation                                     */
//     /* ----------------------------------------------------------- */
//     const pipeline = buildTimesheetPipeline(matchQuery, timesheetFrequency, skip, limit)
//     const [agg] = await Timesheet.aggregate(pipeline)

//     /* ----------------------------------------------------------- */
//     /* Prepare helper maps (clients)                               */
//     /* ----------------------------------------------------------- */
//     const clientDocs = await Client.find(
//       clientFilter ? { _id: { $in: clientFilter } } : {}
//     ).lean()
//     const clientMap = new Map(clientDocs.map(c => [c._id.toString(), c]))

//     /* ----------------------------------------------------------- */
//     /* Transform aggregation → response                            */
//     /* ----------------------------------------------------------- */
//     const finalResponse = []

//     // Handy util
//     const sumSeconds = arr =>
//       arr.reduce((t, cur) => t + convertToSeconds(cur), 0)

//     if (timesheetFrequency === 'Weekly') {
//       /***************  WEEKLY – aggregation already grouped **************/
//       for (const doc of agg.timesheet) {
//         const {
//           userId,
//           clientId,
//           jobTitle,
//           isoWeek,
//           isoYear
//         } = doc._id
//         const client = clientMap.get(clientId?.toString())
//         if (!client) continue

//         const userName = doc.user.personalDetails.lastName
//           ? `${doc.user.personalDetails.firstName} ${doc.user.personalDetails.lastName}`
//           : doc.user.personalDetails.firstName

//         const totalSeconds = sumSeconds(doc.totalHoursArr)
//         const overtimeSeconds = sumSeconds(doc.overTimeArr)
//         const workingSeconds = totalSeconds - overtimeSeconds

//         finalResponse.push({
//           userId,
//           userName,
//           jobRole: jobTitle,
//           clientId,
//           clientName: client.clientName,
//           week: doc._id.isoWeek,      // in case the UI needs it
//           year: doc._id.isoYear,
//           workingHours: formatTimeFromSeconds(workingSeconds),
//           overTime: formatTimeFromSeconds(overtimeSeconds),
//           totalHours: formatTimeFromSeconds(totalSeconds),
//           weeklyDate: doc.weeklyDate   // list of individual days + clockings
//         })
//       }
//     } else {
//       /***************  DAILY or MONTHLY – identical to your old loop ******/
//       for (const doc of agg.timesheet) {
//         const user = doc.user
//         const client = clientMap.get(doc.clientId?.toString())
//         if (!client) continue

//         // every user may have several jobDetails → check assignment
//         for (const job of user.jobDetails) {
//           const assigned = job.assignClient?.map(c => c?.toString()) ?? []
//           if (!assigned.includes(doc.clientId?.toString())) continue

//           const convertedTiming = doc.clockinTime.map(entry => ({
//             isClockin: entry?.isClockin,
//             clockIn: entry.clockIn
//               ? convertToEuropeanTimezone(entry.clockIn).format(
//                   'YYYY-MM-DD HH:mm:ss'
//                 )
//               : '',
//             clockOut: entry.clockOut
//               ? convertToEuropeanTimezone(entry.clockOut).format(
//                   'YYYY-MM-DD HH:mm:ss'
//                 )
//               : ''
//           }))

//           const totalSeconds = convertToSeconds(doc.totalHours)
//           const overtimeSeconds = convertToSeconds(doc.overTime)
//           const workingSeconds = totalSeconds - overtimeSeconds

//           const userName = user.personalDetails.lastName
//             ? `${user.personalDetails.firstName} ${user.personalDetails.lastName}`
//             : user.personalDetails.firstName

//           finalResponse.push({
//             userId: doc.userId,
//             userName,
//             jobRole: job.jobTitle,
//             clientId: client._id.toString(),
//             clientName: client.clientName,
//             date: doc.date,
//             workingHours: formatTimeFromSeconds(workingSeconds),
//             overTime: doc.overTime,
//             totalHours: doc.totalHours,
//             clockinTime: convertedTiming
//           })
//         }
//       }
//     }

//     return {
//       finalResponse,
//       count: agg.count?.[0]?.count ?? 0
//     }
//   } catch (err) {
//     console.error('Error in getOptimizedTimesheetReport:', err)
//     throw err
//   }
// }

async function getOptimizedTimesheetReport(users, clientIds, locationIds, fromDate, toDate, timesheetFrequency, skip, limit, isWorkFromOffice) {
    try {
        const finalResponse = []
        const weeklyMap = {}

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
            date: {
                $gte: moment(fromDate).format('YYYY-MM-DD'),
                $lte: moment(toDate).format('YYYY-MM-DD')
            }
        }

        if(isWorkFromOffice == "false") {
            if (clientFilter) matchQuery.clientId = { $in: clientFilter }
        } else if(isWorkFromOffice == "true"){
            if (locationFilter) matchQuery.locationId = { $in: locationFilter }
        }

        // if (clientFilter) matchQuery.clientId = { $in: clientFilter }
        if (userFilter) matchQuery.userId = { $in: userFilter }

        const [timesheetDocs] = await Timesheet.aggregate([
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
            {
                $facet: {
                    timesheet: [
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                _id: 1,
                                userId: 1,
                                jobId: 1,
                                clientId: 1,
                                locationId: 1,
                                date: 1,
                                totalHours: 1,
                                overTime: 1,
                                clockinTime: 1,
                                'user._id': 1,
                                'user.personalDetails': 1,
                                'user.jobDetails': 1
                            }
                        }
                    ],
                    count: [{ $count: 'count' }]
                }
            },
            // {
            //     $project: {
            //         _id: 1,
            //         userId: 1,
            //         clientId: 1,
            //         date: 1,
            //         totalHours: 1,
            //         overTime: 1,
            //         clockinTime: 1,
            //         'user._id': 1,
            //         'user.personalDetails': 1,
            //         'user.jobDetails': 1
            //     }
            // }
        ])
 
        for (const doc of timesheetDocs?.timesheet) {
            const user = doc?.user
            let client, location
            if(isWorkFromOffice == 'false'){
                client = clientMap.get(doc?.clientId?.toString())
                if (!client) continue
            } else if(isWorkFromOffice == 'true') {
                location = locationMap.get(doc?.locationId?.toString())
                if (!location) continue
            }
           
            for (const job of user?.jobDetails) {
                if(job?._id.toString() !== doc?.jobId.toString()) continue
                if(isWorkFromOffice == 'false' && job?.isWorkFromOffice == false){
                    const assignedClientIds = job?.assignClient?.map(c => c?.toString())
                    if (!assignedClientIds.includes(doc?.clientId?.toString())) continue
                } else if(isWorkFromOffice == 'true' && job?.isWorkFromOffice == true) {
                    const assignedLocationIds = job?.location?.map(c => c?.toString())
                    if (!assignedLocationIds.includes(doc?.locationId?.toString())) continue
                }

                const convertedTiming = doc?.clockinTime?.map(entry => ({
                    isClockin: entry?.isClockin,
                    clockIn: entry?.clockIn ? convertToEuropeanTimezone(entry?.clockIn).format("YYYY-MM-DD HH:mm:ss") : "",
                    clockOut: entry?.clockOut ? convertToEuropeanTimezone(entry?.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""
                }))

                const totalSeconds = convertToSeconds(doc?.totalHours)
                const overtimeSeconds = convertToSeconds(doc?.overTime)
                const workingSeconds = totalSeconds - overtimeSeconds

                const userName = user?.personalDetails?.lastName
                    ? `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}`
                    : user?.personalDetails?.firstName

                if (timesheetFrequency === 'Weekly') {
                    const weekStart = moment(doc.date).startOf('isoWeek')
                    const weekEnd   = moment(doc.date).endOf('isoWeek')
                    const key = [ doc.userId, doc.clientId, doc.locationId, job.jobTitle, weekStart.format('YYYY-MM-DD') ].join('_')
                    // const key = `${doc?.userId}_${doc?.clientId}_${job?.jobTitle}`
                    if (!weeklyMap[key]) {
                        weeklyMap[key] = {
                            userId: doc?.userId,
                            userName,
                            jobRole: job?.jobTitle,
                            clientName: client?.clientName,
                            locationName: location?.locationName,
                            // clientId: doc?.clientId,
                            workingHoursSeconds: 0,
                            overTimeSeconds: 0,
                            totalHoursSeconds: 0,
                            weekStart: weekStart.format('YYYY-MM-DD'),
                            weekEnd: weekEnd.format('YYYY-MM-DD'),
                            weeklyDate: []
                        }
                    }

                    weeklyMap[key].weeklyDate.push({
                        date: doc?.date,
                        clockinTime: convertedTiming
                    })

                    weeklyMap[key].workingHoursSeconds += workingSeconds
                    weeklyMap[key].overTimeSeconds += overtimeSeconds
                    weeklyMap[key].totalHoursSeconds += totalSeconds
                } else {
                    finalResponse.push({
                        userId: doc?.userId,
                        userName,
                        jobRole: job?.jobTitle,
                        // clientId: client?._id?.toString(),
                        clientName: client?.clientName,
                        locationName: location?.locationName,
                        date: doc?.date,
                        workingHours: formatTimeFromSeconds(workingSeconds),
                        overTime: doc?.overTime,
                        totalHours: doc?.totalHours,
                        clockinTime: convertedTiming
                    })
                }
            }
        }

        if (timesheetFrequency === 'Weekly') {
            for (const key in weeklyMap) {
                const item = weeklyMap[key]
                finalResponse.push({
                    weekStart: item.weekStart,
                    weekEnd: item.weekEnd,
                    userId: item?.userId,
                    userName: item?.userName,
                    jobRole: item?.jobRole,
                    // clientId: item?.clientId,
                    clientName: item?.clientName,
                    locationName: item?.locationName,
                    workingHours: formatTimeFromSeconds(item?.workingHoursSeconds),
                    overTime: formatTimeFromSeconds(item?.overTimeSeconds),
                    totalHours: formatTimeFromSeconds(item?.totalHoursSeconds),
                    weeklyDate: item?.weeklyDate
                })
            }
        }

        if(timesheetFrequency !== 'Weekly'){
            finalResponse.sort((a, b) => new Date(b.date) - new Date(a.date))
        }

        return { finalResponse, count: timesheetDocs?.count[0]?.count }

        // const reports = finalResponse.slice(skip, skip + limit)
        // const totalCount = finalResponse?.length
        // return { finalResponse, count: totalCount }
    } catch (error) {
        console.log('Error occured while optimizing timesheet report:', error)
    }
}

exports.getTimesheetReport = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user?.role) || req.token?.role !== "Client"){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50

            const skip = (page - 1) * limit

            const { userId, clientId, locationId } = req.body
            const { timesheetFrequency, weekDate, isWorkFromOffice, companyId } = req.query
            let { startDate, endDate } = req.query

            const user = await User.findOne({ _id: req.user._id.toString(), isDeleted: { $ne: true } }).lean()
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            if((!startDate || startDate == "") && endDate){
                startDate = moment('2025-01-01T00:00:01.000Z').format('YYYY-MM-DD')
            }

            if(timesheetFrequency !== 'Monthly' && !startDate){
                startDate = moment('2025-01-01T00:00:01.000Z').format('YYYY-MM-DD')
            }

            const { startDate: fromDate, endDate: toDate } = getStartAndEndDate({ timesheetFrequency, weekDate, startDate, endDate })

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

            const finalResponse = await getOptimizedTimesheetReport(userIds, clientIds, locationIds, fromDate, toDate, timesheetFrequency, skip, limit, isWorkFromOffice)

            let totalHours = 0
            
            finalResponse.finalResponse.map(result => {
                totalHours += convertToSeconds(result?.totalHours)
            })

            // const reports = finalResponse.slice(skip, skip + limit)
            // const totalReports = finalResponse.length

            return res.send({
                status: 200,
                message: "Timesheet report fetched successfully",
                totalHours: formatTimeFromSeconds(totalHours),
                reports: finalResponse.finalResponse,
                totalReports: finalResponse.count || 0,
                totalPages: Math.ceil(finalResponse.count / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching timesheet report:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching timesheet report!' })
    }
}

// exports.getTimesheetReport = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
//         if(req.user?.role == 'Superadmin' && req.body.userId == ""){
//             return res.send({
//                 status: 200,
//                 message: 'Timesheet report fetched successfully',
//                 report: [],
//                 totalReports: 0,
//                 totalPages: 1,
//                 currentPage: 1
//             })
//         }
//         if(allowedRoles.includes(req.user?.role) || req.token?.role === "Client"){
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 50

//             const skip = (page - 1) * limit

//             const { jobId, clientId } = req.body
//             const { timesheetFrequency, weekDate } = req.query

//             let employeeReportStatus
//             if(req.token?.role === 'Client'){
//                 const { reportId } = req.body

//                 const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } })
//                 if(!report){
//                     return res.send({ status: 404, message: 'Report not found' })
//                 }

//                 report?.employees.map(emp => {
//                     if(emp?.jobId.toString() == jobId){
//                         employeeReportStatus = emp.status
//                     }
//                 })
//             }

//             const user = await User.findOne({ "jobDetails._id": jobId, isDeleted: { $ne: true } })
//             // const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
//             if(!user){
//                 return res.send({ status: 404, message: 'User not found' })
//             }

//             const userId = req.body?.userId || req.user?._id || user?._id
//             const { month, year, week } = req.query

//             let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
//             if(!jobDetail){
//                 return res.send({ status: 404, message: 'JobTitle not found' })
//             }

//             let query = {}

//             if(jobDetail?.isWorkFromOffice){
//                 const location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
//                 if(!location){
//                     return res.send({ status: 404, message: 'Location not found' })
//                 }
//                 query.locationId = jobDetail?.location
//             } else {
//                 if(!clientId || ['undefined', 'null', ''].includes(clientId)){
//                     return res.send({ status: 400, message: 'Client ID is required' })
//                 }

//                 const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
//                 if(!client){
//                     return res.send({ status: 404, message: 'Client not found' })
//                 }
//                 query.clientId = clientId
//             }

//             const joiningDate = jobDetail?.joiningDate ? moment(jobDetail?.joiningDate).startOf('day') : null

//             const { startDate, endDate } = getStartAndEndDate({ timesheetFrequency, weekDate, joiningDate, startDate: req.query.startDate, endDate: req.query.endDate })        

//             // 1. Fetch timesheet entries (Check-ins/outs)
//             // const timesheets = await Timesheet.find({ userId, jobId, createdAt: { $gte: moment(startDate).toDate(), $lte: moment(endDate).toDate() } })
//             const timesheets = await Timesheet.find({ userId, jobId, date: { $gte: startDate, $lte: endDate }, ...query }).lean()
//             // console.log('timesheet:', timesheets)

//             for(const timesheet of timesheets){
//                 timesheet.clockinTime = timesheet.clockinTime.map(entry => {
//                     const clockInStr = entry.clockIn ? convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss") : ""
//                     const clockOutStr = entry.clockOut ? convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""
    
//                     return {
//                         ...entry.toObject?.() ?? entry,
//                         clockIn: clockInStr,
//                         clockOut: clockOutStr,
//                     }
//                 })
//             }

//             // 2. Fetch leave requests
//             const leaves = await Leave.find({
//                 userId,
//                 jobId,
//                 $or: [
//                     { endDate: { $exists: true, $gte: startDate }, startDate: { $lte: endDate } },
//                     { endDate: { $exists: false }, startDate: { $gte: startDate, $lte: endDate } }
//                 ],
//                 status: "Approved",
//                 isDeleted: { $ne: true },
//                 ...query,
//             })
//             // console.log('leaves:', leaves)

//             // 3. Fetch holidays
//             const holidays = await Holiday.find({
//                 companyId: user.companyId,
//                 date: { $gte: startDate, $lte: endDate },
//                 isDeleted: { $ne: true }
//             })
//             // console.log('holidays:', holidays)

//             const dateList = [];
//             for (let d = moment(startDate); d.isSameOrBefore(endDate); d.add(1, 'days')) {
//                 dateList.push(d.clone().format('YYYY-MM-DD'))
//             }
//             // console.log('dateList:', dateList)

//             const timesheetMap = new Map()
//             timesheets.map(TS => {
//                 // const dateKey = TS.createdAt.toISOString().split("T")[0]
//                 const dateKey = TS.date
//                 timesheetMap.set(dateKey, TS)
//             })
//             // console.log('timesheets:', timesheets)

//             const leaveMap = new Map()
//             leaves.forEach(leave => {
//                 const leaveStart = moment(leave.startDate, 'YYYY-MM-DD')
//                 const leaveEnd = leave.endDate ? moment(leave.endDate, 'YYYY-MM-DD') : leaveStart.clone()
                
//                 let tempDate = leaveStart.clone()
            
//                 while (tempDate.isSameOrBefore(leaveEnd)) {
//                     leaveMap.set(tempDate.format('YYYY-MM-DD'), leave)
//                     tempDate.add(1, 'days')
//                 }
//             })
//             // console.log('leaves:', leaves)

//             const holidayMap = new Map();
//             holidays.map(HD => {
//                 holidayMap.set(HD.date, HD)
//             })
//             // console.log('holidays:', holidays)

//             const today = moment().format('YYYY-MM-DD')

//             const allReports = dateList.map(dateObj => {
//                 const isFuture = moment(dateObj, 'YYYY-MM-DD').isAfter(today, 'day')
//                 const dayOfWeek = moment(dateObj, 'YYYY-MM-DD').day()
//                 const isWeekend = dayOfWeek === 6 || dayOfWeek === 0

//                 if (isFuture) return null
//                 // if (isWeekend || isFuture) return null
            
//                 // const timesheetEntries = timesheets.filter(TS => TS.createdAt.toISOString().split("T")[0] === dateObj)
//                 const timesheetEntries = timesheets.filter(TS => TS.date === dateObj)
//                 const leaveEntries = leaves.filter(leave => {
//                     const leaveStart = moment(leave.startDate, 'YYYY-MM-DD')
//                     const leaveEnd = leave.endDate ? moment(leave.endDate, 'YYYY-MM-DD') : leaveStart.clone()
//                     return moment(dateObj).isBetween(leaveStart, leaveEnd, 'day', '[]')
//                 });
//                 const holidayEntries = holidays.filter(HD => HD.date === dateObj)
            
//                 const hasTimesheet = timesheetEntries.length > 0
//                 const hasLeave = leaveEntries.length > 0
//                 const hasHoliday = holidayEntries.length > 0
//                 const isAbsent = !hasTimesheet && !hasLeave && !hasHoliday && !isFuture

//                 let status = "Absent"
        
//                 if (hasLeave) {
//                     const isHalfLeave = leaveEntries.some(leave => leave.selectionDuration === "First-Half" || leave.selectionDuration === "Second-Half")
//                     status = isHalfLeave ? "HalfLeave" : "Leave"
//                 } else if (hasTimesheet) {
//                     status = "Present"
//                 } else if (hasHoliday) {
//                     status = "Holiday"
//                 }
            
//                 let data = {}
            
//                 if (hasTimesheet && !hasLeave && !hasHoliday) {
//                     data.timesheetData = {
//                         date: timesheetEntries[0]?.date,
//                         clockinTime: timesheetEntries[0]?.clockinTime,
//                         totalHours: timesheetEntries[0]?.totalHours,
//                         overTime: timesheetEntries[0]?.overTime
//                     }
//                 } else if (!hasTimesheet && hasLeave && !hasHoliday) {
//                     data.leaveData = {
//                         leaveType: leaveEntries[0]?.leaveType,
//                         selectionDuration: leaveEntries[0]?.selectionDuration,
//                         startDate: leaveEntries[0]?.startDate,
//                         endDate: leaveEntries[0]?.endDate,
//                         leaveDays: leaveEntries[0]?.leaveDays,
//                         leaves: leaveEntries[0]?.leaveType,
//                         reasonOfLeave: leaveEntries[0]?.reasonOfLeave,
//                         status: leaveEntries[0]?.status,
//                     }
//                 } else if (!hasTimesheet && !hasLeave && hasHoliday) {
//                     data.holidayData = {
//                         date: holidayEntries[0]?.date,
//                         occasion: holidayEntries[0]?.occasion
//                     }
//                 } else if (hasTimesheet || hasLeave || hasHoliday) {
//                     data = {
//                         timesheetData: hasTimesheet ? {
//                             date: timesheetEntries[0]?.date,
//                             clockinTime: timesheetEntries[0]?.clockinTime,
//                             totalHours: timesheetEntries[0]?.totalHours,
//                             overTime: timesheetEntries[0]?.overTime
//                         } : undefined,
//                         leaveData: hasLeave ? {
//                             leaveType: leaveEntries[0]?.leaveType,
//                             selectionDuration: leaveEntries[0]?.selectionDuration,
//                             startDate: leaveEntries[0]?.startDate,
//                             endDate: leaveEntries[0]?.endDate,
//                             leaveDays: leaveEntries[0]?.leaveDays,
//                             leaves: leaveEntries[0]?.leaveType,
//                             reasonOfLeave: leaveEntries[0]?.reasonOfLeave,
//                             status: leaveEntries[0]?.status,
//                         } : undefined,
//                         holidayData: hasHoliday ? {
//                             date: holidayEntries[0]?.date,
//                             occasion: holidayEntries[0]?.occasion
//                         } : undefined
//                     }
//                 }
            
//                 return {
//                     date: dateObj,
//                     status,
//                     timesheet: hasTimesheet,
//                     leave: hasLeave,
//                     holiday: hasHoliday,
//                     absent: isAbsent,
//                     data
//                 }
//             }).filter(report => report !== null)

//             const report = allReports.slice(skip, skip + limit)
//             const totalReports = allReports ? allReports.length : 0

//             return res.send({
//                 status: 200,
//                 reportStatus: employeeReportStatus,
//                 message: 'Timesheet report fetched successfully',
//                 report: report ? report : [],
//                 totalReports,
//                 totalPages: Math.ceil(totalReports / limit) || 1,
//                 currentPage: page || 1
//             })


//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while fetching timesheet report:', error)
//         return res.send({ status: 500, message: 'Error occurred while fetching timesheet report!' })
//     }
// }

async function getOptimizedAbsenceReport(users, clientIds, locationIds, fromDate, toDate, timesheetFrequency, skip, limit, isWorkFromOffice){
    try {
        const finalResponse = []

        const userFilter = Array.isArray(users) && users.length > 0 ? users.map(id => new mongoose.Types.ObjectId(id)) : null
        const clientFilter = Array.isArray(clientIds) && clientIds.length > 0 ? clientIds.map(id => id.toString()) : null
        const locationFilter = Array.isArray(locationIds) && locationIds.length > 0 ? locationIds.map(id => id.toString()) : null

        const clientDocs = await Client.find(clientFilter ? { _id: { $in: clientFilter } } : {}).lean()
        const locationDocs = await Location.find(locationFilter ? { _id: { $in: locationFilter } } : {}).lean()

        const clientMap = new Map(clientDocs.map(c => [c._id.toString(), c]))
        const locationMap = new Map(locationDocs.map(l => [l._id.toString(), l]))

        const usersData = await User.find({
            _id: { $in: userFilter },
            isDeleted: { $ne: true }
        }).lean()

        const allDates = []
        let current = moment(fromDate)
        const end = moment(toDate)
        while (current <= end) {
            allDates.push(current.format("YYYY-MM-DD"))
            current = current.add(1, "day")
        }

        // Build a map for timesheet entries: `${userId}_${clientId/locationId}_${date}`
        const timesheetDocs = await Timesheet.find({
            userId: { $in: userFilter },
            isDeleted: { $ne: true },
            date: { $gte: fromDate, $lte: toDate }
        }, { userId: 1, date: 1, clientId: 1, locationId: 1 }).lean()

        const timesheetSet = new Set()
        timesheetDocs.forEach(doc => {
            const id = isWorkFromOffice === 'false' 
                ? `${doc.userId}_${doc.clientId}_${moment(doc.date).format("YYYY-MM-DD")}`
                : `${doc.userId}_${doc.locationId}_${moment(doc.date).format("YYYY-MM-DD")}`
            timesheetSet.add(id)
        })

        // Build a set for leave entries: `${userId}_${date}` — we'll still filter based on client/location assignment in logic
        const leaveDocs = await Leave.find({
            userId: { $in: userFilter },
            leaveDates: { $elemMatch: { $gte: fromDate, $lte: toDate } },
            status: "Approved"
        }).lean()

        const leaveMap = new Map()
        leaveDocs.forEach(leave => {
            leave.leaveDates.forEach(date => {
                const formattedDate = moment(date).format("YYYY-MM-DD")
                const key = `${leave.userId}_${formattedDate}`
                leaveMap.set(key, true)
            })
        })

        const holidayDocs = await Holiday.find({
            date: { $gte: fromDate, $lte: toDate }
        }).lean()
        const holidaySet = new Set(holidayDocs.map(h => moment(h.date).format("YYYY-MM-DD")))

        for (const user of usersData) {
            const jobList = user?.jobDetails || []
            for (const job of jobList) {
                const userName = `${user.personalDetails?.firstName} ${user.personalDetails?.lastName || ""}`

                if (isWorkFromOffice === "false" && job?.isWorkFromOffice === false) {
                    const assignedClientIds = (job.assignClient || []).map(id => id.toString())

                    const targetClientIds = clientFilter || assignedClientIds

                    for (const clientId of targetClientIds) {
                        if (!assignedClientIds.includes(clientId)) continue
                        const client = clientMap.get(clientId)
                        if (!client) continue

                        for (const date of allDates) {
                            const key = `${user._id}_${clientId}_${date}`
                            if (timesheetSet.has(key)) continue
                            if (holidaySet.has(date)) continue
                            if (leaveMap.has(`${user._id}_${date}`)) continue

                            finalResponse.push({
                                userId: user._id,
                                userName,
                                jobRole: job?.jobTitle,
                                date,
                                status: "Absent",
                                clientName: client?.clientName
                            })
                        }
                    }
                }

                if (isWorkFromOffice === "true" && job?.isWorkFromOffice === true) {
                    const assignedLocationIds = (job.location || []).map(id => id.toString())
                    const targetLocationIds = locationFilter || assignedLocationIds

                    for (const locationId of targetLocationIds) {
                        if (!assignedLocationIds.includes(locationId)) continue
                        const location = locationMap.get(locationId)
                        if (!location) continue

                        for (const date of allDates) {
                            const key = `${user._id}_${locationId}_${date}`
                            if (timesheetSet.has(key)) continue
                            if (holidaySet.has(date)) continue
                            if (leaveMap.has(`${user._id}_${date}`)) continue

                            finalResponse.push({
                                userId: user._id,
                                userName,
                                jobRole: job?.jobTitle,
                                date,
                                status: "Absent",
                                locationName: location?.locationName
                            })
                        }
                    }
                }
            }
        }

        finalResponse.sort((a, b) => new Date(b.date) - new Date(a.date))

        const totalAbsenceReport = finalResponse
        // const totalAbsenceReport = finalResponse.slice(skip, skip + limit)
        return { finalResponse: totalAbsenceReport, count: finalResponse.length }
    } catch (error) {
        console.log('Error occured while optimizing absence report:', error)
    }
    // try {
    //     const finalResponse = []

    //     const userFilter = Array.isArray(users) && users.length > 0 ? users.map(id => new mongoose.Types.ObjectId(id)) : null
    //     const clientFilter = Array.isArray(clientIds) && clientIds.length > 0 ? clientIds : null
    //     const locationFilter = Array.isArray(locationIds) && locationIds.length > 0 ? locationIds : null

    //     const clientQuery = clientFilter ? { _id: { $in: clientFilter } } : {}
    //     const locationQuery = locationFilter ? { _id: { $in: locationFilter } } : {}

    //     const clientDocs = await Client.find(clientQuery).lean()
    //     const locationDocs = await Location.find(locationQuery).lean()
    //     const clientMap = new Map(clientDocs.map(client => [client?._id?.toString(), client]))
    //     const locationMap = new Map(locationDocs.map(location => [location?._id?.toString(), location]))

    //     // Fetch all relevant users
    //     const usersData = await User.find({
    //         _id: { $in: userFilter },
    //         isDeleted: { $ne: true }
    //     }).lean()

    //     // Prepare date range
    //     const allDates = []
    //     let current = moment(fromDate)
    //     const end = moment(toDate)
    //     while (current <= end) {
    //         allDates.push(current.format("YYYY-MM-DD"))
    //         current = current.add(1, "day")
    //     }

    //     // Fetch timesheets
    //     const timesheetDocs = await Timesheet.find({
    //         userId: { $in: userFilter },
    //         isDeleted: { $ne: true },
    //         date: { $gte: fromDate, $lte: toDate }
    //     }, { userId: 1, date: 1 }).lean()

    //     const timesheetSet = new Set(timesheetDocs.map(t => `${t.userId}_${moment(t.date).format("YYYY-MM-DD")}`))

    //     // Fetch approved leaves
    //     const leaveDocs = await Leave.find({
    //         userId: { $in: userFilter },
    //         leaveDates: { $elemMatch: { $gte: fromDate, $lte: toDate } },
    //         status: "Approved"
    //     }).lean()

    //     const leaveSet = new Set()
    //     leaveDocs.forEach(leave => {
    //         leave.leaveDates.forEach(date => {
    //             leaveSet.add(`${leave.userId}_${moment(date).format("YYYY-MM-DD")}`)
    //         })
    //     })

    //     // Fetch holidays
    //     const holidayDocs = await Holiday.find({
    //         date: { $gte: fromDate, $lte: toDate }
    //     }).lean()
    //     const holidaySet = new Set(holidayDocs.map(h => moment(h.date).format("YYYY-MM-DD")))

    //     // Now loop through each user and each date
    //     for (const user of usersData) {
    //         const jobList = user?.jobDetails || []

    //         for (const job of jobList) {
    //             // Filter on isWorkFromOffice
    //             if (isWorkFromOffice === "false" && job?.isWorkFromOffice !== false) continue
    //             if (isWorkFromOffice === "true" && job?.isWorkFromOffice !== true) continue

    //             const assignedClientIds = (job?.assignClient || []).map(id => id.toString())
    //             const assignedLocationIds = (job?.location || []).map(id => id.toString())

    //             for (const date of allDates) {
    //                 const key = `${user._id}_${date}`

    //                 // Skip if present
    //                 if (timesheetSet.has(key)) continue
    //                 // Skip if on leave
    //                 if (leaveSet.has(key)) continue
    //                 // Skip if holiday
    //                 if (holidaySet.has(date)) continue

    //                 // Now check if this user is eligible for this client/location
    //                 if (isWorkFromOffice === "false") {
    //                     console.log('assignedClientIds:', assignedClientIds)
    //                     console.log('clientFilter:', clientFilter)
    //                     if (!clientFilter.some(cid => assignedClientIds.includes(cid.toString()))) continue
    //                     const client = clientMap.get(clientFilter[0].toString())
    //                     // console.log('client:', client._id)
    //                     finalResponse.push({
    //                         userId: user._id,
    //                         userName: `${user.personalDetails?.firstName} ${user.personalDetails?.lastName || ""}`,
    //                         jobRole: job?.jobTitle,
    //                         date,
    //                         status: "Absent",
    //                         clientName: client?.clientName
    //                     })
    //                 } else if (isWorkFromOffice === "true") {
    //                     if (!locationFilter.some(lid => assignedLocationIds.includes(lid.toString()))) continue
    //                     const location = locationMap.get(locationFilter[0].toString())
    //                     finalResponse.push({
    //                         userId: user._id,
    //                         userName: `${user.personalDetails?.firstName} ${user.personalDetails?.lastName || ""}`,
    //                         jobRole: job?.jobTitle,
    //                         date,
    //                         status: "Absent",
    //                         locationName: location?.locationName
    //                     })
    //                 }
    //             }
    //         }
    //     }
    //     finalResponse.sort((a, b) => new Date(b.date) - new Date(a.date))

    //     return { finalResponse, count: finalResponse.length }
    // } catch (error) {
    //     console.log('Error occured while optimizing absence report:', error)
    // }
}

exports.getAbsenceReport = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user?.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search?.trim()?.toLowerCase() || ""

            const skip = (page - 1) * limit

            const { userId, clientId, locationId } = req.body
            const { timesheetFrequency = 'Daily', weekDate, isWorkFromOffice, companyId } = req.query
            let { startDate, endDate } = req.query

            const user = await User.findOne({ _id: req.user._id.toString(), isDeleted: { $ne: true } }).lean()
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            if((!startDate || startDate == "")){
                startDate = moment('2025-01-01T00:00:01.000Z').format('YYYY-MM-DD')
            }

            const { startDate: fromDate, endDate: toDate } = getStartAndEndDate({ timesheetFrequency, weekDate, startDate, endDate })

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

            const finalResponse = await getOptimizedAbsenceReport(userIds, clientIds, locationIds, fromDate, toDate, timesheetFrequency, skip, limit, isWorkFromOffice)

            let filteredReports = finalResponse.finalResponse

            if (searchQuery) {
                filteredReports = filteredReports.filter(report => {
                    const userName = report.userName?.toLowerCase() || ""
                    const jobRole = report.jobRole?.toLowerCase() || ""
                    const clientOrLocation = isWorkFromOffice === "true"
                        ? report.locationName?.toLowerCase() || ""
                        : report.clientName?.toLowerCase() || ""

                    return (
                        userName.includes(searchQuery) ||
                        jobRole.includes(searchQuery) ||
                        clientOrLocation.includes(searchQuery)
                    )
                })
            }

            const paginatedReports = filteredReports.slice(skip, skip + limit)

            return res.send({
                status: 200,
                message: 'Absence report fetched successfully',
                reports: paginatedReports,
                totalReports: filteredReports.length || 0,
                totalPages: Math.ceil(filteredReports.length / limit) || 1,
                currentPage: page || 1
            })

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching timesheet report:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching timesheet report!' })
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
    //     if(req.user?.role == 'Superadmin' && req.body.userId == ""){
    //         return res.send({
    //             status: 200,
    //             message: 'Timesheet report fetched successfully',
    //             report: [],
    //             totalReports: 0,
    //             totalPages: 1,
    //             currentPage: 1
    //         })
    //     }
    //     if(allowedRoles.includes(req.user?.role)){
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50

    //         const skip = (page - 1) * limit

    //         const { jobId, clientId } = req.body

    //         const user = await User.findOne({ "jobDetails._id": jobId, isDeleted: { $ne: true } })
    //         if(!user){
    //             return res.send({ status: 404, message: 'User not found' })
    //         }

    //         const userId = req.body?.userId || req.user?._id || user?._id
    //         const { month, year, week } = req.query

    //         let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
    //         if(!jobDetail){
    //             return res.send({ status: 404, message: 'JobTitle not found' })
    //         }

    //         let query = {}

    //         if(jobDetail?.isWorkFromOffice){
    //             const location = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })
    //             if(!location){
    //                 return res.send({ status: 404, message: 'Location not found' })
    //             }
    //             query.locationId = jobDetail?.location
    //         } else {
    //             if(!clientId || ['undefined', 'null', ''].includes(clientId)){
    //                 return res.send({ status: 400, message: 'Client ID is required' })
    //             }

    //             const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
    //             if(!client){
    //                 return res.send({ status: 404, message: 'Client not found' })
    //             }
    //             query.clientId = clientId
    //         }

    //         const joiningDate = jobDetail?.joiningDate ? moment(jobDetail?.joiningDate).startOf('day') : null

    //         const { startDate, endDate } = getStartAndEndDate({ year, month, week, joiningDate, startDate: req.body.startDate, endDate: req.body.endDate })
        

    //         // 1. Fetch timesheet entries (Check-ins/outs)
    //         const timesheets = await Timesheet.find({ userId, jobId, isDeleted: { $ne: true }, date: { $gte: startDate, $lte: endDate }, ...query })
    //         // console.log('timesheet:', timesheets)

    //         // 2. Fetch leave requests
    //         const leaves = await Leave.find({
    //             userId,
    //             jobId,
    //             $or: [
    //                 { endDate: { $exists: true, $gte: startDate }, startDate: { $lte: endDate } },
    //                 { endDate: { $exists: false }, startDate: { $gte: startDate, $lte: endDate } }
    //             ],
    //             status: "Approved",
    //             isDeleted: { $ne: true },
    //             ...query,
    //         })
    //         // console.log('leaves:', leaves)

    //         // 3. Fetch holidays
    //         const holidays = await Holiday.find({
    //             companyId: user.companyId,
    //             date: { $gte: startDate, $lte: endDate },
    //             isDeleted: { $ne: true }
    //         })
    //         // console.log('holidays:', holidays)

    //         const dateList = [];
    //         for (let d = moment(startDate); d.isSameOrBefore(endDate); d.add(1, 'days')) {
    //             dateList.push(d.clone().format('YYYY-MM-DD'))
    //         }
    //         // console.log('dateList:', dateList)

    //         const timesheetMap = new Map()
    //         timesheets.map(TS => {
    //             // const dateKey = TS.createdAt.toISOString().split("T")[0]
    //             const dateKey = TS.date
    //             timesheetMap.set(dateKey, TS)
    //         })
    //         // console.log('timesheets:', timesheets)

    //         const leaveMap = new Map()
    //         leaves.forEach(leave => {
    //             const leaveStart = moment(leave.startDate, 'YYYY-MM-DD')
    //             const leaveEnd = leave.endDate ? moment(leave.endDate, 'YYYY-MM-DD') : leaveStart.clone()
                
    //             let tempDate = leaveStart.clone()
            
    //             while (tempDate.isSameOrBefore(leaveEnd)) {
    //                 leaveMap.set(tempDate.format('YYYY-MM-DD'), leave)
    //                 tempDate.add(1, 'days')
    //             }
    //         })
    //         // console.log('leaves:', leaves)

    //         const holidayMap = new Map();
    //         holidays.map(HD => {
    //             holidayMap.set(HD.date, HD)
    //         })
    //         // console.log('holidays:', holidays)

    //         const today = moment().format('YYYY-MM-DD')

    //         const allReports = dateList.map(dateObj => {
    //             const isFuture = moment(dateObj, 'YYYY-MM-DD').isAfter(today, 'day')
    //             const dayOfWeek = moment(dateObj, 'YYYY-MM-DD').day()
    //             const isWeekend = dayOfWeek === 6 || dayOfWeek === 0

    //             if (isFuture) return null
    //             // if (isWeekend || isFuture) return null
            
    //             // const timesheetEntries = timesheets.filter(TS => TS.createdAt.toISOString().split("T")[0] === dateObj)
    //             const timesheetEntries = timesheets.filter(TS => TS.date === dateObj)
    //             const leaveEntries = leaves.filter(leave => {
    //                 const leaveStart = moment(leave.startDate, 'YYYY-MM-DD')
    //                 const leaveEnd = leave.endDate ? moment(leave.endDate, 'YYYY-MM-DD') : leaveStart.clone()
    //                 return moment(dateObj).isBetween(leaveStart, leaveEnd, 'day', '[]')
    //             });
    //             const holidayEntries = holidays.filter(HD => HD.date === dateObj)
            
    //             const hasTimesheet = timesheetEntries.length > 0
    //             const hasLeave = leaveEntries.length > 0
    //             const hasHoliday = holidayEntries.length > 0
    //             const isAbsent = !hasTimesheet && !hasLeave && !hasHoliday && !isFuture

    //             let status = "Absent"
        
    //             if (hasLeave) {
    //                 const isHalfLeave = leaveEntries.some(leave => leave.selectionDuration === "First-Half" || leave.selectionDuration === "Second-Half")
    //                 status = isHalfLeave ? "HalfLeave" : "Leave"
    //             } else if (hasTimesheet) {
    //                 status = "Present"
    //             } else if (hasHoliday) {
    //                 status = "Holiday"
    //             }
            
    //             let data = {}
            
    //             if (hasTimesheet && !hasLeave && !hasHoliday) {
    //                 data.timesheetData = {
    //                     date: timesheetEntries[0]?.date,
    //                     clockinTime: timesheetEntries[0]?.clockinTime,
    //                     totalHours: timesheetEntries[0]?.totalHours,
    //                     overTime: timesheetEntries[0]?.overTime
    //                 }
    //             } else if (!hasTimesheet && hasLeave && !hasHoliday) {
    //                 data.leaveData = {
    //                     leaveType: leaveEntries[0]?.leaveType,
    //                     selectionDuration: leaveEntries[0]?.selectionDuration,
    //                     startDate: leaveEntries[0]?.startDate,
    //                     endDate: leaveEntries[0]?.endDate,
    //                     leaveDays: leaveEntries[0]?.leaveDays,
    //                     leaves: leaveEntries[0]?.leaveType,
    //                     reasonOfLeave: leaveEntries[0]?.reasonOfLeave,
    //                     status: leaveEntries[0]?.status,
    //                 }
    //             } else if (!hasTimesheet && !hasLeave && hasHoliday) {
    //                 data.holidayData = {
    //                     date: holidayEntries[0]?.date,
    //                     occasion: holidayEntries[0]?.occasion
    //                 }
    //             } else if (hasTimesheet || hasLeave || hasHoliday) {
    //                 data = {
    //                     timesheetData: hasTimesheet ? {
    //                         date: timesheetEntries[0]?.date,
    //                         clockinTime: timesheetEntries[0]?.clockinTime,
    //                         totalHours: timesheetEntries[0]?.totalHours,
    //                         overTime: timesheetEntries[0]?.overTime
    //                     } : undefined,
    //                     leaveData: hasLeave ? {
    //                         leaveType: leaveEntries[0]?.leaveType,
    //                         selectionDuration: leaveEntries[0]?.selectionDuration,
    //                         startDate: leaveEntries[0]?.startDate,
    //                         endDate: leaveEntries[0]?.endDate,
    //                         leaveDays: leaveEntries[0]?.leaveDays,
    //                         leaves: leaveEntries[0]?.leaveType,
    //                         reasonOfLeave: leaveEntries[0]?.reasonOfLeave,
    //                         status: leaveEntries[0]?.status,
    //                     } : undefined,
    //                     holidayData: hasHoliday ? {
    //                         date: holidayEntries[0]?.date,
    //                         occasion: holidayEntries[0]?.occasion
    //                     } : undefined
    //                 }
    //             }
            
    //             return {
    //                 date: dateObj,
    //                 status,
    //                 leave: hasLeave,
    //                 holiday: hasHoliday,
    //                 absent: isAbsent === 'Absent',
    //                 data
    //             }
    //         }).filter(report => report !== null)

    //         const absentReports = allReports.filter(r => r.status === 'Absent')
    //         const report = absentReports.slice(skip, skip + limit)
    //         const totalReports = absentReports.length

    //         return res.send({
    //             status: 200,
    //             message: 'Absence report fetched successfully',
    //             report: report ? report : [],
    //             totalReports,
    //             totalPages: Math.ceil(totalReports / limit) || 1,
    //             currentPage: page || 1
    //         })


    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while fetching timesheet report:', error)
    //     return res.send({ status: 500, message: 'Error occurred while fetching timesheet report!' })
    // }
}

// old method
// exports.downloadTimesheetReport = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user.role)){
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 50

//             const skip = (page - 1) * limit

//             const userId = req.body.userId || req.user._id
//             const { jobId, startDate, endDate } = req.body

//             const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
//             if(!user){
//                 return res.send({ status: 404, message: 'User not found' })
//             }

//             let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
//             if(!jobDetail){
//                 return res.send({ status: 404, message: 'JobTitle not found' })
//             }

//             // 1. Fetch timesheet entries (Check-ins/outs)
//             const timesheets = await Timesheet.find({ userId, jobId, createdAt: { $gte: moment(startDate).toDate(), $lte: moment(endDate).toDate() } })
//             // console.log('timesheet:', timesheets)

//             // 2. Fetch leave requests
//             const leaves = await Leave.find({
//                 userId,
//                 jobId,
//                 $or: [
//                     { endDate: { $exists: true, $gte: startDate }, startDate: { $lte: endDate } },
//                     { endDate: { $exists: false }, startDate: { $gte: startDate, $lte: endDate } }
//                 ],
//                 status: "Approved",
//                 isDeleted: { $ne: true }
//             })
//             // console.log('leaves:', leaves)

//             // 3. Fetch holidays
//             const holidays = await Holiday.find({
//                 companyId: user.companyId,
//                 locationId: { $in: user.locationId },
//                 date: { $gte: startDate, $lte: endDate },
//                 isDeleted: { $ne: true }
//             })
//             // console.log('holidays:', holidays)

//             const dateList = [];
//             for (let d = moment(startDate); d.isSameOrBefore(endDate); d.add(1, 'days')) {
//                 dateList.push(d.clone().format('YYYY-MM-DD'))
//             }
//             // console.log('dateList:', dateList)

//             const timesheetMap = new Map()
//             timesheets.map(TS => {
//                 const dateKey = TS.createdAt.toISOString().split("T")[0]
//                 timesheetMap.set(dateKey, TS)
//             })
//             // console.log('timesheets:', timesheets)

//             const leaveMap = new Map()
//             leaves.forEach(leave => {
//                 const leaveStart = moment(leave.startDate, 'YYYY-MM-DD')
//                 const leaveEnd = leave.endDate ? moment(leave.endDate, 'YYYY-MM-DD') : leaveStart.clone()
                
//                 let tempDate = leaveStart.clone()
            
//                 while (tempDate.isSameOrBefore(leaveEnd)) {
//                     leaveMap.set(tempDate.format('YYYY-MM-DD'), leave)
//                     tempDate.add(1, 'days')
//                 }
//             })
//             // console.log('leaves:', leaves)

//             const holidayMap = new Map();
//             holidays.map(HD => {
//                 holidayMap.set(HD.date, HD)
//             })
//             // console.log('holidays:', holidays)

//             const today = moment().format('YYYY-MM-DD')

//             const allReports = dateList.map(dateObj => {
//                 const isFuture = moment(dateObj, 'YYYY-MM-DD').isAfter(today, 'day')
//                 const dayOfWeek = moment(dateObj, 'YYYY-MM-DD').day()
//                 const isWeekend = dayOfWeek === 6 || dayOfWeek === 0

//                 if (isWeekend || isFuture) return null
            
//                 const timesheetEntries = timesheets.filter(TS => TS.createdAt.toISOString().split("T")[0] === dateObj)
//                 const leaveEntries = leaves.filter(leave => {
//                     const leaveStart = moment(leave.startDate, 'YYYY-MM-DD')
//                     const leaveEnd = leave.endDate ? moment(leave.endDate, 'YYYY-MM-DD') : leaveStart.clone()
//                     return moment(dateObj).isBetween(leaveStart, leaveEnd, 'day', '[]')
//                 });
//                 const holidayEntries = holidays.filter(HD => HD.date === dateObj)
            
//                 const hasTimesheet = timesheetEntries.length > 0
//                 const hasLeave = leaveEntries.length > 0
//                 const hasHoliday = holidayEntries.length > 0
//                 const isAbsent = !hasTimesheet && !hasLeave && !hasHoliday && !isFuture

//                 let status = "Absent"
        
//                 if (hasLeave) {
//                     const isHalfLeave = leaveEntries.some(leave => leave.selectionDuration === "First-Half" || leave.selectionDuration === "Second-Half")
//                     status = isHalfLeave ? "HalfLeave" : "Leave"
//                 } else if (hasTimesheet) {
//                     status = "Present"
//                 } else if (hasHoliday) {
//                     status = "Holiday"
//                 }
            
//                 let data = {}
            
//                 if (hasTimesheet && !hasLeave && !hasHoliday) {
//                     data.timesheetData = {
//                         date: timesheetEntries[0]?.date,
//                         clockinTime: timesheetEntries[0]?.clockinTime,
//                         totalHours: timesheetEntries[0]?.totalHours,
//                         overTime: timesheetEntries[0]?.overTime
//                     }
//                 } else if (!hasTimesheet && hasLeave && !hasHoliday) {
//                     data.leaveData = {
//                         leaveType: leaveEntries[0]?.leaveType,
//                         selectionDuration: leaveEntries[0]?.selectionDuration,
//                         startDate: leaveEntries[0]?.startDate,
//                         endDate: leaveEntries[0]?.endDate,
//                         leaveDays: leaveEntries[0]?.leaveDays,
//                         leaves: leaveEntries[0]?.leaveType,
//                         reasonOfLeave: leaveEntries[0]?.reasonOfLeave,
//                         status: leaveEntries[0]?.status,
//                     }
//                 } else if (!hasTimesheet && !hasLeave && hasHoliday) {
//                     data.holidayData = {
//                         date: holidayEntries[0]?.date,
//                         occasion: holidayEntries[0]?.occasion
//                     }
//                 } else if (hasTimesheet || hasLeave || hasHoliday) {
//                     data = {
//                         timesheetData: hasTimesheet ? {
//                             date: timesheetEntries[0]?.date,
//                             clockinTime: timesheetEntries[0]?.clockinTime,
//                             totalHours: timesheetEntries[0]?.totalHours,
//                             overTime: timesheetEntries[0]?.overTime
//                         } : undefined,
//                         leaveData: hasLeave ? {
//                             leaveType: leaveEntries[0]?.leaveType,
//                             selectionDuration: leaveEntries[0]?.selectionDuration,
//                             startDate: leaveEntries[0]?.startDate,
//                             endDate: leaveEntries[0]?.endDate,
//                             leaveDays: leaveEntries[0]?.leaveDays,
//                             leaves: leaveEntries[0]?.leaveType,
//                             reasonOfLeave: leaveEntries[0]?.reasonOfLeave,
//                             status: leaveEntries[0]?.status,
//                         } : undefined,
//                         holidayData: hasHoliday ? {
//                             date: holidayEntries[0]?.date,
//                             occasion: holidayEntries[0]?.occasion
//                         } : undefined
//                     }
//                 }
            
//                 return {
//                     date: dateObj,
//                     status,
//                     timesheet: hasTimesheet,
//                     leave: hasLeave,
//                     holiday: hasHoliday,
//                     absent: isAbsent,
//                     data
//                 }
//             }).filter(report => report !== null)

//             const report = allReports.slice(skip, skip + limit)
//             const totalReports = allReports ? allReports.length : 0

//             return res.send({
//                 status: 200,
//                 message: 'Timesheet report downloaded successfully',
//                 report: report ? report : [],
//                 totalReports,
//                 totalPages: Math.ceil(totalReports / limit) || 1,
//                 currentPage: page || 1
//             })

//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while downloading timesheet report:', error)
//         return res.send({ status: 500, message: 'Error occurred while downloading timesheet report!' })
//     }
// }

const convertToSeconds = (timeStr) => {
    if (!timeStr) return 0;

    let totalSeconds = 0;
    const match = timeStr.match(/(\d+)h|(\d+)m|(\d+)s/g);
    
    if (match) {
        match.forEach(unit => {
            if (unit.includes("h")) totalSeconds += parseInt(unit) * 3600;
            if (unit.includes("m")) totalSeconds += parseInt(unit) * 60;
            if (unit.includes("s")) totalSeconds += parseInt(unit);
        });
    }

    return totalSeconds;
}

const formatTimeFromSeconds = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

exports.downloadTimesheetReport = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user?.role) || req.token?.role === "Client"){
            const { jobId, startDate, endDate, format } = req.body
            
            const user = await User.findOne({ "jobDetails._id": jobId, isDeleted: { $ne: true } })
            // const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }
            const userId = req.body?.userId || req.user?._id || user?._id

            let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }
            
            const joiningDate = moment(jobDetail?.joiningDate, "YYYY-MM-DD")
            let startMoment = moment(startDate, "YYYY-MM-DD")
            let endMoment = moment(endDate, "YYYY-MM-DD")

            // passed startMoment as joining date
            if (joiningDate.isBetween(startMoment, endMoment, undefined, '[]')) {
                startMoment = joiningDate
            }

            // Generate all dates within the range
            const allDates = []
            for(let d = startMoment.clone(); d.isSameOrBefore(endMoment, "day"); d.add(1, "day")){
                allDates.push(d.format("YYYY-MM-DD"))
            }

            // Fetch timesheet, leave, and holiday data
            // const timesheets = await Timesheet.find({ userId, jobId, createdAt: { $gte: startMoment.toDate(), $lte: endMoment.toDate() } })
            const timesheets = await Timesheet.find({ userId, jobId, date: { $gte: startDate, $lte: endDate }, isDeleted: { $ne: true } }).lean()

            for(const timesheet of timesheets){
                timesheet.clockinTime = timesheet.clockinTime.map(entry => {
                    const clockInStr = entry.clockIn ? convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss") : ""
                    const clockOutStr = entry.clockOut ? convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss") : ""
    
                    return {
                        ...entry.toObject?.() ?? entry,
                        clockIn: clockInStr,
                        clockOut: clockOutStr,
                    }
                })
            }

            const leaves = await Leave.find({ 
                userId, jobId, 
                status: "Approved", 
                isDeleted: { $ne: true } 
            })

            // const holidays = await Holiday.find({ 
            //     companyId: user.companyId, 
            // })

            const timesheetMap = new Map()
            timesheets.forEach(ts => {
                // const dateKey = moment(ts.createdAt).format("YYYY-MM-DD")
                const dateKey = ts.date
                timesheetMap.set(dateKey, ts)
            })

            const leaveMap = new Map()
            leaves.forEach(leave => {
                const leaveStart = moment(leave.startDate, "YYYY-MM-DD")
                const leaveEnd = leave.endDate ? moment(leave.endDate, "YYYY-MM-DD") : leaveStart.clone()
                
                let tempDate = leaveStart.clone()
                while (tempDate.isSameOrBefore(leaveEnd, "day")) {
                    leaveMap.set(tempDate.format("YYYY-MM-DD"), leave)
                    tempDate.add(1, "day")
                }
            })

            // const holidayMap = new Map()
            // holidays.forEach(holiday => {
            //     holidayMap.set(moment(holiday.date).format("YYYY-MM-DD"), holiday)
            // })

            const weeklyData = new Map()

            // Generate the final report data
            const reportData = allDates.map(date => {
                const timesheetEntry = timesheetMap.get(date)
                const leaveEntry = leaveMap.get(date)
                // const holidayEntry = holidayMap.get(date)
            
                let status = ""
                let clockinTime = "-"
                let clockoutTime = "-"
                let totalHours = 0
                let overTime = 0
                let leaveType = "-"
                // let holidayOccasion = "-"
            
                if (timesheetEntry) {
                    status = "Present"
                    clockinTime = timesheetEntry.clockinTime.map(t => moment(t.clockIn, "HH:mm").format("h:mm A")).join(" || ")
                    clockoutTime = timesheetEntry.clockinTime.map(t => t.clockOut ? moment(t.clockOut, "HH:mm").format("h:mm A") : "-").join(" || ")
                    
                    // Convert total hours from "3h 45m 30s" to seconds
                    totalHours = convertToSeconds(timesheetEntry.totalHours)
                    
                    // Convert overtime from "1h 30m 0s" to seconds
                    overTime = convertToSeconds(timesheetEntry.overTime)
                } else if (leaveEntry) {
                    status = leaveEntry.selectionDuration === "First-Half" || leaveEntry.selectionDuration === "Second-Half" ? "Half Leave" : "Leave"
                    leaveType = leaveEntry.leaveType
                } 
                // else if (holidayEntry) {
                //     status = "Holiday"
                //     holidayOccasion = holidayEntry.occasion
                // }
            
                // Determine the week key
                if (moment(date).day() === 6 || moment(date).day() === 0) {
                    return null
                }
                const weekKey = moment(date).startOf("isoWeek").format("YYYY-MM-DD")
            
                // Accumulate weekly data
                if (!weeklyData.has(weekKey)) {
                    weeklyData.set(weekKey, { totalHours: 0, overTime: 0 })
                }
            
                const weekEntry = weeklyData.get(weekKey)
                weekEntry.totalHours += totalHours
                weekEntry.overTime += overTime
                weeklyData.set(weekKey, weekEntry)
            
                return {
                    date,
                    clockinTime,
                    clockoutTime,
                    totalHours: totalHours ? formatTimeFromSeconds(totalHours) : "-",
                    overTime: overTime ? formatTimeFromSeconds(overTime) : "-",
                    status,
                    leaveType,
                    // holidayOccasion,
                    weekKey
                }
            }).filter(Boolean).filter(entry => entry.status !== "")
            // console.log('reportData:', reportData)

            const weeklySummary = Array.from(weeklyData, ([weekKey, data]) => {
                let startDate = moment(weekKey)
                
                if (startDate.day() === 6 || startDate.day() === 0) {
                    return null
                }

                const endDate = startDate.clone().add(4, "days")
            
                return {
                    weekRange: `${startDate.format("DD-MM-YYYY")} to ${endDate.format("DD-MM-YYYY")}`,
                    totalHours: formatTimeFromSeconds(data.totalHours),
                    overTime: formatTimeFromSeconds(data.overTime)
                }
            }).filter(Boolean)
            // console.log('weeklySummary:', weeklySummary)

            const data = {
                startDate: moment(startDate).format("DD-MM-YYYY"),
                endDate: moment(endDate).format("DD-MM-YYYY"),
                userName: `${user?.personalDetails.firstName} ${user?.personalDetails.lastName}`,
                userEmail: user?.personalDetails?.email,
                userContactNumber: user?.personalDetails?.phone,
                userJobTitle: jobDetail?.jobTitle,
                userRole: jobDetail?.role
            }    
            
            const fileName = `${user?.personalDetails.firstName}${user?.personalDetails.lastName}_timesheet_${moment().format("YYYYMMDDHHmmssSSS") + Math.floor(Math.random() * 1000)}`
            
            if(format === 'pdf'){
                // Render the EJS template
                const templatePath = path.join(__dirname, "../views/timesheetReportFormat.ejs")
                const htmlContent = await ejs.renderFile(templatePath, { reportData, weeklySummary, data, moment })

                // Generate PDF using Puppeteer
                const browser = await puppeteer.launch()
                const page = await browser.newPage()
                await page.setContent(htmlContent, { waitUntil: "networkidle0" })
                await page.waitForSelector("table")
                await new Promise(resolve => setTimeout(resolve, 1000))
                let pdfBuffer = await page.pdf({
                    format: "A4",
                    printBackground: true,
                    margin: {
                        top: "15mm",
                        right: "10mm",
                        bottom: "15mm",
                        left: "10mm"
                    }
                })

                await browser.close()

                pdfBuffer = Buffer.from(pdfBuffer)
                const pdfBase64 = pdfBuffer.toString("base64");
                const mimeType = 'application/pdf'
                res.send({ status: 200, message: "Timesheet report generated successfully", pdfBase64, fileName, mimeType });
            } else if(format === 'excel'){
                // Generate Excel file
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet("Timesheet Report");

                //  1. Add Title
                const titleRow = worksheet.addRow(["Timesheet Report"]);
                titleRow.font = { bold: true, size: 20, color: { argb: 'FFFFFF' } };
                titleRow.alignment = { horizontal: "center" };
                worksheet.mergeCells(`A${titleRow.number}:F${titleRow.number}`);

                titleRow.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "343A40" }, 
                    };
                });

                worksheet.addRow([]); // Empty row for spacing

                // 2. Add User Details
                // function addMergedRow(worksheet, text) {
                //     const row = worksheet.addRow([text]); // Add row with text
                //     row.font = { bold: true };
                //     worksheet.mergeCells(`A${row.number}:B${row.number}`);
                // }
                
                // // Adding User Details with Merged Cells (First Two Columns)
                // addMergedRow(worksheet, `Name:   ${data.userName}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Email:   ${data.userEmail}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Contact Number:   ${data.userContactNumber}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Job Title:   ${data.userJobTitle}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Role:   ${data.userRole}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Time-Duration:   ${data.startDate} to ${data.endDate}`, worksheet.lastRow.number);

                function addMergedRow(worksheet, label1, value1, label2, value2) {
                    const row = worksheet.addRow([`${label1}: ${value1}`, "", `${label2}: ${value2}`, ""]);
                    
                    worksheet.mergeCells(`A${row.number}:B${row.number}`);
                
                    worksheet.mergeCells(`C${row.number}:D${row.number}`);
                
                    row.eachCell((cell) => {
                        cell.font = { bold: true, size: 12 };
                        cell.alignment = { horizontal: "left", vertical: "middle" };
                    });
                }
                
                addMergedRow(worksheet, "Name", data.userName, "Email", data.userEmail);
                addMergedRow(worksheet, "Contact Number", data.userContactNumber, "Job Title", data.userJobTitle);
                addMergedRow(worksheet, "Role", data.userRole, "Time-Duration", `${data.startDate} to ${data.endDate}`);

                worksheet.addRow([]); // Empty row for spacing

                // 3. Add Detailed weekly summary data
                const weeklySummaryTitleRow = worksheet.addRow(["Weekly Summary"]);
                weeklySummaryTitleRow.font = { bold: true, size: 14 };
                weeklySummaryTitleRow.alignment = { horizontal: "center" };
                worksheet.mergeCells(weeklySummaryTitleRow.number, 1, weeklySummaryTitleRow.number, 4);
                const summaryHeaders = worksheet.addRow(["Week", "Time Duration", "Total Hours", "Overtime"])
                summaryHeaders.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "343A40" },
                    };
                });
                summaryHeaders.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
                summaryHeaders.alignment = { horizontal: "center" };

                // Add weekly summary data
                weeklySummary.forEach((week, index) => {
                    const newRaw = worksheet.addRow([
                        index + 1, week.weekRange, week.totalHours, week.overTime
                    ]);
                    newRaw.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
                });

                worksheet.addRow([]); // Empty row for spacing

                // 4. Add Detailed Timesheet Data
                const tableHeader = worksheet.addRow(["Date", "Clock Timing", "Total Hours", "Overtime", "Status", "Leave Type"]);
                tableHeader.font = { bold: true, size: 12, color: { argb: "FFFFFF" } }
                tableHeader.alignment = { horizontal: "center", vertical: "middle" }
                tableHeader.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "343A40" },
                    };
                });

                // Adding daily timesheet data
                reportData.forEach((row) => {
                    let clockTiming = '';
                    
                    const clockInArray = row.clockinTime.split('||').map(time => time.trim());
                    const clockOutArray = row.clockoutTime.split('||').map(time => time.trim());
                    
                    // if (clockInArray.length === clockOutArray.length) {
                    //     clockTiming = clockInArray.map((time, index) => {
                    //         let formattedTime
                    //         if(time !== '-'){
                    //             formattedTime = `${time} || ${clockOutArray[index]}`
                    //         } else {
                    //             formattedTime = '-'
                    //         }
                    //         return formattedTime;
                    //     }).join('\n');
                    // }
                
                    // const newRow = worksheet.addRow([
                    //     moment(row.date).format('DD-MM-YYYY'),
                    //     clockTiming,
                    //     row.totalHours,
                    //     row.overTime,
                    //     row.status,
                    //     row.leaveType
                    // ]);

                    // newRow.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };

                    const numRows = clockInArray.length; //
                    const startRowNumber = worksheet.lastRow ? worksheet.lastRow.number + 1 : 1
                    clockInArray.forEach((time, index) => {
                        worksheet.addRow([
                            moment(row.date).format('DD-MM-YYYY'),
                            time !== '-' ? `${time} || ${clockOutArray[index]}` : '-',
                            row.totalHours,
                            row.overTime,
                            row.status,
                            row.leaveType
                        ]).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
                    })
                   
                    if (numRows > 1) {
                        worksheet.mergeCells(`A${startRowNumber}:A${startRowNumber + numRows - 1}`)
                        worksheet.mergeCells(`C${startRowNumber}:C${startRowNumber + numRows - 1}`)
                        worksheet.mergeCells(`D${startRowNumber}:D${startRowNumber + numRows - 1}`)
                        worksheet.mergeCells(`E${startRowNumber}:E${startRowNumber + numRows - 1}`)
                        worksheet.mergeCells(`F${startRowNumber}:F${startRowNumber + numRows - 1}`)
                    }
                });

                worksheet.columns.forEach((column) => {
                    let maxLength = 0;
                    column.eachCell({ includeEmpty: true }, (cell) => {
                        const cellValue = cell.value ? cell.value.toString() : "";
                        maxLength = Math.max(maxLength, cellValue.length);
                    });
                    column.width = maxLength + 1; // Add some padding for better spacing
                });

                const buffer = await workbook.xlsx.writeBuffer();
                const excelbase64 = buffer.toString("base64");
                const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                return res.send({ status: 200, message: 'Timesheet report generated successfully', excelbase64, fileName, mimeType })
            } else {
                return res.send({ status: 400, message: "Invalid format. Please specify 'pdf' or 'excel'." })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while downloading timesheet report:', error)
        return res.send({ status: 500, message: 'Error occurred while downloading timesheet report!' })
    }
}

exports.getAllUsersAndClients = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.query.companyId

            let baseQuery = { isDeleted: { $ne: true } }

            if (companyId && companyId !== 'allCompany') {
                baseQuery.companyId = new mongoose.Types.ObjectId(String(companyId))
            } 
            // else if (req.user.role !== 'Superadmin') {
            //     baseQuery.companyId = req.user.companyId
            // }

            const clients = await Client.aggregate([
                { $match: baseQuery },
                {
                    $project: {
                        _id: 1,
                        clientName: 1,
                    }
                }
            ])

            let query = { isDeleted: { $ne: true } }

            if(companyId && companyId !== 'allCompany'){
                query.companyId = new mongoose.Types.ObjectId(String(companyId))
            } else if(req.user.role !== 'Superadmin'){
                query.locationId = { $in: req.user.locationId }
                query.companyId = new mongoose.Types.ObjectId(String(req.user.companyId))
            }
 
            if (req.user.role === 'Superadmin') {
                query.role = { $in: ["Administrator", "Manager", "Employee"] }
            } else if (req.user.role === 'Administrator') {
                query.role = { $in: ["Manager", "Employee"] }
            } else if(req.user.role === 'Manager') {
                query.jobDetails = { $elemMatch: { assignManager: req.user._id.toString() } }
                query.role = { $in: ["Employee"] }
            }

            const users = await User.aggregate([
                { $match: query },
                {
                    $project: {
                    _id: 1,
                    userName: {
                        $trim: {
                        input: {
                            $cond: {
                            if: { $gt: [{ $strLenCP: { $ifNull: ["$personalDetails.lastName", ""] } }, 0] },
                            then: {
                                $concat: [
                                { $ifNull: ["$personalDetails.firstName", ""] },
                                " ",
                                { $ifNull: ["$personalDetails.lastName", ""] }
                                ]
                            },
                            else: { $ifNull: ["$personalDetails.firstName", ""] }
                            }
                        }
                        }
                    }
                    }
                }
            ])

            return res.send({ status: 200, message: 'All users and clients fetched successfully', clients, users })
        } else return res.send({ status: 403, messgae: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching users and clients:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching users and clients' })
    }
}

exports.getAllClientsOfUser = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(!allowedRoles.includes(req.user.role)){
            return res.send({ status: 403, message: 'Access denied' })
        }

        const { companyId, userId } = req.query

        let matchConditions = [ { isDeleted: { $ne: true } } ]
        
        if (companyId && companyId !== 'allCompany' && mongoose.Types.ObjectId.isValid(companyId)) {
            matchConditions.push({
                companyId: new mongoose.Types.ObjectId(String(companyId))
            })
        }
        // else if (req.user.role !== 'Superadmin') {
        //     matchConditions.push({
        //         companyId: new mongoose.Types.ObjectId(String(req.user.companyId))
        //     })
        // }

        if (mongoose.Types.ObjectId.isValid(userId)) {
            matchConditions.push({ _id: new mongoose.Types.ObjectId(String(userId)) })
        }

        let pipeline = [
            { $match: { $and: matchConditions } },
            { $unwind: "$jobDetails" }
        ]

        // pipeline.push({ $match: { "jobDetails.isWorkFromOffice": false } })

        pipeline.push(
            { $match: { "jobDetails.isWorkFromOffice": false } },
            { $unwind: "$jobDetails.assignClient" },
            { $addFields: {
                    clientObjectId: {
                        $convert: {
                            input: "$jobDetails.assignClient",
                            to: "objectId",
                            onError: null,
                            onNull: null
                        }
                    }
            } },
            { $match: { clientObjectId: { $ne: null } } },
            { $group: { _id: "$clientObjectId" } },
            { $lookup: {
                    from: "clients",
                    localField: "_id",
                    foreignField: "_id",
                    as: "client"
            } },
            { $unwind: "$client" },
            { $match: { "client.isDeleted": { $ne: true } } },
            { $project: {
                    _id: 1,
                    clientName: "$client.clientName"
            } },
            { $sort: { clientName: 1 } }
        )

        const userClients = await User.aggregate(pipeline)

        return res.send({ status: 200, clients: userClients })
    } catch (error) {
        console.error("Error occurred while fetching user's all clients:", error)
        return res.send({ status: 500, message: "Error occurred while fetching users all clients!" })
    }
}

exports.getAllUsersOfClientOrLocation = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(!allowedRoles.includes(req.user.role)){
            return res.send({ status: 403, message: 'Access denied' })
        }

        const { companyId, clientId, locationId, isWorkFromOffice } = req.query

        let matchConditions = [ { isDeleted: { $ne: true } } ]

        if(req.user.role == 'Superadmin'){
            matchConditions.push({ role: { $in: ['Administrator', 'Manager', 'Employee'] } })
        } else if(req.user.role == 'Administrator'){
            matchConditions.push({ role: { $in: ['Manager', 'Employee'] } })
        } else if(req.user.role == 'Manager'){
            matchConditions.push({ role: { $in: ['Employee'] } })
        }
        
        if (companyId && companyId !== 'allCompany') {
            matchConditions.push({
                companyId: new mongoose.Types.ObjectId(String(companyId))
            })
        } 
        // else if (req.user.role !== 'Superadmin') {
        //     matchConditions.push({
        //         companyId: new mongoose.Types.ObjectId(String(req.user.companyId))
        //     })
        // }

        let pipeline = [
            { $match: { $and: matchConditions } },
            { $unwind: "$jobDetails" }
        ]

        const isWorkFromOfficeType = isWorkFromOffice === 'true' ? true : isWorkFromOffice === 'false' ? false : undefined;

        if (typeof isWorkFromOfficeType === 'boolean') {
            pipeline.push({
                $match: { "jobDetails.isWorkFromOffice": isWorkFromOfficeType }
            })
        }

        if(isWorkFromOffice == 'false'){
            pipeline.push({ $unwind: "$jobDetails.assignClient" })

            if (mongoose.Types.ObjectId.isValid(clientId)) {
                pipeline.push({
                    $addFields: {
                        clientObjectId: {
                            $convert: {
                                input: "$jobDetails.assignClient",
                                to: "objectId",
                                onError: null,
                                onNull: null
                            }
                        }
                    }
                })

                pipeline.push({
                    $match: { clientObjectId: new mongoose.Types.ObjectId(clientId) }
                })
            }
        } else if(isWorkFromOffice == 'true'){
            pipeline.push({ $unwind: "$jobDetails.location" })

            if (mongoose.Types.ObjectId.isValid(locationId)) {
                pipeline.push({
                    $addFields: {
                        locationObjectId: {
                            $convert: {
                                input: "$jobDetails.location",
                                to: "objectId",
                                onError: null,
                                onNull: null
                            }
                        }
                    }
                })

                pipeline.push({
                    $match: { locationObjectId: new mongoose.Types.ObjectId(locationId) }
                })
            }
        }

        pipeline.push(
            { $project: {
                    _id: 1,
                    userName: {
                        $cond: {
                            if: { $ifNull: ["$personalDetails.lastName", false] },
                            then: { $concat: ["$personalDetails.firstName", " ", "$personalDetails.lastName"] },
                            else: "$personalDetails.firstName"
                        }
                    }
            } },
            { $group: {
                    _id: "$_id",
                    userName: { $first: "$userName" }
            } },
            { $sort: { userName: 1 } }
        )

        const clientUsers = await User.aggregate(pipeline)

        return res.send({ status: 200, users: clientUsers })
    } catch (error) {
        console.error("Error occurred while fetching users by client:", error)
        return res.send({ status: 500, message: "Error occurred while fetching users by client!" })
    }
}

exports.regenerateReportLink = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const { reportId } = req.body

            const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } })
            if(!report){
                return res.send({ status: 404, message: 'Report not found' })
            }

            if(report?.status !== 'Pending'){
                return res.send({ status: 403, message: `Report is already action by ${report?.actionBy}` })
            }

            const companyId = report?.companyId.toString()
            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            const clientId = report?.clientId.toString()
            const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
            if(!client){
                return res.send({ status: 404, message: 'Client not foubnd' })
            }

            const { startDate, endDate, links } = report
            const { reportFrequency, email: clientEmails } = client

            const data = {
                clientId,
                companyId,
                startDate,
                endDate,
                reportFrequency,
                clientEmails,
                links
            }

            let overlapQuery = {}

            if(startDate && endDate && endDate !== ""){
                overlapQuery.startDate = { $lte: endDate },
                overlapQuery.endDate = { $gte: startDate }
            } else if(startDate){
                overlapQuery.startDate = startDate
            }

            let emailLinks = []

            for (const email of clientEmails) {
                const token = jwt.sign(
                    { clientId, companyId, startDate, endDate, reportId, email, role: "Client" },
                    process.env.JWT_SECRET
                )
    
                const link = `${process.env.FRONTEND_URL}/employeestimesheet?token=${token}`
    
                links.push({ email, link, token })
                emailLinks.push({ email, link, token })
            }

            await report.save()

            for (const { email, link } of emailLinks) {
                let mailOptions = {
                    from: process.env.NODEMAILER_EMAIL,
                    to: email,
                    subject: 'Employee Timesheet Report',
                    html:`
                        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                                <div style="background-color: #007bff; color: #ffffff; padding: 20px 30px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px;">Employee Timesheet Report</h1>
                                </div>
                                <div style="padding: 30px;">
                                    <p style="font-size: 16px; color: #333333;">
                                        Hello,
                                    </p>
                                    <p style="font-size: 16px; color: #333333;">
                                        Please click the link below to view the employee timesheet report for the period from 
                                        <strong>${moment(startDate).format('DD-MM-YYYY')}</strong> to 
                                        <strong>${moment(endDate).format('DD-MM-YYYY')}</strong>.
                                    </p>
                                    <p style="font-size: 16px; color: #333333;">
                                        Note: This is Re-generated report list.
                                    </p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${link}" style="display: inline-block; padding: 12px 25px; font-size: 16px; color: #ffffff; background-color: #28a745; text-decoration: none; border-radius: 5px;">
                                            View Report List
                                        </a>
                                    </div>
                                    <p style="font-size: 14px; color: #777777;">
                                        <strong>Note:</strong> Please ensure that you review and take the necessary action on report.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                }
                transporter.sendMail(mailOptions, (error, info) => {
                    if(error){
                        if(error.code == 'EENVELOPE'){
                            console.warn('Invalid email address, while re-generating report link:', email)
                        } else {
                            console.error('Error while sending re-generating report link:', error)
                        }
                    }
                    if(info){
                        console.log(`✅ Report link successfully sent to: ${email}`)
                    }
                })
            }

            return res.send({ status: 200, message: 'Client report re-generated successfully.', data })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while re-generate report link:', error)
        return res.send({ status: 500, message: 'Error occurred while re-generate report link!' })
    }
}
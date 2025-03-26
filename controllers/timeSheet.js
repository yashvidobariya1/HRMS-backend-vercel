const User = require("../models/user");
const geolib = require('geolib')
const Timesheet = require("../models/timeSheet");
const Notification = require("../models/notification");
const Company = require("../models/company");
const Location = require("../models/location");
const cloudinary = require("../utils/cloudinary");
const QR = require('../models/qrCode');
const Leave = require("../models/leaveRequest");
const moment = require('moment');
const Holiday = require("../models/holiday");
const ejs = require("ejs");
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs")
const path = require("path");
const EmployeeReport = require("../models/employeeReport");

exports.clockInFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const { userId, location, jobId, isMobile, qrValue } = req.body
            console.log('Location:', location)

            console.log("location",location);
            
            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            if(isMobile === true) {
                let companyId = existUser?.companyId.toString()
                // let locationId = existUser?.locationId.toString()

                const qrCode = await QR.findOne({
                    qrValue,
                    companyId,
                    isActive: { $ne: false },
                    locationId: { $in: existUser?.locationId },
                })
                
                if (!qrCode) {
                    return res.send({ status: 400, message: 'Invalid QR code' })
                }
            }

            let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const companyLocation = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 400, message: "Location coordinator data is not found!" })
            }

            await User.updateOne(
                { _id: existUser._id },
                { $set: { lastKnownLocation: location } }
            )            
            
            const GEOFENCE_CENTER = {
                latitude: companyLocation?.latitude,
                longitude: companyLocation?.longitude
            }
            const GEOFENCE_RADIUS = companyLocation?.radius // meters

            if (!geolib.isPointWithinRadius(
                { latitude: location.latitude, longitude: location.longitude },
                GEOFENCE_CENTER,
                GEOFENCE_RADIUS
            )) {
                return res.send({ status: 403, message: 'You are outside the geofence area.' })
            }

            const currentDate = moment().format('YYYY-MM-DD')
            let timesheet = await Timesheet.findOne({ userId, jobId, date: currentDate })

            if (!timesheet) {
                timesheet = new Timesheet({
                    userId,
                    jobId,
                    date: currentDate,
                    clockinTime: [],
                    totalHours: '0h 0m 0s'
                })
            }

            const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]

            if (lastClockin && !lastClockin.clockOut) {
                return res.send({ status: 400, message: "Please clock out before clockin again." })
            }

            timesheet.clockinTime.push({
                clockIn: moment().toDate(),
                clockOut: "",
                isClockin: true
            })
            
            timesheet.isTimerOn = true
            await timesheet.save()

            //------entry notification-----------
            let notifiedId = []
            let readBy = []
            if (existUser.role === 'Employee') {
                if (jobDetail && jobDetail.assignManager) {
                    const assignManager = await User.findOne({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
                    // console.log('assignManager', assignManager)
                    notifiedId.push(jobDetail.assignManager);
                    readBy.push({
                        userId: jobDetail.assignManager,
                        role: assignManager?.role
                    })
                    // console.log('readBy1/..', readBy)
                }

                // const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                // // console.log('administrator', administrator)
                // if (administrator.length > 0) {
                //     notifiedId.push(administrator[0]._id);
                //     readBy.push({
                //         userId: administrator[0]._id,
                //         role: administrator[0].role
                //     })
                // }
            } else if (existUser.role === 'Manager') {
                const administrator = await User.findOne({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                if (administrator) {
                    notifiedId.push(administrator?._id);
                    readBy.push({
                        userId: administrator?._id,
                        role: administrator?.role
                    })
                }
            } else if (existUser.role === 'Administrator') {
                notifiedId.push(existUser.creatorId)
                readBy.push({
                    userId: existUser?.creatorId,
                    role: existUser?.createdBy
                })
            }

            // const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            // superAdmin.map((sa) => {
            //     notifiedId.push(sa?._id)
            //     readBy.push({
            //         userId: sa?._id,
            //         role: sa?.role
            //     })
            // })

            const firstName = existUser.personalDetails?.firstName || ""
            const lastName = existUser.personalDetails?.lastName || ""
            const notification = new Notification({
                userId,
                // userName: `${firstName} ${lastName}`,
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
        res.send({ message: "Something went wrong while clock in!" })
    }
}

const formatDuration = (clockInTime, clockOutTime) => {
    let diffInSeconds = Math.floor((clockOutTime - clockInTime) / 1000)
    const hours = Math.floor(diffInSeconds / 3600)
    diffInSeconds %= 3600
    const minutes = Math.floor(diffInSeconds / 60)
    const seconds = diffInSeconds % 60

    return `${hours}h ${minutes}m ${seconds}s`
}

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

exports.clockOutFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const { userId, location, jobId, isMobile, qrValue } = req.body
            console.log('Location:', location)

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            if(isMobile === true) {
                let companyId = existUser?.companyId.toString()
                // let locationId = existUser?.locationId.toString()

                const qrCode = await QR.findOne({
                    qrValue,
                    companyId,
                    isActive: { $ne: false },
                    locationId: { $in: existUser?.locationId },
                })
                
                if (!qrCode) {
                    return res.send({ status: 400, message: 'Invalid QR code' })
                }
            }

            let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const companyLocation = await Location.findOne({ _id: jobDetail?.location, isDeleted: { $ne: true } })

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 400, message: "Location coordinator data is not found!" })
            }

            await User.updateOne(
                { _id: existUser._id },
                { $set: { lastKnownLocation: location } }
            )

            const GEOFENCE_CENTER = {
                latitude: companyLocation?.latitude,
                longitude: companyLocation?.longitude
            }
            const GEOFENCE_RADIUS = companyLocation?.radius // meters

            if (!geolib.isPointWithinRadius(
                { latitude: location.latitude, longitude: location.longitude },
                GEOFENCE_CENTER,
                GEOFENCE_RADIUS
            )) {
                return res.send({ status: 403, message: 'You are outside the geofence area.' })
            }

            const currentDate = moment().format('YYYY-MM-DD')
            const timesheet = await Timesheet.findOne({ userId, jobId, date: currentDate })

            if (!timesheet) {
                return res.send({ status: 404, message: "No timesheet found for today." })
            }

            const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]
            if (!lastClockin || lastClockin.clockOut) {
                return res.send({ status: 400, message: "You can't clock-out without an active clock-in." })
            }

            lastClockin.clockOut = moment().toDate()
            lastClockin.isClockin = false

            const clockInTime = moment(lastClockin.clockIn).toDate()
            const clockOutTime = moment(lastClockin.clockOut).toDate()            

            const duration = formatDuration(clockInTime, clockOutTime)
            lastClockin.totalTiming = duration

            if (timesheet.totalHours == '0h 0m 0s') {
                timesheet.totalHours = duration
            } else {
                const result = addDurations(timesheet.totalHours, duration)
                timesheet.totalHours = result
            }

            timesheet.isTimerOn = false
            await timesheet.save()
            
            // overtime calculate
            const startOfWeek = moment().startOf('isoWeek').format('YYYY-MM-DD')
            const endOfWeek = moment().endOf('isoWeek').format('YYYY-MM-DD')
            // console.log('startOfWeek:', startOfWeek, 'endOfWeek:', endOfWeek)            

            const weeklyTimesheets = await Timesheet.find({
                userId,
                date: { $gte: startOfWeek, $lte: endOfWeek }
            })
            // console.log('weeklyTimesheets:', weeklyTimesheets)

            const totalWeeklyHours = weeklyTimesheets.reduce((total, ts) => {
                return addDurations(total, ts.totalHours);
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

            await timesheet.save()

            //------exit notification-----------
            let notifiedId = []
            let readBy = []
            if (existUser.role === 'Employee') {
                if (jobDetail && jobDetail.assignManager) {
                    const assignManager = await User.findOne({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
                    // console.log('assignManager', assignManager)
                    notifiedId.push(jobDetail.assignManager);
                    readBy.push({
                        userId: jobDetail.assignManager,
                        role: assignManager?.role
                    })
                    // console.log('readBy1/..', readBy)
                }

                // const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                // // console.log('administrator', administrator)
                // if (administrator.length > 0) {
                //     notifiedId.push(administrator[0]._id);
                //     readBy.push({
                //         userId: administrator[0]._id,
                //         role: administrator[0].role
                //     })
                // }
            } else if (existUser.role === 'Manager') {
                const administrator = await User.findOne({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                if (administrator) {
                    notifiedId.push(administrator?._id);
                    readBy.push({
                        userId: administrator?._id,
                        role: administrator?.role
                    })
                }
            } else if (existUser.role === 'Administrator') {
                notifiedId.push(existUser?.creatorId)
                readBy.push({
                    userId: existUser?.creatorId,
                    role: existUser?.createdBy
                })
            }

            // const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            // superAdmin.map((sa) => {
            //     notifiedId.push(sa?._id)
            //     readBy.push({
            //         userId: sa?._id,
            //         role: sa?.role
            //     })
            // })

            const firstName = existUser.personalDetails?.firstName || ""
            const lastName = existUser.personalDetails?.lastName || ""
            const notification = new Notification({
                userId,
                // userName: `${firstName} ${lastName}`,
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
        res.send({ message: "Something went wrong while clock out!" })
    }
}

// for clock in/out frontend page
exports.getOwnTodaysTimeSheet = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            const userId = req.user._id
            const { jobId } = req.body

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: 'User not found' })
            }

            let jobDetail = existUser?.jobDetails.some((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const currentDate = moment().format('YYYY-MM-DD')
            const timesheet = await Timesheet.findOne({ userId, jobId, date: currentDate }).skip(skip).limit(limit)

            const totalTimesheets = await Timesheet.findOne({ userId, jobId, date: currentDate }).countDocuments()

            return res.send({
                status: 200,
                message: 'Timesheet fetched successfully.',
                timesheet: timesheet ? timesheet : {},
                totalTimesheets,
                totalPages: Math.ceil(totalTimesheets / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error occurred while fetching timesheet:', error);
        res.send({ message: "Something went wrong while fetching the timesheet!" });
    }
}

// for view hours frontend page
exports.getAllTimeSheets = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit
            const userId = req.body.userId || req.user._id

            const { jobId } = req.body
            const { month, year } = req.query

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }

            let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const currentDate = moment()
            let filterYear = year || currentDate.format('YYYY')
            let filterMonth = month ? month.padStart(2, '0') : null

            const joiningDate = jobDetail?.joiningDate ? moment(jobDetail?.joiningDate).startOf('day') : null
            const joiningYear = joiningDate ? joiningDate.format('YYYY') : null

            let startDate, endDate

            if (!month && !year) {
                filterYear = currentDate.format('YYYY')
                filterMonth = currentDate.format('MM')
                startDate = moment(`${filterYear}-${filterMonth}-01`).startOf('month').toDate()
                endDate = moment(startDate).endOf('month').toDate()
                if(filterYear === joiningYear && filterMonth === joiningDate.format('MM')){
                    startDate = moment(joiningDate).toDate()
                    endDate = moment(startDate).endOf('month').toDate()
                }
            } else if (month && !year) {
                filterYear = currentDate.format('YYYY');
                startDate = moment(`${filterYear}-${filterMonth}-01`).startOf('month').toDate()
                endDate = moment(startDate).endOf('month').toDate()
                if(month === joiningDate.format('MM') && filterYear === joiningYear){
                    startDate = moment(joiningDate).toDate()
                    endDate = moment(startDate).endOf('month').toDate()
                }               
            } else if (!month && year) {
                startDate = moment(`${filterYear}-01-01`).startOf('year').toDate()
                endDate = moment(startDate).endOf('year').toDate()
                if(filterYear === joiningYear){
                    startDate = moment(joiningDate).toDate()
                    endDate = moment(startDate).endOf('year').toDate()
                }
            } else {
                startDate = moment(`${filterYear}-${filterMonth}-01`).startOf('month').toDate()
                endDate = moment(startDate).endOf('month').toDate()
                if(filterYear === joiningYear && filterMonth === joiningDate.format('MM')) {
                    startDate = moment(joiningDate).toDate()
                    endDate = moment(startDate).endOf('month').toDate()
                }
            }

            const timesheets = await Timesheet.find({
                userId,
                jobId: jobId.toString(),
                createdAt: { $gte: startDate, $lte: endDate }
            }).sort({ createdAt: -1 }).skip(skip).limit(limit)

            const totalTimesheets = await Timesheet.find({
                userId,
                jobId: jobId.toString(),
                createdAt: { $gte: startDate, $lte: endDate }
            }).sort({ createdAt: -1 }).countDocuments()

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
        res.send({ message: 'Something went wrong while fetching time sheet!' })
    }
}

exports.getTimesheetReport = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user?.role) || req.token?.role === "Client"){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 30

            const skip = (page - 1) * limit

            const { jobId } = req.body

            let employeeReportStatus
            if(req.token?.role === 'Client'){
                const { reportId } = req.body

                const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } })
                if(!report){
                    return res.send({ status: 404, message: 'Report not found' })
                }

                report?.employees.map(emp => {
                    if(emp?.jobId.toString() == jobId){
                        employeeReportStatus = emp.status
                    }
                })
            }

            const user = await User.findOne({ "jobDetails._id": jobId, isDeleted: { $ne: true } })
            // const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const userId = req.body?.userId || req.user?._id || user?._id
            const { month, year, week } = req.query

            let jobDetail = user?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const joiningDate = jobDetail?.joiningDate ? moment(jobDetail?.joiningDate).startOf('day') : null
            const joiningYear = joiningDate ? joiningDate.format('YYYY') : null

            let startDate, endDate

            if(req.body?.startDate && req.body?.endDate){
                startDate = moment(req.body.startDate).startOf('day').format('YYYY-MM-DD')
                endDate = moment(req.body.endDate).endOf('day').format('YYYY-MM-DD')
            } else {
                if (year && month && month !== "All") {
                    startDate = moment({ year, month: month - 1 }).startOf('month').format('YYYY-MM-DD');
                    endDate = moment({ year, month: month - 1 }).endOf('month').format('YYYY-MM-DD');
                    if(year === joiningYear && month === joiningDate.format('MM')){
                        startDate = moment(joiningDate).format('YYYY-MM-DD')
                        endDate = moment({ year, month: month - 1 }).endOf('month').format('YYYY-MM-DD')
                    }
                } else if (year && month === "All") {
                    startDate = moment({ year }).startOf('year').format('YYYY-MM-DD');
                    endDate = moment({ year }).endOf('year').format('YYYY-MM-DD');
                    if(year === joiningYear){
                        startDate = moment(joiningDate).format('YYYY-MM-DD')
                        endDate = moment({ year }).endOf('year').format('YYYY-MM-DD')
                    }
                } else if (year && week) {
                    startDate = moment().year(year).week(week).startOf('week').format('YYYY-MM-DD');
                    endDate = moment().year(year).week(week).endOf('week').format('YYYY-MM-DD');
                } else if (year) {
                    startDate = moment({ year }).startOf('year').format('YYYY-MM-DD');
                    endDate = moment({ year }).endOf('year').format('YYYY-MM-DD');
                    if(year === joiningYear){
                        startDate = moment(joiningDate).format('YYYY-MM-DD')
                        endDate = moment({ year }).endOf('year').format('YYYY-MM-DD')
                    }
                } else if (month && month !== "All") {
                    const currentYear = moment().year();
                    startDate = moment({ year: currentYear, month: month - 1 }).startOf('month').format('YYYY-MM-DD');
                    endDate = moment({ year: currentYear, month: month - 1 }).endOf('month').format('YYYY-MM-DD');
                    if(currentYear === joiningYear && month === joiningDate.format('MM')){
                        startDate = moment(joiningDate).format('YYYY-MM-DD')
                        endDate = moment({ year: currentYear, month: month - 1 }).endOf('month').format('YYYY-MM-DD')
                    }
                } else if (month === "All") {
                    const currentYear = moment().year();
                    startDate = moment({ year: currentYear }).startOf('year').format('YYYY-MM-DD');
                    endDate = moment({ year: currentYear }).endOf('year').format('YYYY-MM-DD');
                    if(currentYear === joiningYear){
                        startDate = moment(joiningDate).format('YYYY-MM-DD')
                        endDate = moment({ year: currentYear }).endOf('year').format('YYYY-MM-DD')
                    }
                } else if (week) {
                    const currentYear = moment().year();
                    startDate = moment().year(currentYear).week(week).startOf('week').format('YYYY-MM-DD');
                    endDate = moment().year(currentYear).week(week).endOf('week').format('YYYY-MM-DD');
                } else {
                    startDate = moment().startOf('month').format('YYYY-MM-DD');
                    endDate = moment().endOf('month').format('YYYY-MM-DD');
                    if(joiningYear === moment().year() && joiningDate.format('MM') === moment().format('MM')){
                        startDate = moment(joiningDate).format('YYYY-MM-DD')
                        endDate = moment().endOf('month').format('YYYY-MM-DD')
                    }
                }
            }
        

            // 1. Fetch timesheet entries (Check-ins/outs)
            const timesheets = await Timesheet.find({ userId, jobId, createdAt: { $gte: moment(startDate).toDate(), $lte: moment(endDate).toDate() } })
            // console.log('timesheet:', timesheets)

            // 2. Fetch leave requests
            const leaves = await Leave.find({
                userId,
                jobId,
                $or: [
                    { endDate: { $exists: true, $gte: startDate }, startDate: { $lte: endDate } },
                    { endDate: { $exists: false }, startDate: { $gte: startDate, $lte: endDate } }
                ],
                status: "Approved",
                isDeleted: { $ne: true }
            })
            // console.log('leaves:', leaves)

            // 3. Fetch holidays
            const holidays = await Holiday.find({
                companyId: user.companyId,
                locationId: { $in: user.locationId },
                date: { $gte: startDate, $lte: endDate },
                isDeleted: { $ne: true }
            })
            // console.log('holidays:', holidays)

            const dateList = [];
            for (let d = moment(startDate); d.isSameOrBefore(endDate); d.add(1, 'days')) {
                dateList.push(d.clone().format('YYYY-MM-DD'))
            }
            // console.log('dateList:', dateList)

            const timesheetMap = new Map()
            timesheets.map(TS => {
                const dateKey = TS.createdAt.toISOString().split("T")[0]
                timesheetMap.set(dateKey, TS)
            })
            // console.log('timesheets:', timesheets)

            const leaveMap = new Map()
            leaves.forEach(leave => {
                const leaveStart = moment(leave.startDate, 'YYYY-MM-DD')
                const leaveEnd = leave.endDate ? moment(leave.endDate, 'YYYY-MM-DD') : leaveStart.clone()
                
                let tempDate = leaveStart.clone()
            
                while (tempDate.isSameOrBefore(leaveEnd)) {
                    leaveMap.set(tempDate.format('YYYY-MM-DD'), leave)
                    tempDate.add(1, 'days')
                }
            })
            // console.log('leaves:', leaves)

            const holidayMap = new Map();
            holidays.map(HD => {
                holidayMap.set(HD.date, HD)
            })
            // console.log('holidays:', holidays)

            const today = moment().format('YYYY-MM-DD')

            const allReports = dateList.map(dateObj => {
                const isFuture = moment(dateObj, 'YYYY-MM-DD').isAfter(today, 'day')
                const dayOfWeek = moment(dateObj, 'YYYY-MM-DD').day()
                const isWeekend = dayOfWeek === 6 || dayOfWeek === 0

                if (isWeekend || isFuture) return null
            
                const timesheetEntries = timesheets.filter(TS => TS.createdAt.toISOString().split("T")[0] === dateObj)
                const leaveEntries = leaves.filter(leave => {
                    const leaveStart = moment(leave.startDate, 'YYYY-MM-DD')
                    const leaveEnd = leave.endDate ? moment(leave.endDate, 'YYYY-MM-DD') : leaveStart.clone()
                    return moment(dateObj).isBetween(leaveStart, leaveEnd, 'day', '[]')
                });
                const holidayEntries = holidays.filter(HD => HD.date === dateObj)
            
                const hasTimesheet = timesheetEntries.length > 0
                const hasLeave = leaveEntries.length > 0
                const hasHoliday = holidayEntries.length > 0
                const isAbsent = !hasTimesheet && !hasLeave && !hasHoliday && !isFuture

                let status = "Absent"
        
                if (hasLeave) {
                    const isHalfLeave = leaveEntries.some(leave => leave.selectionDuration === "First-Half" || leave.selectionDuration === "Second-Half")
                    status = isHalfLeave ? "HalfLeave" : "Leave"
                } else if (hasTimesheet) {
                    status = "Present"
                } else if (hasHoliday) {
                    status = "Holiday"
                }
            
                let data = {}
            
                if (hasTimesheet && !hasLeave && !hasHoliday) {
                    data.timesheetData = {
                        date: timesheetEntries[0]?.date,
                        clockinTime: timesheetEntries[0]?.clockinTime,
                        totalHours: timesheetEntries[0]?.totalHours,
                        overTime: timesheetEntries[0]?.overTime
                    }
                } else if (!hasTimesheet && hasLeave && !hasHoliday) {
                    data.leaveData = {
                        leaveType: leaveEntries[0]?.leaveType,
                        selectionDuration: leaveEntries[0]?.selectionDuration,
                        startDate: leaveEntries[0]?.startDate,
                        endDate: leaveEntries[0]?.endDate,
                        leaveDays: leaveEntries[0]?.leaveDays,
                        leaves: leaveEntries[0]?.leaveType,
                        reasonOfLeave: leaveEntries[0]?.reasonOfLeave,
                        status: leaveEntries[0]?.status,
                    }
                } else if (!hasTimesheet && !hasLeave && hasHoliday) {
                    data.holidayData = {
                        date: holidayEntries[0]?.date,
                        occasion: holidayEntries[0]?.occasion
                    }
                } else if (hasTimesheet || hasLeave || hasHoliday) {
                    data = {
                        timesheetData: hasTimesheet ? {
                            date: timesheetEntries[0]?.date,
                            clockinTime: timesheetEntries[0]?.clockinTime,
                            totalHours: timesheetEntries[0]?.totalHours,
                            overTime: timesheetEntries[0]?.overTime
                        } : undefined,
                        leaveData: hasLeave ? {
                            leaveType: leaveEntries[0]?.leaveType,
                            selectionDuration: leaveEntries[0]?.selectionDuration,
                            startDate: leaveEntries[0]?.startDate,
                            endDate: leaveEntries[0]?.endDate,
                            leaveDays: leaveEntries[0]?.leaveDays,
                            leaves: leaveEntries[0]?.leaveType,
                            reasonOfLeave: leaveEntries[0]?.reasonOfLeave,
                            status: leaveEntries[0]?.status,
                        } : undefined,
                        holidayData: hasHoliday ? {
                            date: holidayEntries[0]?.date,
                            occasion: holidayEntries[0]?.occasion
                        } : undefined
                    }
                }
            
                return {
                    date: dateObj,
                    status,
                    timesheet: hasTimesheet,
                    leave: hasLeave,
                    holiday: hasHoliday,
                    absent: isAbsent,
                    data
                }
            }).filter(report => report !== null)

            const report = allReports.slice(skip, skip + limit)
            const totalReports = allReports ? allReports.length : 0

            return res.send({
                status: employeeReportStatus ? employeeReportStatus : 200,
                message: 'Timesheet report fetched successfully',
                report: report ? report : [],
                totalReports,
                totalPages: Math.ceil(totalReports / limit) || 1,
                currentPage: page || 1
            })


        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching timesheet report:', error)
        res.send({ message: 'Error occurred while fetching timesheet report!' })
    }
}

// old method
// exports.downloadTimesheetReport = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user.role)){
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 10

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
//         res.send({ message: 'Error occurred while downloading timesheet report!' })
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

exports. downloadTimesheetReport = async (req, res) => {
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
            const timesheets = await Timesheet.find({ userId, jobId, createdAt: { $gte: startMoment.toDate(), $lte: endMoment.toDate() } })

            const leaves = await Leave.find({ 
                userId, jobId, 
                status: "Approved", 
                isDeleted: { $ne: true } 
            })

            // const holidays = await Holiday.find({ 
            //     companyId: user.companyId, 
            //     locationId: { $in: user.locationId } 
            // })

            const timesheetMap = new Map()
            timesheets.forEach(ts => {
                const dateKey = moment(ts.createdAt).format("YYYY-MM-DD")
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
        res.send({ message: 'Error occurred while downloading timesheet report!' })
    }
}


// for generate QR code
exports.generateQRcode = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const id = req.params.id
            const {
                qrType,
                qrCode,
                qrValue
            } = req.body

            const types = ['Company', 'Location']
            if(!types.includes(qrType)){
                return res.send({ status: 400, message: 'QR type is undefined, please enter valid type.' })
            }

            let element = await cloudinary.uploader.upload(qrCode, {
                resource_type: 'auto',
                folder: 'QRCodes'
            })

            if(qrType == 'Company'){
                const company = await Company.findOne({ _id: id, isDeleted: { $ne: true } })
                if(!company) return res.send({ status: 404, message: 'Company not found' })
                
                const QRCode = await QR.create({
                    companyId: id,
                    companyName: company?.companyDetails?.businessName,
                    isCompanyQR: true,
                    isActive: true,
                    qrURL: element.secure_url,
                    qrValue,
                    qrType
                })
    
                return res.send({ status: 200, message: 'Company QR generated successfully.', QRCode })
            } else if(qrType == 'Location'){
                const location = await Location.findOne({ _id: id, isDeleted: { $ne: true } })
                if(!location) return res.send({ status: 404, message: 'Location not found' })

                if(location.latitude == "" || location.longitude == "" || location.radius == ""){
                    return res.send({ status: 400, message: 'You should first add or update the latitude, longitude and radius for this location before proceeding.' })
                }

                const company = await Company.findOne({ _id: location?.companyId, isDeleted: { $ne: true } })
                if(!company) return res.send({ status: 404, message: 'Company not found' })
                
                const QRCode = await QR.create({
                    companyId: location.companyId,
                    companyName: company?.companyDetails?.businessName,
                    locationName: location?.locationName,
                    locationId: id,
                    isLocationQR: true,
                    isActive: true,
                    qrURL: element.secure_url,
                    qrValue,
                    qrType
                })
    
                return res.send({ status: 200, message: 'Location QR generated successfully.', QRCode })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occured while generating QR code:', error)
        res.send({ message: 'Error occured while generating QR code!' })
    }
}

// get all QR codes by location ID
exports.getAllQRCodes = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const locationId = req.params.id
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = ( page - 1 ) * limit

            const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
            if(!location){
                return res.send({ status: 404, message: 'Location not found.' })
            }

            const companyId = location?.companyId
            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found.' })
            }

            const QRCodes = await QR.find({ companyId, locationId, isActive: { $ne: false } }).skip(skip).limit(limit)
            const totalQRCodes = await QR.find({ companyId, locationId, isActive: { $ne: false } }).countDocuments()

            let qrValue = `${location?.locationName}-${company?.companyDetails?.businessName}`

            return res.send({
                status: 200,
                message: 'QR codes fetched successfully.',
                qrValue,
                QRCodes,
                totalQRCodes,
                totalPages: Math.ceil(totalQRCodes / limit) || 1,
                currentPage: page || 1
            })

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching company QR codes:', error)
        res.send({ message: 'Error occurred while fetching QR codes!' })
    }
}

exports.inactivateQRCode = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const QRId = req.params.id
            const QRCode = await QR.findById(QRId)
            if(!QRCode){
                return res.send({ status: 404, message: 'QRCode not found!' })
            }
            if(QRCode.isActive === false){
                return res.send({ status: 400, message: 'The QR is already inactive' })
            }
            QRCode.isActive = false
            QRCode.save()
            return res.send({ status: 200, message: 'QRCode inactivated successfully.', QRCode })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while inactivating the QRCode:', error)
        res.send({ message: 'Error occurred while inactivating the QRCode!' })
    }
}

// for QR verification
// exports.verifyQRCode = async (req, res) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user.role)){
//             const { qrValue } = req.body;

//             const user = await User.findOne({ _id: req.user.id, isDeleted: { $ne: true } })
//             if(!user){
//                 return res.send({ status: 404, message: 'User not found.' })
//             }
//             let companyId = user?.companyId.toString()
//             let locationId = user?.locationId.toString()

//             let qrCode
//             qrCode = await QR.findOne({
//                 'valueOfQRCode.qrValue': qrValue,
//                 companyId,
//                 locationId,
//             });

//             if (!qrCode) {
//                 qrCode = await QR.findOne({
//                     'valueOfQRCode.qrValue': qrValue,
//                     companyId
//                 });
//             }
            
//             if (!qrCode) {
//                 return res.send({ status: 400, message: 'QR code not found or invalid QR code' })
//             }


//             let entity;
//             let entityName;
//             if (qrCode.isCompanyQR) {
//                 entity = await Company.findOne({ _id: qrCode.companyId, isDeleted: { $ne: true } });
//                 entityName = 'Company';
//             } else if (qrCode.isLocationQR) {
//                 entity = await Location.findOne({ _id: qrCode.locationId, isDeleted: { $ne: true } });
//                 entityName = 'Location';
//             }
//             if (!entity) {
//                 return res.send({
//                     status: 404,
//                     message: `${entityName} associated with the QR code not found`,
//                 });
//             }

//             return res.send({
//                 status: 200,
//                 message: `${entityName} QR code verified successfully`,
//                 entityDetails: {
//                     entityId: qrCode.isCompanyQR ? qrCode.companyId : qrCode.locationId,
//                     entityName: entityName,
//                     qrValue: qrCode.valueOfQRCode.qrValue,
//                     qrURL: qrCode.valueOfQRCode.qrURL,
//                 },
//             });
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred during QR code verification:', error);
//         res.send({ message: 'Error occurred during QR code verification!' });
//     }
// };

exports.verifyQRCode = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { qrValue } = req.body;

            const user = await User.findOne({ _id: req.user._id, isDelete: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found.' })
            }
            let companyId = user?.companyId.toString()
            let locationId = user?.locationId.toString()

            const qrCode = await QR.findOne({
                qrValue,
                companyId,
                locationId,
            })
            
            if (!qrCode) {
                return res.send({ status: 400, message: 'QR code not found or invalid QR code' })
            }

            return res.send({
                status: 200,
                message: 'QR code verified successfully.',
                entityDetails: {
                    userId: user._id,
                    qrValue,
                    locationId,
                    companyId
                }
            })

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred during QR code verification:', error)
        res.send({ message: 'Error occurred during QR code verification!' })
    }
};

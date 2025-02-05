const User = require("../models/user");
const geolib = require('geolib')
const Timesheet = require("../models/timeSheet");
const Notification = require("../models/notification");
const Company = require("../models/company");
const Location = require("../models/location");
const cloudinary = require("../utils/cloudinary");
const QR = require('../models/qrCode');
const Leave = require("../models/leaveRequest");

// pending work
// new method ma jobTitle ma id pass thase e rite manage karvanu 6 ( pending work ) API's name:- getOwnTodaysTimeSheet, getOwnAllTimeSheets, getOwnTimesheetByMonthAndYear
// changes in below all API's ( pending work )
// clock in/out ma issue solve karvano 6 and console remove karva nah 6
exports.clockInFunc = async (req, res, next) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const { userId, location, jobId, isMobile, qrValue } = req.body

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            if(isMobile === true) {
                let companyId = existUser?.companyId.toString()
                // let locationId = existUser?.locationId.toString(     
                const qrCode = await QR.findOne({
                    'valueOfQRCode.qrValue': qrValue,
                    companyId,
                    // locationId,
                })      
                if (!qrCode) {
                    return res.send({ status: 400, message: 'Invalid QR code' })
                }
            }

            let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 400, message: 'JobTitle not found' })
            }

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 400, message: "Location coordinator data is not found!" })
            }

            await User.updateOne(
                { _id: existUser._id },
                { $set: { lastKnownLocation: location } }
            )

            // const GEOFENCE_CENTER = { latitude: 21.2171, longitude: 72.8588 } // for out of geofenc area ( varachha location is)

            // const GEOFENCE_CENTER = { latitude: 21.2297, longitude: 72.8385 } // for out of geofenc area ( gajera school location )

            // const GEOFENCE_CENTER = { latitude: 21.2252, longitude: 72.8083 } // for out of geofenc area ( kantheriya hanuman ji temple location )

            // const GEOFENCE_CENTER = { latitude: 21.2242, longitude: 72.8068 } // ( office location )

            const GEOFENCE_CENTER = { latitude: 21.2337, longitude: 72.8138 } // for successfully clockin ( getted location for clockin )
            const GEOFENCE_RADIUS = 1000 // meters

            if (!geolib.isPointWithinRadius(
                { latitude: location.latitude, longitude: location.longitude },
                GEOFENCE_CENTER,
                GEOFENCE_RADIUS
            )) {
                return res.send({ status: 403, message: 'You are outside the geofence area.' })
            }

            let currentDate = new Date().toISOString().slice(0, 10)
            let timesheet = await Timesheet.findOne({ userId, date: currentDate })

            if (!timesheet) {
                const userJobs = existUser?.jobDetails || []
                const jobToLog = userJobs.length > 1 ? jobId : userJobs[0]?._id.toString()

                if (!jobToLog) {
                    return res.send({ status: 400, message: "JobTitle is required for clock-in." })
                }

                timesheet = new Timesheet({
                    userId,
                    date: currentDate,
                    sheets: [{
                        jobId: jobToLog,
                        clockinTime: [ {
                            clockIn: new Date(),
                            clockOut: null,
                            isClockin: true
                        }],
                        totalHours: "0h 0m 0s"
                    }]
                })

                await timesheet.save()
                return res.send({ status: 200, timesheet })
            }

            const userJobs = existUser?.jobDetails || []
            const jobToLog = userJobs.length > 1 ? jobId : userJobs[0]?._id.toString()

            if (!jobToLog) {
                return res.send({ status: 400, message: "Job title is required for clock-in." })
            }

            let sheet = timesheet.sheets.find(sheet => sheet.jobId === jobToLog)

            if (!sheet) {
                sheet = {
                    jobId: jobToLog,
                    clockinTime: [],
                    totalHours: "0h 0m 0s",
                    overTime: "0h 0m 0s"
                }
                timesheet.sheets.push(sheet)
            }

            const lastClockIn = sheet.clockinTime[sheet.clockinTime.length - 1]
            if (lastClockIn && !lastClockIn.clockOut) {
                return res.send({ status: 400, message: "Please clock out before clockin again." })
            }

            sheet.clockinTime.push({
                clockIn: new Date(),
                clockOut: null,
                isClockin: true
            })

            await timesheet.save()

            //------entry notification-----------
            let notifiedId = []
            let readBy = []
            if (existUser.role === 'Employee') {
                if (jobDetail && jobDetail.assignManager) {
                    const assignManager = await User.find({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
                    // console.log('assignManager', assignManager)
                    notifiedId.push(jobDetail.assignManager);
                    readBy.push({
                        userId: jobDetail.assignManager,
                        role: assignManager[0].role
                    })
                    // console.log('readBy1/..', readBy)
                }

                const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                // console.log('administrator', administrator)
                if (administrator.length > 0) {
                    notifiedId.push(administrator[0]._id);
                    readBy.push({
                        userId: administrator[0]._id,
                        role: administrator[0].role
                    })
                }
            } else if (existUser.role === 'Manager') {
                const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                if (administrator.length > 0) {
                    notifiedId.push(administrator[0]._id);
                    readBy.push({
                        userId: administrator[0]._id,
                        role: administrator[0].role
                    })
                }
            } else if (existUser.role === 'Administrator') {
                notifiedId.push(existUser.creatorId)
                readBy.push({
                    userId: existUser.creatorId,
                    role: existUser.createdBy
                })
            }

            const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            superAdmin.map((sa) => {
                notifiedId.push(sa?._id)
                readBy.push({
                    userId: sa?._id,
                    role: sa?.role
                })
            })

            const { firstName, lastName } = existUser.personalDetails;
            const name = [firstName, lastName].filter(Boolean).join(" ");
            const notification = new Notification({
                userId,
                userName: `${name}`,
                notifiedId,
                type: 'ClockIn',
                message: `User ${name} entered the geofence at ${currentDate}`,
                readBy
            });
            await notification.save();

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred during clock-in:", error)
        res.send({ message: "Something went wrong while clock-in!" })
    }
};

exports.clockOutFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const { userId, location, jobId, isMobile, qrValue } = req.body

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            if(isMobile === true) {
                let companyId = existUser?.companyId.toString()
                // let locationId = existUser?.locationId.toString()

                const qrCode = await QR.findOne({
                    'valueOfQRCode.qrValue': qrValue,
                    companyId,
                    // locationId,
                })
                
                if (!qrCode) {
                    return res.send({ status: 400, message: 'Invalid QR code' })
                }
            }

            let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 400, message: 'JobTitle not found' })
            }

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 400, message: "Location coordinator data is not found!" })
            }

            await User.updateOne(
                { _id: existUser._id },
                { $set: { lastKnownLocation: location } }
            )

            // const GEOFENCE_CENTER = { latitude: 21.2171, longitude: 72.8588 } // for out of geofenc area ( varachha location is)

            // const GEOFENCE_CENTER = { latitude: 21.2297, longitude: 72.8385 } // for out of geofenc area ( gajera school location )

            // const GEOFENCE_CENTER = { latitude: 21.2252, longitude: 72.8083 } // for out of geofenc area ( kantheriya hanuman ji temple location )

            // const GEOFENCE_CENTER = { latitude: 21.2242, longitude: 72.8068 } // ( office location )

            const GEOFENCE_CENTER = { latitude: 21.2337, longitude: 72.8138 } // for successfully clockin ( getted location for clockin )
            const GEOFENCE_RADIUS = 1000 // meters

            if (!geolib.isPointWithinRadius(
                { latitude: location.latitude, longitude: location.longitude },
                GEOFENCE_CENTER,
                GEOFENCE_RADIUS
            )) {
                return res.send({ status: 403, message: 'You are outside the geofence area.' })
            }

            let currentDate = new Date()
            const currentDatSTR = currentDate.toISOString().slice(0, 10)

            const timesheet = await Timesheet.findOne({ userId, date: currentDatSTR })
            if (!timesheet) {
                return res.send({ status: 404, message: "No timesheet found for today." })
            }

            const jobSheet = timesheet.sheets.find(sheet => sheet.jobId.toString() === jobId)
            if (!jobSheet) {
                return res.send({ status: 404, message: `No timesheet found for job title: ${jobDetail.jobTitle}` })
            }

            const lastClockin = jobSheet.clockinTime[jobSheet.clockinTime.length - 1];
            if (!lastClockin || lastClockin.clockOut) {
                return res.send({ status: 400, message: "You can't clock-out without an active clock-in." })
            }

            lastClockin.clockOut = currentDate
            lastClockin.isClockin = false

            const clockInTime = new Date(lastClockin.clockIn)
            const clockOutTime = new Date(lastClockin.clockOut)

            const formatDuration = (clockInTime, clockOutTime) => {
                let diffInSeconds = Math.floor((clockOutTime - clockInTime) / 1000)
                const hours = Math.floor(diffInSeconds / 3600)
                diffInSeconds %= 3600
                const minutes = Math.floor(diffInSeconds / 60)
                const seconds = diffInSeconds % 60

                return `${hours}h ${minutes}m ${seconds}s`
            };
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
            };

            const duration = formatDuration(clockInTime, clockOutTime)
            lastClockin.totalTiming = duration

            const addDurations = (duration1, duration2) => {
                const parseTime = (duration) => {
                    const regex = /(\d+)h|(\d+)m|(\d+)s/g
                    let hours = 0, minutes = 0, seconds = 0
                    let match;

                    while ((match = regex.exec(duration)) !== null) {
                        if (match[1]) hours = parseInt(match[1], 10)
                        if (match[2]) minutes = parseInt(match[2], 10)
                        if (match[3]) seconds = parseInt(match[3], 10)
                    }

                    return { hours, minutes, seconds }
                }

                const time1 = parseTime(duration1)
                const time2 = parseTime(duration2)

                let totalSeconds = time1.seconds + time2.seconds
                let totalMinutes = time1.minutes + time2.minutes + Math.floor(totalSeconds / 60)
                let totalHours = time1.hours + time2.hours + Math.floor(totalMinutes / 60)

                totalSeconds %= 60
                totalMinutes %= 60

                return `${totalHours}h ${totalMinutes}m ${totalSeconds}s`
            }

            jobSheet.totalHours = jobSheet.totalHours === '0h 0m 0s' ? duration : addDurations(jobSheet.totalHours, duration)

            // ----- Weekly Reset and Overtime Calculation -----
            const startOfWeek = new Date(currentDate)
            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1)
            startOfWeek.setHours(0, 0, 0, 0)

            const endOfWeek = new Date(startOfWeek)
            endOfWeek.setDate(startOfWeek.getDate() + 6)
            endOfWeek.setHours(23, 59, 59, 999)

            if (currentDate.getDay() === 1) {
                const weeklyTimesheets = await Timesheet.find({
                    userId,
                    date: { $gte: startOfWeek.toISOString().slice(0, 10), $lte: endOfWeek.toISOString().slice(0, 10) }
                })

                for (const sheet of weeklyTimesheets) {
                    for (const js of sheet.sheets) {
                        js.overTime = '0h 0m 0s'
                    }
                    await sheet.save()
                }
            }

            const weeklyTimesheets = await Timesheet.find({
                userId,
                date: { $gte: startOfWeek.toISOString().slice(0, 10), $lte: endOfWeek.toISOString().slice(0, 10) }
            })

            let totalWeeklyHours = 0;
            for (const sheet of weeklyTimesheets) {
                for (const js of sheet.sheets) {
                    const timeObj = parseTime(js.totalHours);
                    totalWeeklyHours += timeObj.hours + timeObj.minutes / 60 + timeObj.seconds / 3600;
                }
            }

            if(existUser?.jobDetails.length > 1){
                // console.log('if condition')
                let jobTitles = existUser.jobDetails
                // console.log('jobTitle', jobTitle)
                jobTitles.forEach((job) => {
                    // console.log('job', job)
                    if(job._id.toString() == jobId){
                        const weeklyLimit = job.weeklyWorkingHours
                        // console.log('totalWeeklyHours', totalWeeklyHours)
                        // console.log('weeklyLimit', weeklyLimit)
                        if(totalWeeklyHours > weeklyLimit){
                            const overtimeHours = totalWeeklyHours - weeklyLimit;
                            jobSheet.overTime = `${Math.floor(overtimeHours)}h ${Math.floor((overtimeHours % 1) * 60)}m 0s`;
                        } else {
                            jobSheet.overTime = '0h 0m 0s';
                        }
                    }
                })
            } else {
                // console.log('else part')
                const weeklyLimit = existUser?.jobDetails[0]?.weeklyWorkingHours
                // console.log('weeklyLimit', weeklyLimit)
                // console.log('totalWeeklyHours', totalWeeklyHours)
                if (totalWeeklyHours > weeklyLimit) {
                    const overtimeHours = totalWeeklyHours - weeklyLimit;
                    jobSheet.overTime = `${Math.floor(overtimeHours)}h ${Math.floor((overtimeHours % 1) * 60)}m 0s`;
                } else {
                    jobSheet.overTime = '0h 0m 0s';
                }
            }

            await timesheet.save()

            //------exit notification-----------
            let notifiedId = []
            let readBy = []
            if (existUser.role === 'Employee') {
                if (jobDetail && jobDetail.assignManager) {
                    const assignManager = await User.find({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
                    // console.log('assignManager', assignManager)
                    notifiedId.push(jobDetail.assignManager);
                    readBy.push({
                        userId: jobDetail.assignManager,
                        role: assignManager[0].role
                    })
                    // console.log('readBy1/..', readBy)
                }

                const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                // console.log('administrator', administrator)
                if (administrator.length > 0) {
                    notifiedId.push(administrator[0]._id);
                    readBy.push({
                        userId: administrator[0]._id,
                        role: administrator[0].role
                    })
                }
            } else if (existUser.role === 'Manager') {
                const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
                if (administrator.length > 0) {
                    notifiedId.push(administrator[0]._id);
                    readBy.push({
                        userId: administrator[0]._id,
                        role: administrator[0].role
                    })
                }
            } else if (existUser.role === 'Administrator') {
                notifiedId.push(existUser.creatorId)
                readBy.push({
                    userId: existUser.creatorId,
                    role: existUser.createdBy
                })
            }

            const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

            superAdmin.map((sa) => {
                notifiedId.push(sa?._id)
                readBy.push({
                    userId: sa?._id,
                    role: sa?.role
                })
            })

            const { firstName, lastName } = existUser.personalDetails;
            const name = [firstName, lastName].filter(Boolean).join(" ");
            const notification = new Notification({
                userId,
                userName: `${name}`,
                notifiedId,
                type: 'ClockOut',
                message: `User ${name} exited the geofence at ${currentDatSTR}`,
                readBy
            })
            await notification.save()

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while clocking out:", error);
        res.send({ message: "Something went wrong while clocking out!" });
    }
};

// old method
// exports.clockInFunc = async (req, res) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee'];
//         if (allowedRoles.includes(req.user.role)) {
//             // console.log('req.user.role/...', req.user.role)
//             const { userId, location, jobId, isMobile, qrValue } = req.body

//             const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
//             if (!existUser) {
//                 return res.send({ status: 404, message: "User not found" })
//             }

//             if(isMobile === true) {
//                 let companyId = existUser?.companyId.toString()
//                 // let locationId = existUser?.locationId.toString()

//                 const qrCode = await QR.findOne({
//                     qrValue,
//                     companyId,
//                     isDeleted: { $ne: true },
//                     locationId: { $in: existUser?.locationId },
//                 })
                
//                 if (!qrCode) {
//                     return res.send({ status: 400, message: 'Invalid QR code' })
//                 }
//             }

//             let jobDetail = existUser?.jobDetails.some((job) => job._id.toString() === jobId)
//             if(!jobDetail){
//                 return res.send({ status: 400, message: 'JobTitle not found' })
//             }

//             if (!location || !location.latitude || !location.longitude) {
//                 return res.send({ status: 400, message: "Location coordinator data is not found!" })
//             }

//             await User.updateOne(
//                 { _id: existUser._id },
//                 { $set: { lastKnownLocation: location } }
//             )

//             // const GEOFENCE_CENTER = { latitude: 21.2171, longitude: 72.8588 } // for out of geofenc area ( varachha location is)

//             // const GEOFENCE_CENTER = { latitude: 21.2297, longitude: 72.8385 } // for out of geofenc area ( gajera school location )

//             // const GEOFENCE_CENTER = { latitude: 21.2252, longitude: 72.8083 } // for out of geofenc area ( kantheriya hanuman ji temple location )

//             // const GEOFENCE_CENTER = { latitude: 21.2242, longitude: 72.8068 } // ( office location )

//             const GEOFENCE_CENTER = { latitude: 21.2337, longitude: 72.8138 } // for successfully clockin ( getted location for clockin )
//             const GEOFENCE_RADIUS = 1000 // meters

//             if (!geolib.isPointWithinRadius(
//                 { latitude: location.latitude, longitude: location.longitude },
//                 GEOFENCE_CENTER,
//                 GEOFENCE_RADIUS
//             )) {
//                 return res.send({ status: 403, message: 'You are outside the geofence area.' })
//             }

//             const currentDate = new Date().toISOString().slice(0, 10)
//             let timesheet = await Timesheet.findOne({ userId, date: currentDate })

//             if (!timesheet) {
//                 timesheet = new Timesheet({
//                     userId,
//                     date: currentDate,
//                     clockinTime: [],
//                     totalHours: '0h 0m 0s'
//                 })
//             }

//             const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]

//             if (lastClockin && !lastClockin.clockOut) {
//                 return res.send({ status: 400, message: "Please clock out before clockin again." })
//             }

//             timesheet.clockinTime.push({
//                 clockIn: new Date(),
//                 clockOut: "",
//                 isClockin: true
//             })

//             timesheet.isTimerOn = true
//             await timesheet.save()

//             //------entry notification-----------
//             let notifiedId = []
//             let readBy = []
//             if (existUser.role === 'Employee') {
//                 if (jobDetail && jobDetail.assignManager) {
//                     const assignManager = await User.find({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
//                     // console.log('assignManager', assignManager)
//                     notifiedId.push(jobDetail.assignManager);
//                     readBy.push({
//                         userId: jobDetail.assignManager,
//                         role: assignManager[0].role
//                     })
//                     // console.log('readBy1/..', readBy)
//                 }

//                 const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
//                 // console.log('administrator', administrator)
//                 if (administrator.length > 0) {
//                     notifiedId.push(administrator[0]._id);
//                     readBy.push({
//                         userId: administrator[0]._id,
//                         role: administrator[0].role
//                     })
//                 }
//             } else if (existUser.role === 'Manager') {
//                 const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
//                 if (administrator.length > 0) {
//                     notifiedId.push(administrator[0]._id);
//                     readBy.push({
//                         userId: administrator[0]._id,
//                         role: administrator[0].role
//                     })
//                 }
//             } else if (existUser.role === 'Administrator') {
//                 notifiedId.push(existUser.creatorId)
//                 readBy.push({
//                     userId: existUser.creatorId,
//                     role: existUser.createdBy
//                 })
//             }

//             const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

//             superAdmin.map((sa) => {
//                 notifiedId.push(sa?._id)
//                 readBy.push({
//                     userId: sa?._id,
//                     role: sa?.role
//                 })
//             })

//             const { firstName, lastName } = existUser.personalDetails;
//             const name = [firstName, lastName].filter(Boolean).join(" ");
//             const notification = new Notification({
//                 userId,
//                 userName: `${name}`,
//                 notifiedId,
//                 type: 'ClockIn',
//                 message: `${name} entered the geofence at ${currentDate}`,
//                 readBy
//             });
//             await notification.save();

//             return res.send({ status: 200, timesheet })
//         } else return res.send({ status: 403, message: "Access denied" })
//     } catch (error) {
//         console.error("Error occurred while clock in:", error);
//         res.send({ message: "Something went wrong while clock in!" })
//     }
// }

// old method
// exports.clockOutFunc = async (req, res) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee'];
//         if (allowedRoles.includes(req.user.role)) {
//             const { userId, location, jobId, isMobile, qrValue } = req.body

//             const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
//             if (!existUser) {
//                 return res.send({ status: 404, message: "User not found" })
//             }

//             if(isMobile === true) {
//                 let companyId = existUser?.companyId.toString()
//                 // let locationId = existUser?.locationId.toString()

//                 const qrCode = await QR.findOne({
//                     qrValue,
//                     companyId,
//                     isDeleted: { $ne: true },
//                     locationId: { $in: existUser?.locationId },
//                 })
                
//                 if (!qrCode) {
//                     return res.send({ status: 400, message: 'Invalid QR code' })
//                 }
//             }

//             let jobDetail = existUser?.jobDetails.some((job) => job._id.toString() === jobId)
//             if(!jobDetail){
//                 return res.send({ status: 400, message: 'JobTitle not found' })
//             }

//             if (!location || !location.latitude || !location.longitude) {
//                 return res.send({ status: 400, message: "Location coordinator data is not found!" })
//             }

//             await User.updateOne(
//                 { _id: existUser._id },
//                 { $set: { lastKnownLocation: location } }
//             )

//             // const GEOFENCE_CENTER = { latitude: 21.2171, longitude: 72.8588 } // for out of geofenc area ( varachha location is)

//             // const GEOFENCE_CENTER = { latitude: 21.2297, longitude: 72.8385 } // for out of geofenc area ( gajera school location )

//             // const GEOFENCE_CENTER = { latitude: 21.2252, longitude: 72.8083 } // for out of geofenc area ( kantheriya hanuman ji temple location )

//             // const GEOFENCE_CENTER = { latitude: 21.2242, longitude: 72.8068 } // ( office location )

//             const GEOFENCE_CENTER = { latitude: 21.2337, longitude: 72.8138 } // for successfully clockin ( getted location for clockin )
//             const GEOFENCE_RADIUS = 1000 // meters

//             if (!geolib.isPointWithinRadius(
//                 { latitude: location.latitude, longitude: location.longitude },
//                 GEOFENCE_CENTER,
//                 GEOFENCE_RADIUS
//             )) {
//                 return res.send({ status: 403, message: 'You are outside the geofence area.' })
//             }

//             const currentDate = new Date().toISOString().slice(0, 10);
//             const timesheet = await Timesheet.findOne({ userId, date: currentDate })

//             if (!timesheet) {
//                 return res.send({ status: 404, message: "No timesheet found for today." })
//             }

//             const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]
//             if (!lastClockin || lastClockin.clockOut) {
//                 return res.send({ status: 400, message: "You can't clock-out without an active clock-in." })
//             }

//             lastClockin.clockOut = new Date()
//             lastClockin.isClockin = false

//             const clockInTime = new Date(lastClockin.clockIn)
//             const clockOutTime = new Date(lastClockin.clockOut)

//             const formatDuration = (clockInTime, clockOutTime) => {
//                 let diffInSeconds = Math.floor((clockOutTime - clockInTime) / 1000)
//                 const hours = Math.floor(diffInSeconds / 3600)
//                 diffInSeconds %= 3600
//                 const minutes = Math.floor(diffInSeconds / 60)
//                 const seconds = diffInSeconds % 60

//                 return `${hours}h ${minutes}m ${seconds}s`
//             }

//             const duration = formatDuration(clockInTime, clockOutTime)
//             lastClockin.totalTiming = duration

//             if (timesheet.totalHours == '0h 0m 0s') {
//                 timesheet.totalHours = duration
//             } else {
//                 const parseTime = (duration) => {
//                     const regex = /(\d+)h|(\d+)m|(\d+)s/g
//                     let hours = 0, minutes = 0, seconds = 0
//                     let match

//                     while ((match = regex.exec(duration)) !== null) {
//                         if (match[1]) hours = parseInt(match[1], 10)
//                         if (match[2]) minutes = parseInt(match[2], 10)
//                         if (match[3]) seconds = parseInt(match[3], 10)
//                     }

//                     return { hours, minutes, seconds }
//                 }
//                 const addDurations = (duration1, duration2) => {
//                     const time1 = parseTime(duration1)
//                     const time2 = parseTime(duration2)

//                     let totalSeconds = time1.seconds + time2.seconds
//                     let totalMinutes = time1.minutes + time2.minutes + Math.floor(totalSeconds / 60)
//                     let totalHours = time1.hours + time2.hours + Math.floor(totalMinutes / 60)

//                     totalSeconds %= 60
//                     totalMinutes %= 60

//                     return `${totalHours}h ${totalMinutes}m ${totalSeconds}s`
//                 }

//                 const result = addDurations(timesheet.totalHours, duration)
//                 timesheet.totalHours = result
//             }

//             timesheet.isTimerOn = false

//             await timesheet.save()

//             //------exit notification-----------
//             let notifiedId = []
//             let readBy = []
//             if (existUser.role === 'Employee') {
//                 if (jobDetail && jobDetail.assignManager) {
//                     const assignManager = await User.find({ _id: jobDetail.assignManager, isDeleted: { $ne: true } })
//                     // console.log('assignManager', assignManager)
//                     notifiedId.push(jobDetail.assignManager);
//                     readBy.push({
//                         userId: jobDetail.assignManager,
//                         role: assignManager[0].role
//                     })
//                     // console.log('readBy1/..', readBy)
//                 }

//                 const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
//                 // console.log('administrator', administrator)
//                 if (administrator.length > 0) {
//                     notifiedId.push(administrator[0]._id);
//                     readBy.push({
//                         userId: administrator[0]._id,
//                         role: administrator[0].role
//                     })
//                 }
//             } else if (existUser.role === 'Manager') {
//                 const administrator = await User.find({ role: 'Administrator', companyId: existUser?.companyId, isDeleted: { $ne: true } });
//                 if (administrator.length > 0) {
//                     notifiedId.push(administrator[0]._id);
//                     readBy.push({
//                         userId: administrator[0]._id,
//                         role: administrator[0].role
//                     })
//                 }
//             } else if (existUser.role === 'Administrator') {
//                 notifiedId.push(existUser.creatorId)
//                 readBy.push({
//                     userId: existUser.creatorId,
//                     role: existUser.createdBy
//                 })
//             }

//             const superAdmin = await User.find({ role: 'Superadmin', isDeleted: { $ne: true } })

//             superAdmin.map((sa) => {
//                 notifiedId.push(sa?._id)
//                 readBy.push({
//                     userId: sa?._id,
//                     role: sa?.role
//                 })
//             })

//             const { firstName, lastName } = existUser.personalDetails;
//             const name = [firstName, lastName].filter(Boolean).join(" ");
//             const notification = new Notification({
//                 userId,
//                 userName: `${name}`,
//                 notifiedId,
//                 type: 'ClockOut',
//                 message: `${name} exited the geofence at ${currentDate}`,
//                 readBy
//             });
//             await notification.save();

//             return res.send({ status: 200, timesheet })
//         } else return res.send({ status: 403, message: "Access denied" })
//     } catch (error) {
//         console.error("Error occurred while clock out:", error);
//         res.send({ message: "Something went wrong while clock out!" })
//     }
// }

exports.getOwnTodaysTimeSheet = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = ( page - 1 ) * limit
            const userId = req.user._id
            const { jobId } = req.body

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if (!existUser) {
                return res.send({ status: 404, message: 'User not found' })
            }

            let jobDetail = existUser?.jobDetails.some((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 400, message: 'JobTitle not found' })
            }

            const currentDate = new Date().toISOString().slice(0, 10)
            const timesheet = await Timesheet.findOne({ userId, date: currentDate })

            let sheet = timesheet.sheets
            let todaysTimesheet = []
            sheet.map(TS => {
                if(TS.jobId.toString() === jobId){
                    todaysTimesheet.push(TS)
                }
            })

            return res.send({ status: 200, message: 'Timesheet getted successfully.', timmsheet: todaysTimesheet.length > 0 ? todaysTimesheet : [] })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error occurred while getting timesheet:', error);
        res.send({ message: "Something went wrong while getting the timesheet!" });
    }
}

exports.getOwnAllTimeSheets = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const userId = req.user._id
            const user = await User.findOne({
                _id: userId,
                isDeleted: { $ne: true },
            })
            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }
            const timesheets = await Timesheet.find({ userId })
            return res.send({ status: 200, message: 'Time sheet get successfully.', timesheets: timesheets ? timesheets : [] })

        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error occurred while getting time sheet:', error)
        res.send({ message: 'Something went wrong while getting time sheet!' })
    }
}

exports.getTimesheetByMonthAndYear = async (req, res) =>{
    const allowedRoles = ['Superadmin', 'Administrator'];
    if (allowedRoles.includes(req.user.role)) {
        const { month, year } = req.body;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        try {
            const startDate = new Date(`${year}-${month}-01T00:00:00.000Z`);
            const endDate = new Date(startDate);
            endDate.setMonth(startDate.getMonth() + 1);

            const timesheets = await Timesheet.find({
                createdAt: { $gte: startDate, $lt: endDate }
            }).populate('userId', 'personalDetails jobDetails')

            res.send({ status: 200, timesheets });

        } catch (error) {
            console.error('Error osccured while getting timesheet:', error)
            res.send({ message: 'Something went wrong while getting timesheet!' })
        }
    } else return res.send({ status: 403, message: 'Access denied' })
}

// pending work
exports.getOwnTimesheetByMonthAndYear = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { month, year } = req.query
            if (!month || !year) {
                return res.status(400).json({ message: 'Month and year are required' });
            }
            const startDate = new Date(`${year}-${month}-01T00:00:00.000`)
            const endDate = new Date(startDate)
            endDate.setMonth(startDate.getMonth() + 1)

            const timesheets = await Timesheet.find({
                userId: req.user._id,
                createdAt: { $gte: startDate, $lt: endDate }
            })

            const userLeaves = await Leave.find({
                userId: req.user._id,
                startDate: { $gte: startDate },
                endDate: { $lt: endDate },
                status: 'Approved'
            })
            console.log('timesheets/...', timesheets)
            console.log('userLeaves/...', userLeaves)

            res.status(200).send({ timesheets, userLeaves })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while getting timesheet.', error)
        res.send({ message: 'Error occurred while getting timesheet!' })
    }
}

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
                    qrURL: element.secure_url,
                    qrValue,
                    qrType
                })
    
                return res.send({ status: 200, message: 'Company QR generate successfully.', QRCode })
            } else if(qrType == 'Location'){
                const location = await Location.findOne({ _id: id, isDeleted: { $ne: true } })
                if(!location) return res.send({ status: 404, message: 'Location not found' })

                const company = await Company.findOne({ _id: location?.companyId, isDeleted: { $ne: true } })
                if(!company) return res.send({ status: 404, message: 'Company not found' })
                
                const QRCode = await QR.create({
                    companyId: location.companyId,
                    companyName: company?.companyDetails?.businessName,
                    locationName: location?.locationName,
                    locationId: id,
                    isLocationQR: true,
                    qrURL: element.secure_url,
                    qrValue,
                    qrType
                })
    
                return res.send({ status: 200, message: 'Location QR generate successfully.', QRCode })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occured while generating QR code:', error)
        res.send({ message: 'Error occured while generating QR code!' })
    }
}

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
                return res.send({ status: 404, message: 'Compnay not found.' })
            }

            const QRCodes = await QR.find({ companyId, locationId, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit)
            const totalQRCodes = await QR.find({ companyId, locationId, isDeleted: { $ne: true } }).countDocuments()

            let qrValue = `${location?.locationName} - ${company?.companyDetails?.businessName}`

            return res.send({
                status: 200,
                message: 'QR codes getted successfully.',
                qrValue,
                QRCodes,
                totalQRCodes,
                totalPages: Math.ceil(totalQRCodes / limit),
                currentPage: page,
            })

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while getting company QR codes:', error)
        res.send({ message: 'Error occurred while getting QR codes!' })
    }
}

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
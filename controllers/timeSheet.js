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
// clock in/out ma issue solve karvano 6 and console remove karva nah 6
// exports.clockInFunc = async (req, res, next) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee'];
//         if (allowedRoles.includes(req.user.role)) {
//             const { userId, location, jobTitle } = req.body

//             const existUser = await User.findById(userId)
//             if (!existUser) {
//                 return res.send({ status: 404, message: "User not found" })
//             }

//             if (!location || !location.latitude || !location.longitude) {
//                 return res.send({ status: 400, message: "Location coordinator data is not found!" })
//             }

//             let existJobTitle = existUser.jobDetails
//             const authorizedJob = existJobTitle.some(job => job.jobTitle === jobTitle);

//             if (!authorizedJob) {
//                 return res.send({ status: 400, message: 'You cannot access the clock-in feature for this role, please switch to the appropriate role!' })
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

//             let currentDate = new Date().toISOString().slice(0, 10)
//             let timesheet = await Timesheet.findOne({ userId, date: currentDate })

//             if (!timesheet) {
//                 const userJobs = existUser?.jobDetails || []
//                 const jobToLog = userJobs.length > 1 ? jobTitle : userJobs[0]?.jobTitle

//                 if (!jobToLog) {
//                     return res.send({ status: 400, message: "JobTitle is required for clock-in." })
//                 }

//                 timesheet = new Timesheet({
//                     userId,
//                     date: currentDate,
//                     sheets: [{
//                         jobTitle: jobToLog,
//                         clockinTime: [ {
//                             clockIn: new Date(),
//                             clockOut: null,
//                             isClockin: true
//                         }],
//                         totalHours: "0h 0m 0s"
//                     }]
//                 })

//                 await timesheet.save()
//                 return res.send({ status: 200, timesheet })
//             }

//             const userJobs = existUser?.jobDetails || []
//             const jobToLog = userJobs.length > 1 ? jobTitle : userJobs[0]?.jobTitle

//             if (!jobToLog) {
//                 return res.send({ status: 400, message: "Job title is required for clock-in." })
//             }

//             let sheet = timesheet.sheets.find(sheet => sheet.jobTitle === jobToLog)

//             if (!sheet) {
//                 sheet = {
//                     jobTitle: jobToLog,
//                     clockinTime: [],
//                     totalHours: "0h 0m 0s",
//                     overTime: "0h 0m 0s"
//                 }
//                 timesheet.sheets.push(sheet)
//             }

//             const lastClockIn = sheet.clockinTime[sheet.clockinTime.length - 1]
//             if (lastClockIn && !lastClockIn.clockOut) {
//                 return res.send({ status: 400, message: "Please clock out before clockin again." })
//             }

//             sheet.clockinTime.push({
//                 clockIn: new Date(),
//                 clockOut: null,
//                 isClockin: true
//             })

//             await timesheet.save()

//             //------entry notification-----------
//             const notifiedId = existUser?.creatorId;
//             const { firstName, middleName, lastName } = existUser.personalDetails;
//             const name = [firstName, middleName, lastName].filter(Boolean).join(" ");
//             const notification = new Notification({
//                 userId,
//                 notifiedId,
//                 type: 'Clockin',
//                 message: `User ${name} entered the geofence at ${currentDate}`
//             });
//             await notification.save();

//             return res.send({ status: 200, timesheet })
//         } else return res.send({ status: 403, message: "Access denied" })
//     } catch (error) {
//         console.error("Error occurred during clock-in:", error)
//         res.send({ message: "Something went wrong while clock-in!" })
//     }
// };

// exports.clockOutFunc = async (req, res) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee'];
//         if (allowedRoles.includes(req.user.role)) {
//             const { userId, location, jobTitle } = req.body;

//             const existUser = await User.findById(userId);
//             if (!existUser) {
//                 return res.send({ status: 404, message: "User not found" });
//             }

//             if (!location || !location.latitude || !location.longitude) {
//                 return res.send({ status: 400, message: "Location coordinator data is not found!" });
//             }

//             let currentDate = new Date();
//             let currentDateStr = currentDate.toISOString().slice(0, 10);

//             const timesheet = await Timesheet.findOne({ userId, date: currentDateStr });
//             if (!timesheet) {
//                 return res.send({ status: 404, message: "No timesheet found for today." });
//             }

//             const jobSheet = timesheet.sheets.find(sheet => sheet.jobTitle === jobTitle);
//             if (!jobSheet) {
//                 return res.send({ status: 404, message: `No timesheet found for job title: ${jobTitle}` });
//             }

//             const lastClockin = jobSheet.clockinTime[jobSheet.clockinTime.length - 1];
//             if (!lastClockin || lastClockin.clockOut) {
//                 return res.send({ status: 400, message: "You can't clock-out without an active clock-in." });
//             }

//             lastClockin.clockOut = currentDate;
//             lastClockin.isClockin = false;

//             const clockInTime = new Date(lastClockin.clockIn);
//             const clockOutTime = new Date(lastClockin.clockOut);

//             const formatDuration = (clockInTime, clockOutTime) => {
//                 let diffInSeconds = Math.floor((clockOutTime - clockInTime) / 1000);
//                 const hours = Math.floor(diffInSeconds / 3600);
//                 diffInSeconds %= 3600;
//                 const minutes = Math.floor(diffInSeconds / 60);
//                 const seconds = diffInSeconds % 60;

//                 return `${hours}h ${minutes}m ${seconds}s`;
//             };
//             const parseTime = (duration) => {
//                 const regex = /(\d+)h|(\d+)m|(\d+)s/g;
//                 let hours = 0, minutes = 0, seconds = 0;
//                 let match;

//                 while ((match = regex.exec(duration)) !== null) {
//                     if (match[1]) hours = parseInt(match[1], 10);
//                     if (match[2]) minutes = parseInt(match[2], 10);
//                     if (match[3]) seconds = parseInt(match[3], 10);
//                 }

//                 return { hours, minutes, seconds };
//             };

//             const duration = formatDuration(clockInTime, clockOutTime);
//             lastClockin.totalTiming = duration;

//             const addDurations = (duration1, duration2) => {
//                 const parseTime = (duration) => {
//                     const regex = /(\d+)h|(\d+)m|(\d+)s/g;
//                     let hours = 0, minutes = 0, seconds = 0;
//                     let match;

//                     while ((match = regex.exec(duration)) !== null) {
//                         if (match[1]) hours = parseInt(match[1], 10);
//                         if (match[2]) minutes = parseInt(match[2], 10);
//                         if (match[3]) seconds = parseInt(match[3], 10);
//                     }

//                     return { hours, minutes, seconds };
//                 };

//                 const time1 = parseTime(duration1);
//                 const time2 = parseTime(duration2);

//                 let totalSeconds = time1.seconds + time2.seconds;
//                 let totalMinutes = time1.minutes + time2.minutes + Math.floor(totalSeconds / 60);
//                 let totalHours = time1.hours + time2.hours + Math.floor(totalMinutes / 60);

//                 totalSeconds %= 60;
//                 totalMinutes %= 60;

//                 return `${totalHours}h ${totalMinutes}m ${totalSeconds}s`;
//             };

//             jobSheet.totalHours = jobSheet.totalHours === '0h 0m 0s' ? duration : addDurations(jobSheet.totalHours, duration);

//             // ----- Weekly Reset and Overtime Calculation -----
//             const startOfWeek = new Date(currentDate);
//             startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);
//             startOfWeek.setHours(0, 0, 0, 0);

//             const endOfWeek = new Date(startOfWeek);
//             endOfWeek.setDate(startOfWeek.getDate() + 6);
//             endOfWeek.setHours(23, 59, 59, 999);

//             if (currentDate.getDay() === 1) {
//                 const weeklyTimesheets = await Timesheet.find({
//                     userId,
//                     date: { $gte: startOfWeek.toISOString().slice(0, 10), $lte: endOfWeek.toISOString().slice(0, 10) }
//                 });

//                 for (const sheet of weeklyTimesheets) {
//                     for (const js of sheet.sheets) {
//                         js.overTime = '0h 0m 0s';
//                     }
//                     await sheet.save();
//                 }
//             }

//             const weeklyTimesheets = await Timesheet.find({
//                 userId,
//                 date: { $gte: startOfWeek.toISOString().slice(0, 10), $lte: endOfWeek.toISOString().slice(0, 10) }
//             });

//             let totalWeeklyHours = 0;
//             for (const sheet of weeklyTimesheets) {
//                 for (const js of sheet.sheets) {
//                     const timeObj = parseTime(js.totalHours);
//                     totalWeeklyHours += timeObj.hours + timeObj.minutes / 60 + timeObj.seconds / 3600;
//                 }
//             }console.log('existUser?.jobDetails.length', existUser?.jobDetails.length)

//             if(existUser?.jobDetails.length > 1){
//                 console.log('if condition')
//                 let jobTitles = existUser.jobDetails
//                 console.log('jobTitle', jobTitle)
//                 jobTitles.forEach((job) => {
//                     console.log('job', job)
//                     if(job.jobTitle == jobTitle){
//                         const weeklyLimit = job.weeklyWorkingHours
//                         console.log('totalWeeklyHours', totalWeeklyHours)
//                         console.log('weeklyLimit', weeklyLimit)
//                         if(totalWeeklyHours > weeklyLimit){
//                             const overtimeHours = totalWeeklyHours - weeklyLimit;
//                             jobSheet.overTime = `${Math.floor(overtimeHours)}h ${Math.floor((overtimeHours % 1) * 60)}m 0s`;
//                         } else {
//                             jobSheet.overTime = '0h 0m 0s';
//                         }
//                     }
//                 })
//             } else {
//                 console.log('else part')
//                 const weeklyLimit = existUser?.jobDetails[0]?.weeklyWorkingHours
//                 console.log('weeklyLimit', weeklyLimit)
//                 console.log('totalWeeklyHours', totalWeeklyHours)
//                 if (totalWeeklyHours > weeklyLimit) {
//                     const overtimeHours = totalWeeklyHours - weeklyLimit;
//                     jobSheet.overTime = `${Math.floor(overtimeHours)}h ${Math.floor((overtimeHours % 1) * 60)}m 0s`;
//                 } else {
//                     jobSheet.overTime = '0h 0m 0s';
//                 }
//             }

//             await timesheet.save();

//             //------exit notification-----------
//             const notifiedId = existUser?.creatorId;
//             const { firstName, middleName, lastName } = existUser.personalDetails;
//             const name = [firstName, middleName, lastName].filter(Boolean).join(" ");
//             const notification = new Notification({
//                 userId,
//                 notifiedId,
//                 type: 'Clockout',
//                 message: `User ${name} exited the geofence at ${currentDateStr}`
//             });
//             await notification.save();

//             return res.send({ status: 200, timesheet });
//         } else return res.send({ status: 403, message: "Access denied" });
//     } catch (error) {
//         console.error("Error occurred while clocking out:", error);
//         res.send({ message: "Something went wrong while clocking out!" });
//     }
// };

// old method
exports.clockInFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            // console.log('req.user.role/...', req.user.role)
            const { userId, location } = req.body

            const existUser = await User.findById(userId)
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
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

            const currentDate = new Date().toISOString().slice(0, 10)
            let timesheet = await Timesheet.findOne({ userId, date: currentDate })

            if (!timesheet) {
                timesheet = new Timesheet({
                    userId,
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
                clockIn: new Date(),
                clockOut: "",
                isClockin: true
            })

            timesheet.isTimerOn = true
            await timesheet.save()

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while clock in:", error);
        res.send({ message: "Something went wrong while clock in!" })
    }
}

// old method
exports.clockOutFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const { userId, location } = req.body

            const existUser = await User.findById(userId)
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 400, message: "Something went wrong, Please try again!" })
            }

            const currentDate = new Date().toISOString().slice(0, 10);
            const timesheet = await Timesheet.findOne({ userId, date: currentDate })

            if (!timesheet) {
                return res.send({ status: 404, message: "No timesheet found for today." })
            }

            const lastClockin = timesheet.clockinTime[timesheet.clockinTime.length - 1]
            if (!lastClockin || lastClockin.clockOut) {
                return res.send({ status: 400, message: "You can't clock-out without an active clock-in." })
            }

            lastClockin.clockOut = new Date()
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
            }

            const duration = formatDuration(clockInTime, clockOutTime)
            lastClockin.totalTiming = duration

            if (timesheet.totalHours == '0h 0m 0s') {
                timesheet.totalHours = duration
            } else {
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

                const result = addDurations(timesheet.totalHours, duration)
                timesheet.totalHours = result
            }

            timesheet.isTimerOn = false

            await timesheet.save()

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while clock out:", error);
        res.send({ message: "Something went wrong while clock out!" })
    }
}

exports.getOwnTodaysTimeSheet = async (req, res) => {
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
            const currentDate = new Date().toISOString().slice(0, 10)
            const timesheet = await Timesheet.findOne({ userId, date: currentDate })

            let multipleRole = { multipleJobType: false, jobTitles: [] };
            if (user.jobDetails.length > 1) {
                multipleRole.multipleJobType = true;
                multipleRole.jobTitles = user.jobDetails.map((job) => job.jobTitle);
                if (timesheet) {
                    return res.send({
                        status: 200,
                        message: 'Timesheet retrieved successfully.',
                        multipleJobType: multipleRole?.multipleJobType,
                        jobTitles: multipleRole?.jobTitles,
                        timesheet,
                    });
                } else {
                    return res.send({
                        status: 404,
                        message: 'Record not found!',
                        multipleJobType: multipleRole?.multipleJobType,
                        jobTitles: multipleRole?.jobTitles,
                        timesheet: {},
                    });
                }
            } else {
                multipleRole.jobTitles = user.jobDetails[0]?.jobTitle;
                if (timesheet) {
                    return res.send({
                        status: 200,
                        message: 'Timesheet retrieved successfully.',
                        multipleJobType: multipleRole?.multipleJobType,
                        jobTitles: multipleRole?.jobTitles,
                        timesheet,
                    });
                } else {
                    return res.send({
                        status: 404,
                        message: 'Record not found!',
                        multipleJobType: multipleRole?.multipleJobType,
                        jobTitles: multipleRole?.jobTitles,
                        timesheet: {},
                    });
                }
            }
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
            if (timesheets) {
                return res.send({ status: 200, message: 'Time sheet get successfully.', timesheets })
            } else {
                return res.send({ status: 404, message: 'Record is not found!', timesheets: {} })
            }

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
    } else return res.send({ status: 403, messgae: 'Access denied' })
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
                return res.send({ status: 400, messgae: 'QR type is undefined, please enter valid type.' })
            }

            let generatedQR
            let element = await cloudinary.uploader.upload(qrCode, {
                resource_type: 'auto',
                folder: 'QRCodes'
            })
            generatedQR = {
                qrId: element.public_id,
                qrURL: element.secure_url,
                qrValue,
            }

            if(qrType == 'Company'){
                const company = await Company.findById(id)
                if(!company) return res.send({ status: 404, messgae: 'Company not found' })
                
                const QRCode = await QR.create({
                    companyId: id,
                    isCompanyQR: true,
                    valueOfQRCode: generatedQR
                })
    
                return res.send({ status: 200, message: 'Company QR generate successfully.', QRCode })
            } else if(qrType == 'Location'){
                const location = await Location.findById(id)
                if(!location) return res.send({ status: 404, messgae: 'Location not found' })
                
                const QRCode = await QR.create({
                    companyId: location.companyId,
                    locationId: id,
                    isLocationQR: true,
                    valueOfQRCode: generatedQR
                })
    
                return res.send({ status: 200, message: 'Location QR generate successfully.', QRCode })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occured while generating QR code:', error)
        res.send({ message: 'Error occured while generating QR code!' })
    }
}

// exports.verifyQRCode = async (req, res) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user.role)){
//             const { qrValue } = req.body;

//             const user = await User.findById(req.user._id)
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
//                 entity = await Company.findById(qrCode.companyId);
//                 entityName = 'Company';
//             } else if (qrCode.isLocationQR) {
//                 entity = await Location.findById(qrCode.locationId);
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

            const user = await User.findById(req.user._id)
            if(!user){
                return res.send({ status: 404, message: 'User not found.' })
            }
            let companyId = user?.companyId.toString()
            let locationId = user?.locationId.toString()

            const qrCode = await QR.findOne({
                'valueOfQRCode.qrValue': qrValue,
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
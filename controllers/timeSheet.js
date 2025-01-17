const User = require("../models/user");
const geolib = require('geolib')
const Timesheet = require("../models/timeSheet");
const Notification = require("../models/notification");

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

            let currentDate = new Date().toISOString().slice(0, 10)
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

            const clockInsToday = timesheet.clockinTime.filter(entry => entry.clockIn).length
            if (clockInsToday >= 2) {
                return res.send({ status: 400, message: "You can only clock-in twice in a day." })
            }

            timesheet.clockinTime.push({
                clockIn: new Date(),
                clockOut: "",
                isClockin: true
            })

            timesheet.isTimerOn = true
            await timesheet.save()

            //------entry notification-----------
            const notifiedId = existUser?.creatorId;
            const { firstName, middleName, lastName } = existUser.personalDetails;
            const name = [firstName, middleName, lastName].filter(Boolean).join(" ");
            const notification = new Notification({
                userId,
                notifiedId,
                type: 'Clockin',
                message: `User ${name} entered the geofence at ${currentDate}`
            });
            await notification.save();

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while clock in:", error);
        res.send({ message: "Something went wrong while clock in!" })
    }
}

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

            let currentDate = new Date().toISOString().slice(0, 10);
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

            const parseTime = (duration) => {
                const regex = /(\d+)h|(\d+)m|(\d+)s/g;
                let hours = 0, minutes = 0, seconds = 0;
                let match;

                while ((match = regex.exec(duration)) !== null) {
                    if (match[1]) hours = parseInt(match[1], 10);
                    if (match[2]) minutes = parseInt(match[2], 10);
                    if (match[3]) seconds = parseInt(match[3], 10);
                }

                return hours * 3600 + minutes * 60 + seconds;
            };

            const totalHoursObj = parseTime(timesheet.totalHours);
            const totalWorkedHours = totalHoursObj.hours + totalHoursObj.minutes / 60 + totalHoursObj.seconds / 3600;
            console.log('totalHours/...', totalHoursObj)
            console.log('totalWorkedHours/...', totalWorkedHours)
            console.log('existUser/...', existUser)
            console.log('existUser?.jobDetails?.weeklyWorkingHours/...', existUser?.jobDetails?.weeklyWorkingHours)

            if (totalWorkedHours > existUser?.jobDetails?.weeklyWorkingHours) {
                console.log('if-part')
                const overtimeHours = formatDuration(totalWorkedHours, existUser?.jobDetails?.weeklyWorkingHours);
                console.log('overtimeHours/...', overtimeHours)
                timesheet.overTime = overtimeHours;
            } else {
                console.log('else-part')
                timesheet.overTime = '0h 0m 0s';
            }

            timesheet.isTimerOn = false

            await timesheet.save()

            //------exit notification-----------
            const notifiedId = existUser?.creatorId;
            const { firstName, middleName, lastName } = existUser.personalDetails;
            const name = [firstName, middleName, lastName].filter(Boolean).join(" ");
            const notification = new Notification({
                userId,
                notifiedId,
                type: 'Clockout',
                message: `User ${name} exited the geofence at ${currentDate}`
            });
            await notification.save();

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
            if (timesheet) {
                return res.send({ status: 200, message: 'Time sheet get successfully.', timesheet })
            } else {
                return res.send({ status: 404, message: 'Record is not found!', timesheet: {} })
            }

        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error occurred while getting time sheet:', error)
        res.send({ message: "Something went wrong while getting time sheet!" })
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
            console.error('Error osccured while getting attendences:', error)
            res.send({ message: 'Something went wrong while getting attendences' })
        }
    } else return res.send({ status: 403, messgae: 'Access denied' })
}
const User = require("../models/user");
const bcrypt = require("bcrypt");
const geolib = require('geolib')
const Timesheet = require("../models/timeSheet");
const { transporter } = require("../utils/nodeMailer");

exports.login = async (req, res) => {
    try {
        if (!req.body.email || !req.body.password) {
            return res.send({ status: 400, message: "Email and password are required" });
        }

        const isExist = await User.findOne({ "personalDetails.email": req.body.email, isDeleted: false });

        if (!isExist) {
            return res.send({ status: 404, message: "User not found" });
        }

        const token = await isExist.generateAuthToken()
        isExist.token = token
        isExist.save()

        const personalDetails = isExist?.personalDetails
        const role = isExist?.role
        const createdAt = isExist?.createdAt
        const _id = isExist?._id

        if (isExist.personalDetails.password == req.body.password) {
            return res.send({
                status: 200,
                message: "User login successfully",
                user: { personalDetails, role, token, createdAt, _id },
            });
        } else {
            const hashedPassword = isExist.personalDetails.password;
            await bcrypt.compare(req.body.password, hashedPassword, async (err, result) => {
                if (err) {
                    console.error("Error comparing passwords:", err);
                    return res.send({ status: 500, message: "Internal server error" });
                }
                if (!result) {
                    return res.send({ status: 404, message: "Invalid credential" });
                }
                return res.send({
                    status: 200,
                    message: "User login successfully",
                    user: { personalDetails, role, token, createdAt, _id },
                });
            });
        }
    } catch (error) {
        console.error("Error occurred while logging in:", error);
        res.send({ message: "Something went wrong while login!" })
    }
};

exports.emailVerification = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.send({ status: 400, message: "Please enter valid email address." })
        }

        const findUser = await User.findOne({ "personalDetails.email": email })
        if (!findUser) {
            return res.send({ status: 404, message: "User not found." })
        }

        const otp = Math.floor(100000 + Math.random() * 900000)
        findUser.otp = otp
        await findUser.save()

        if (otp) {
            let mailOptions = {
                from: process.env.NODEMAILER_EMAIL,
                to: findUser.personalDetails.email,
                subject: "HRMS: Password recovery",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="text-align: center; color: #4CAF50;">OTP Verification</h2>
                        <p>Dear ${findUser.personalDetails.firstName},</p>
                        <p>We received a request to verify your email address. Please use the OTP below to complete the verification process:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <span style="font-size: 24px; font-weight: bold; color: #333; padding: 10px 20px; background-color: #f4f4f4; border-radius: 5px; display: inline-block;">
                                ${otp}
                            </span>
                        </div>
                        <p style="text-align: center;">This OTP is valid for the next 10 minutes.</p>
                        <p>If you did not request this verification, please ignore this email or contact support if you have concerns.</p>
                        <hr style="border: none; border-top: 1px solid #ddd;">
                        <p style="font-size: 12px; color: #888; text-align: center;">
                            This is an automated message. Please do not reply.
                        </p>
                    </div>
                `,
            }

            await transporter.sendMail(mailOptions, (error, info) => {
                if (info) {
                    console.log("Email sent successfully:", info.response);
                }
            });

            return res.send({ status: 200, message: otp })
        } else {
            return res.send({ status: 400, message: "OTP not generated." })
        }
    } catch (error) {
        console.error("Error occurred while email verification:", error);
        res.send({ message: "Something went wrong while email verification!" })
    }
}

exports.otpVerification = async (req, res) => {
    try {
        const { email, otp } = req.body
        const findUser = await User.findOne({ "personalDetails.email": email, isDeleted: false })
        if (findUser) {
            if (findUser.otp === otp) {
                return res.send({ status: 200, message: "OTP verified successfully." })
            } else {
                return res.send({ status: 409, message: "Invalid OTP." })
            }
        } else {
            return res.send({ status: 404, message: "User not found." })
        }
    } catch (error) {
        console.error("Error occurred while OTP verification:", error);
        res.send({ message: "Something went wrong while OTP verification!" })
    }
}

exports.forgotPassword = async (req, res) => {
    try {

        const { email, newPassword, confirmPassword } = req.body
        const user = await User.findOne({
            "personalDetails.email": email,
            isDeleted: false
        })
        if (!user) {
            return res.send({ status: 404, message: "User not found" })
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/
        if (!passwordRegex.test(newPassword)) {
            return res.send({
                "status": 401,
                "message": "Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long."
            })
        }

        if (newPassword !== confirmPassword) {
            return res.send({ status: 400, message: "New password and confirm password do not match." })
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.personalDetails.password = hashedPassword
        await user.save()
        res.send({ status: 200, message: "Password updated successfully." })
    } catch (error) {
        console.error("Error occurred while forgot password:", error);
        res.send({ message: "Something went wrong while forgot password!" })
    }
}

exports.updatePassword = async (req, res) => {
    try {
        const { userId, oldPassword, newPassword, confirmPassword } = req.body

        const user = await User.findOne({ _id: userId, isDeleted: false })
        if (!user) {
            return res.send({ status: 404, message: "User not found." })
        }

        const isMatch = await bcrypt.compare(oldPassword, user.personalDetails.password)
        if (!isMatch) {
            return res.send({ status: 400, message: "Old password is incorrect." })
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/
        if (!passwordRegex.test(newPassword)) {
            return res.send({
                "status": 401,
                "message": "Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long."
            })
        }

        if (newPassword !== confirmPassword) {
            return res.send({ status: 400, message: "New password and confirm password do not match." })
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)

        user.personalDetails.password = hashedPassword;
        await user.save()

        return res.send({ status: 200, message: "Password updated successfully." })
    } catch (error) {
        console.error("Error occurred while updating password:", error);
        res.send({ message: "Something went wrong while updating password!" })
    }
}

exports.getDetails = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const userId = req.user._id
            const user = await User.findOne({
                _id: userId,
                isDeleted: { $ne: true },
            })
            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }
            return res.send({ status: 200, user })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting details:", error);
        res.send({ message: "Something went wrong while getting details!" })
    }
}

exports.getAllUsers = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const users = await User.find()
            users.forEach((e) => {
                if (e.documentDetails.length > 0) {
                    for (let i = 0; i < e.documentDetails.length; i++) {
                        const doc = e.documentDetails[i];
                        doc.document = 'documentFile.pdf'
                    }
                }
            })
            return res.send({ status: 200, message: 'Users get successfully.', users })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting users:", error);
        res.send({ message: "Something went wrong while getting users!" })
    }
}

exports.clockInFunc = async (req, res) => {
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

            await User.updateOne(
                { _id: existUser._id },
                { $set: { lastKnownLocation: location } }
            )

            const GEOFENCE_CENTER = { latitude: 21.1959, longitude: 72.8302 }
            const GEOFENCE_RADIUS = 5000 // meters

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
                    clockingTime: [],
                    totalHours: 0
                })
            }

            const clockInsToday = timesheet.clockingTime.filter(entry => entry.clockIn).length
            if (clockInsToday >= 2) {
                return res.send({ status: 400, message: "You can only clock in two times per day." })
            }

            const lastClocking = timesheet.clockingTime[timesheet.clockingTime.length - 1]

            if (lastClocking && !lastClocking.clockOut) {
                return res.send({ status: 400, message: "Please clock out before clocking in again." })
            }

            timesheet.clockingTime.push({
                clockIn: new Date(),
                clockOut: ""
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

            const lastClocking = timesheet.clockingTime[timesheet.clockingTime.length - 1]
            if (!lastClocking || lastClocking.clockOut) {
                return res.send({ status: 400, message: "No active clock-in to clock out from." })
            }

            lastClocking.clockOut = new Date()

            const clockInTime = new Date(lastClocking.clockIn)
            const clockOutTime = new Date(lastClocking.clockOut)

            const formatDuration = (clockInTime, clockOutTime) => {
                let diffInSeconds = Math.floor((clockOutTime - clockInTime) / 1000)
                const hours = Math.floor(diffInSeconds / 3600)
                diffInSeconds %= 3600
                const minutes = Math.floor(diffInSeconds / 60)
                const seconds = diffInSeconds % 60

                return `${hours}h ${minutes}m ${seconds}s`
            }

            const duration = formatDuration(clockInTime, clockOutTime)
            lastClocking.totalTiming = duration

            if (timesheet.totalHours == 0) {
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
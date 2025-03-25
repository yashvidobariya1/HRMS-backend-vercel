const moment = require('moment')
const User = require('../models/user')
const Timesheet = require('../models/timeSheet')
const Leave = require('../models/leaveRequest')
const Holiday = require('../models/holiday')
const Notification = require('../models/notification')
const { transporter } = require("../utils/nodeMailer")

exports.leaveActionReminder = async (tomorrow) => {
    const pendingLeaves = await Leave.find({
        status: "Pending",
        startDate: tomorrow
    }).populate('userId')

    for (const leave of pendingLeaves) {
        const employee = await User.findById(leave.userId).lean()

        const jobDetail = employee.jobDetails.find(j => j?._id.toString() === leave?.jobId.toString())

        if (jobDetail && jobDetail?.assignManager) {
            const assignManager = await User.findById(jobDetail?.assignManager).lean()
            if (assignManager && assignManager?.personalDetails?.email) {
                let mailOptions = {
                    from: process.env.NODEMAILER_EMAIL,
                    to: assignManager?.personalDetails?.email,
                    subject: "Leave Request Reminder",
                    html:`
                        <h2>Reminder for Leave Request :</h2>
                        <p>Dear ${assignManager?.personalDetails?.firstName} ${assignManager?.personalDetails?.lastName},<br><br>You have a pending leave request for <b>${leave?.userName}</b> ${ leave?.endDate ? `starting from <b>${leave?.startDate}</b> to <b>${leave?.endDate}</b>` : `on <b>${leave?.startDate}</b>` }. Please take action.</p>
                        <p>Best Regards,<br>HRMS Team</p>
                    `
                }                
                transporter.sendMail(mailOptions)

                await Notification.create({
                    // userName: `${assignManager?.personalDetails?.firstName} ${assignManager?.personalDetails?.lastName} (You)`,
                    userId: assignManager?._id,
                    notifiedId: [ assignManager?._id ],
                    type: 'Leave Request Reminder',
                    message: `You have a pending leave request for ${leave?.userName} ${ leave?.endDate ? `starting from <b>${leave?.startDate}</b> to <b>${leave?.endDate}</b>` : `on <b>${leave?.startDate}</b>` }`,
                    readBy: [{
                        userId: assignManager?._id,
                        role: assignManager?.role
                    }]
                })
            } else {
                console.log(`No valid assignManager email found for leave request of ${leave?.userName}`)
            }
        } else {
            console.log(`No assigner manager found for leave request of ${leave?.userName}`)
        }
    }
}

exports.clockInOutReminder = async (type, today) => {
    const allEmployees = await User.find({ role: { $in: ["Administrator", "Manager", "Employee"] }, isDeleted: { $ne: true } }).lean()

    for(const employee of allEmployees){
        const { _id, companyId, locationId, jobDetails } = employee

        const isHoliday = await Holiday.exists({ date: today, companyId, locationId: { $in: locationId }, isDeleted: { $ne: true } })
        if (isHoliday) continue

        for(const job of jobDetails){
            const isOnLeave = await Leave.exists({
                userId: _id,
                jobId: job?._id,
                date: today,
                status: 'Approved'
            })

            if(isOnLeave) continue

            const timesheet = await Timesheet.findOne({ userId: _id, jobId: job?._id, date: today })

            let hasClockIn = false
            let hasMissingClockOut = false
            let isTimerOn = false

            if (timesheet && timesheet?.clockinTime.length > 0) {
                hasClockIn = true

                const lastEntry = timesheet?.clockinTime[timesheet?.clockinTime.length - 1]
                if (!lastEntry.clockOut) {
                    hasMissingClockOut = true
                    isTimerOn = timesheet.isTimerOn
                }
            }

            if (type === 'clock-in' && !hasClockIn) {
                let mailOptions = {
                    from: process.env.NODEMAILER_EMAIL,
                    to: employee?.personalDetails?.email,
                    subject: 'Missing Clock-in Reminder',
                    html: `
                        <h2>Reminder for missing Clock-in</h2>
                        <p>You haven't clocked in today for ${job?.jobTitle} Role.</p>
                        <p>Best Regards,<br>HRMS Team</p>
                    `
                }
                transporter.sendMail(mailOptions)

                await Notification.create({
                    // userName: `${employee?.personalDetails?.firstName} ${employee?.personalDetails?.lastName} (You)`,
                    userId: _id,
                    notifiedId: [_id],
                    type: 'Clock-in Reminder',
                    message: `You haven't clocked in today for <b>${job?.jobTitle}</b> Role.`,
                    readBy: [{ userId: _id, role: employee?.role }]
                })
            }

            if (type === 'clock-out' && hasMissingClockOut && isTimerOn) {
                let mailOptions = {
                    from: process.env.NODEMAILER_EMAIL,
                    to: employee?.personalDetails?.email,
                    subject: 'Missing Clock-out Reminder',
                    html: `
                        <h2>Reminder for missing Clock-out</h2>
                        <p>You haven't clocked out yet for ${job?.jobTitle} Role.</p>
                        <p>Best Regards,<br>HRMS Team</p>
                    `
                }
                transporter.sendMail(mailOptions)

                await Notification.create({
                    // userName: `${employee?.personalDetails?.firstName} ${employee?.personalDetails?.lastName} (You)`,
                    userId: _id,
                    notifiedId: [_id],
                    type: 'Clock-out Reminder',
                    message: `You haven't clocked out yet for <b>${job?.jobTitle}</b> Role.`,
                    readBy: [{ userId: _id, role: employee?.role }]
                })
            }
        }
    }
}

exports.visaExpiryReminder = async (targetDate) => {
    const employees = await User.find({
        role: { $in: ["Administrator", "Manager", "Employee"] },
        isDeleted: { $ne: true },
        "immigrationDetails.visaValidTo": targetDate
    }).lean()

    for(const employee of employees){
        const email = employee?.personalDetails?.email
        if(!email) continue

        let mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Visa Expiry Reminder',
            html: `
                <h2>Reminder for visa expired soon</h2>
                <p>Hello ${employee?.personalDetails?.firstName} ${employee?.personalDetails?.lastName},</p>
                <p>Your visa will expire on <b>${targetDate}</b>. Please renew it as soon as possible.</p>
                <p>Best Regards,<br>HRMS Team</p>
            `
        }
        transporter.sendMail(mailOptions)

        await Notification.create({
            // userName: `${employee?.personalDetails?.firstName} ${employee?.personalDetails?.lastName} (You)`,
            userId: _id,
            notifiedId: [_id],
            type: 'Visa Expiry Reminder',
            message: `Your visa will expire on <b>${targetDate}</b>. Please renew it as soon as possible.`,
            readBy: [{ userId: _id, role: employee?.role }]
        })
    }
}
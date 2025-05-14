const moment = require('moment')
const User = require('../models/user')
const Timesheet = require('../models/timeSheet')
const Leave = require('../models/leaveRequest')
const Holiday = require('../models/holiday')
const Notification = require('../models/notification')
const { transporter } = require("../utils/nodeMailer")
const Client = require('../models/client')

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
                        <p>Best Regards,<br>City Clean London Team</p>
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
        const { _id, companyId, jobDetails } = employee

        const isHoliday = await Holiday.exists({ date: today, companyId, isDeleted: { $ne: true } })
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
                        <p>Best Regards,<br>City Clean London Team</p>
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
                        <p>Best Regards,<br>City Clean London Team</p>
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
                <p>Best Regards,<br>City Clean London Team</p>
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

exports.generateClientReport = async () => {
    try {
        // Calculate the previous month's start and end dates in GMT
        const now = moment.tz('GMT')
        const startDate = now.clone().subtract(1, 'month').startOf('month').toDate()
        const endDate = now.clone().subtract(1, 'month').endOf('month').toDate()

        // Fetch all active clients
        const clients = await Client.find({ isDeleted: { $ne: true } })

        for (const client of clients) {
            const clientId = client._id
            const companyId = client.companyId

            // Check if the company exists and is not deleted
            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if (!company) {
                console.log(`Company not found for client ID: ${clientId}`)
                continue
            }

            // Check for existing reports overlapping the desired date range
            const existingReport = await EmployeeReport.findOne({
                clientId,
                companyId,
                isDeleted: { $ne: true },
                $or: [
                    {
                        startDate: { $lte: endDate },
                        endDate: { $gte: startDate },
                    },
                ],
            })

            if (existingReport) {
                console.log(`Report already exists for client ID: ${clientId} in the given date range.`)
                continue
            }

            // Fetch users associated with the company
            const users = await User.find({ companyId, isDeleted: { $ne: true } })

            // Filter employees assigned to the client and not working from office
            let filteredEmployees = []
            users.forEach((user) => {
                user.jobDetails.forEach((job) => {
                    if (!job.isWorkFromOffice) {
                        job.assignClient.forEach((assignedClientId) => {
                            if (assignedClientId.toString() === clientId.toString()) {
                                filteredEmployees.push({
                                    userId: user._id,
                                    jobId: job._id,
                                    jobTitle: job.jobTitle,
                                    jobRole: job.role,
                                })
                            }
                        })
                    }
                })
            })

            // Create a new report
            const newReport = await EmployeeReport.create({
                clientId,
                companyId,
                startDate,
                endDate,
                employees: filteredEmployees,
                creatorId: null, // Since this is automated, no specific creator
            })

            // Generate token and link for each client email
            const emailLinks = client.email.map((email) => {
                const token = jwt.sign(
                    {
                        clientId,
                        companyId,
                        startDate,
                        endDate,
                        reportId: newReport._id,
                        email,
                        role: 'Client',
                    },
                    process.env.JWT_SECRET
                )

                const link = `${process.env.FRONTEND_URL}/employeestimesheet?token=${token}`
                return { email, link, token }
            })

            // Update the report with the generated links
            newReport.links = emailLinks
            await newReport.save()

            // Send emails to each client email
            for (const { email, link } of emailLinks) {
                const mailOptions = {
                    from: process.env.NODEMAILER_EMAIL,
                    to: email,
                    subject: 'Employee Timesheet Report',
                    html: `
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
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${link}" style="display: inline-block; padding: 12px 25px; font-size: 16px; color: #ffffff; background-color: #28a745; text-decoration: none; border-radius: 5px;">
                                View Report List
                                </a>
                            </div>
                            <p style="font-size: 14px; color: #777777;">
                                <strong>Note:</strong> Please ensure that you review and take the necessary action on each report.
                            </p>
                            </div>
                        </div>
                        </div>
                    `,
                }

                await transporter.sendMail(mailOptions)
            }
            console.log(`Report generated and emails sent for client ID: ${clientId}`)
        }
    } catch (error) {
        console.error('Error occurred during cron job execution:', error)
    }
}
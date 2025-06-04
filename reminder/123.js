const moment = require("moment");

exports.clockInOutReminder = async (type, today) => {
    try {
        const allEmployees = await User.find({
            role: { $in: ["Administrator", "Manager", "Employee"] },
            isDeleted: { $ne: true }
        }).lean();

        const now = moment(); // current time (cron call time)

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (const employee of allEmployees) {
            const { _id, companyId, jobDetails } = employee;

            const isHoliday = await Holiday.exists({ date: today, companyId, isDeleted: { $ne: true } });
            if (isHoliday) continue;

            for (const job of jobDetails) {
                const { _id: jobId, isWorkFromOffice, location: locationId, assignClient = [] } = job;

                let tasks = [];

                if (isWorkFromOffice) {
                    // Get task by location
                    tasks = await Task.find({
                        date: today,
                        locationId,
                        jobId,
                        userId: _id,
                        isDeleted: { $ne: true }
                    });
                } else {
                    // Get tasks for each assigned client
                    for (const clientId of assignClient) {
                        const clientTasks = await Task.find({
                            date: today,
                            clientId,
                            jobId,
                            userId: _id,
                            isDeleted: { $ne: true }
                        });
                        tasks = [...tasks, ...clientTasks];
                    }
                }

                if (!tasks.length) continue; // No tasks, no reminder

                // Check leave
                const isOnLeave = await Leave.exists({
                    userId: _id,
                    jobId: jobId,
                    date: today,
                    status: 'Approved'
                });
                if (isOnLeave) continue;

                // Check timesheet
                const timesheet = await Timesheet.findOne({ userId: _id, jobId, date: today, isDeleted: { $ne: true } });

                let hasClockIn = false;
                let hasMissingClockOut = false;
                let isTimerOn = false;

                if (timesheet && timesheet.clockinTime.length > 0) {
                    hasClockIn = true;

                    const lastEntry = timesheet.clockinTime[timesheet.clockinTime.length - 1];
                    if (!lastEntry.clockOut) {
                        hasMissingClockOut = true;
                        isTimerOn = timesheet.isTimerOn;
                    }
                }

                // Loop through tasks to check if reminder should be sent based on task start time + 10 mins
                for (const task of tasks) {
                    const taskStart = moment(`${task.date} ${task.startTime}`, "YYYY-MM-DD HH:mm");
                    const reminderTime = taskStart.clone().add(10, "minutes");

                    if (now.isBefore(reminderTime)) continue; // skip if it's not yet time for reminder

                    // Clock-In Reminder
                    if (type === 'clock-in' && !hasClockIn) {
                        await sendReminder({
                            email: employee?.personalDetails?.email,
                            subject: 'Missing Clock-in Reminder',
                            message: `You haven't clocked in today for <b>${job?.jobTitle}</b> Role.`,
                            userId: _id,
                            jobTitle: job?.jobTitle,
                            role: employee?.role,
                            type: 'Clock-in Reminder'
                        });
                        await delay(1000);
                        break; // send only one reminder per employee/job
                    }

                    // Clock-Out Reminder
                    if (type === 'clock-out' && hasMissingClockOut && isTimerOn) {
                        await sendReminder({
                            email: employee?.personalDetails?.email,
                            subject: 'Missing Clock-out Reminder',
                            message: `You haven't clocked out yet for <b>${job?.jobTitle}</b> Role.`,
                            userId: _id,
                            jobTitle: job?.jobTitle,
                            role: employee?.role,
                            type: 'Clock-out Reminder'
                        });
                        await delay(1000);
                        break; // send only one reminder per employee/job
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error occurred while clocks in/out reminder:', error);
    }
}

// 🔁 Helper function to send mail and create notification
async function sendReminder({ email, subject, message, userId, jobTitle, role, type }) {
    const mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: email,
        subject,
        html: `
            <h2>${subject}</h2>
            <p>${message}</p>
            <p>Best Regards,<br>City Clean London Team</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            if (error.code == 'EENVELOPE') {
                console.warn('Invalid email address:', email);
            } else {
                console.error(`Error while sending ${type} reminder:`, error);
            }
        }
        if (info) {
            console.log(`✅ ${type} reminder sent to: ${email}`);
        }
    });

    await Notification.create({
        userId,
        notifiedId: [userId],
        type,
        message,
        readBy: [{ userId, role }]
    });
}

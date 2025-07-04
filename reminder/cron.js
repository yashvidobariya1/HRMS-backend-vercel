const cron = require('node-cron')
const moment = require('moment')
const { leaveActionReminder, clockInOutReminder, visaExpiryReminder, autoGenerateClientReport } = require("./cronFunctionality")

// ┌──────── Minute (0 - 59)
// │ ┌────── Hour (0 - 23) → 9 AM
// │ │ ┌──── Day of Month (1 - 31)
// │ │ │ ┌── Month (1 - 12)
// │ │ │ │ ┌─ Day of Week (0 - 6) (Sunday = 0 or 7)
// │ │ │ │ │
// 0 9 * * *  command-to-run

// leave action reminder (09:00 AM)
cron.schedule('0 9 * * *', async () => {
    const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD')
    await leaveActionReminder(tomorrow)
    console.log(`✅ Reminder sent for action required on pending Leave Request.`)
}, {
    timezone: "Europe/London" // Adjust timezone as needed
})

// Clock-In Reminder (9:10 AM)
// cron.schedule('10 9 * * *', async () => {
// Every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    try {
        const today = moment().format('YYYY-MM-DD')
        await clockInOutReminder('clock-in', today)
        console.log("✅ Reminder sent for missing clock-in.")
    } catch (error) {
        console.error('Error occurred while sending reminder of clock-IN:', error)
    }
}, {
    timezone: "Europe/London" // Adjust timezone as needed
})

// Every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    const today = moment().format('YYYY-MM-DD')
    await clockInOutReminder('clock-out', today)
    console.log("✅ Reminder sent for missing clock-out.")
}, {
    timezone: "Europe/London" // Adjust timezone as needed
})

// leave action reminder (08:00 AM)
cron.schedule('* 8 * * *', async () => {
    const today = moment().startOf('day').format('YYYY-MM-DD')
    const afterTenDaysDate = moment().add(10, 'days').startOf('day').format('YYYY-MM-DD')
    await visaExpiryReminder(today, afterTenDaysDate)
    console.log("✅ Reminder sent for visa expired in next 10 days.")
}, {
    timezone: "Europe/London" // Adjust timezone as needed
})

// auto generate report every 30 min
cron.schedule('*/30 * * * *', async () => {
    // console.log('call auto generate report')
    await autoGenerateClientReport()
    console.log("✅ Clients report generate successfully.")
}, {
    timezone: "Europe/London" // Adjust timezone as needed
})
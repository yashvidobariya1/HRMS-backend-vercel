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

// cron.schedule('0 9 * * *', async () => {
//     const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD')
//     await leaveActionReminder(tomorrow)
//     console.log(`✅ Reminder sent for action required on pending Leave Request.`)
// }, {
//     // timezone: "Europe/London" // Adjust timezone as needed
// })

// // Clock-In Reminder (9:10 AM)
// cron.schedule('10 9 * * *', async () => {
//     const today = moment().format('YYYY-MM-DD')
//     await clockInOutReminder('clock-in', today)
//     console.log("✅ Reminder sent for missing clock-in.")
// }, {
//     // timezone: "Europe/London" // Adjust timezone as needed
// })

// // Clock-Out Reminder (6:10 PM)
// cron.schedule('10 18 * * *', async () => {
//     const today = moment().format('YYYY-MM-DD')
//     await clockInOutReminder('clock-out', today)
//     console.log("✅ Reminder sent for missing clock-out.")
// }, {
//     // timezone: "Europe/London" // Adjust timezone as needed
// })

cron.schedule('* 9 * * *', async () => {
    const today = moment().startOf('day').format('YYYY-MM-DD')
    const afterTenDaysDate = moment().add(10, 'days').startOf('day').format('YYYY-MM-DD')
    await visaExpiryReminder(today, afterTenDaysDate)
    console.log("✅ Reminder sent for visa expired in next 10 days.")
}, {
    // timezone: "Europe/London" // Adjust timezone as needed
})

cron.schedule('* * * * *', async () => {
    console.log('call auto generate report')
    await autoGenerateClientReport()
    console.log("✅ Clients report generate successfully.")
}, {
    // timezone: "Europe/London" // Adjust timezone as needed
})
const cron = require('node-cron')
const moment = require('moment')
const { leaveActionReminder, clockInOutReminder } = require("./cronFunctionality")

// ┌──────── Minute (0 - 59)
// │ ┌────── Hour (0 - 23) → 9 AM
// │ │ ┌──── Day of Month (1 - 31)
// │ │ │ ┌── Month (1 - 12)
// │ │ │ │ ┌─ Day of Week (0 - 6) (Sunday = 0 or 7)
// │ │ │ │ │
// 0 9 * * *  command-to-run

cron.schedule('* * * * * *', async () => {
    const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD')
    await leaveActionReminder(tomorrow)
    console.log(`✅ Reminder sent for action required on pending Leave Request.`)
})

// Clock-In Reminder (9:10 AM)
// cron.schedule('10 9 * * *', async () => {
//     await clockInOutReminder('clock-in')
//     console.log("✅ Reminder sent for missing clock-in.")
// })

// // Clock-Out Reminder (6:10 PM)
// cron.schedule('10 18 * * *', async () => {
//     await clockInOutReminder('clock-out')
//     console.log("✅ Reminder sent for missing clock-out.")
// })
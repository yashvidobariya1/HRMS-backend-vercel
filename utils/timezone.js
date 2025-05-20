const momentTimeZone = require('moment-timezone')

exports.convertToEuropeanTimezone = (date) => {
    return momentTimeZone(date).tz('Europe/London')
}
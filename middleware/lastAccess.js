const User = require("../models/user")
const moment = require('moment')


exports.lastAccess = async (req, res, next) => {
    try {
        const userId = req.user._id
        await User.findByIdAndUpdate(userId, { lastTimeAccess: moment().toDate() })
        next()
    } catch (error) {
        console.error('Error occurred while updating access time:', error)
        res.send({ message: 'Error occurred while updating access time!' })
    }
}
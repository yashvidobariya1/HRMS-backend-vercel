require('dotenv').config({path:"config/config.env"})
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = process.env


exports.auth = async (req, res, next) => {
    try {
        const token = req?.header('Authorization')?.replace('Bearer ', '') || ""
        let manager

        const decoded = jwt.verify(token, JWT_SECRET)
        manager = await Manager.findOne({ _id: decoded._id, token: token })

        if (!manager) {
            throw new Error("User not found or token is invalid")
        }
        req.token = token
        req.user = manager
        next()                  
    } catch (error) {
        console.log('Error:', error)
        throw new Error("Invalid or expired token")
    }
}
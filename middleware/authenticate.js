require('dotenv').config({path:"config/config.env"})
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const { JWT_SECRET } = process.env


exports.auth = async (req, res, next) => {
    try {
        const token = req?.header('Authorization')?.replace('Bearer ', '') || ""
        let user

        const decoded = jwt.verify(token, JWT_SECRET)
        user = await User.findOne({ _id: decoded._id, token: token })

        if (!user) {
            throw new Error("User not found or token is invalid")
        }
        req.token = token
        req.user = user
        next()                  
    } catch (error) {
        console.log('Error:', error)
        throw new Error("Invalid or expired token")
    }
}

// exports.roleAuthorization = (allowedRoles) => {
//     return (req, res, next) => {
//         const userRole = req.user.role;
//         if (!allowedRoles.includes(userRole)) {
//             return res.status(403).json({ message: "Access denied" });
//         }
//         next();
//     };
// };
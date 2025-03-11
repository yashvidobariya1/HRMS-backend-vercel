require('dotenv').config({path:"config/config.env"})
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const moment = require('moment');

const { JWT_SECRET } = process.env


exports.auth = async (req, res, next) => {
    try {
        const token = req.headers?.authorization?.replace('Bearer ', '')

        if(!token){
            return res.send({ status: 401, message: "Unauthorized: Invalid API key" });
        }

        const decoded = jwt.verify(token, JWT_SECRET)
        if (decoded.role !== "Client") {
            const user = await User.findOne({ _id: decoded._id, token: token })
    
            if (!user) {
                throw new Error("User not found or token is invalid")
            }
            req.user = user
        }
        req.token = decoded
        next()                  
    } catch (error) {
        console.error("Error occurred while authenticate:", error);
        res.send({ message: "Invalid or expiry token!" })
    }
}
// exports.auth = (allowedRoles) => {
//     return (req, res, next) => {
//         const apiKey = req.headers["x-api-key"];
    
//         if (!apiKey || !users[apiKey]) {
//             return res.send({ status: 401, message: "Unauthorized: Invalid API key" });
//         }
    
//         const userRole = users[apiKey].role;
    
//         if (!allowedRoles.includes(userRole)) {
//             return res.send({ status: 403, message: "Forbidden: Access denied" });
//         }
    
//         req.user = { apiKey, role: userRole };
//         next();
//     };
// }

// exports.roleAuthorization = (allowedRoles) => {
//     return (req, res, next) => {
//         const userRole = req.user.role;
//         if (!allowedRoles.includes(userRole)) {
//             return res.status(403).json({ message: "Access denied" });
//         }
//         next();
//     };
// };
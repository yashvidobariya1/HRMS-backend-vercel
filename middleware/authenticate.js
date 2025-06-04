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
            const user = await User.findOneAndUpdate(
                { _id: decoded._id, token: token }, 
                { lastTimeAccess: moment().toDate() },
                { new: true, select: '_id personalDetails companyId locationId role' }
            )
            // const user = await User.findOne({ _id: decoded._id, token })
    
            if (!user) {
                throw new Error("User not found or token is invalid")
            }
            // user.lastTimeAccess = moment().toDate()
            // await user.save()
            req.user = user
        }
        req.token = decoded
        next()                  
    } catch (error) {
        console.error("Error occurred while authenticate:", error);
        return res.send({ status: 5000, message: "Your session has expired. Please log in again!" })
    }
}

// exports.auth = async (req, res, next) => {
//     try {
//         const token = req.headers?.authorization?.replace("Bearer ", "");
//         if (!token) {
//             return res.status(401).json({ message: "Unauthorized: No token provided" });
//         }
    
//         const decoded = jwt.verify(token, JWT_SECRET);
    
//         if (decoded.role !== "Client") {
//             const user = await User.findOne({ _id: decoded._id, token });
    
//             if (!user) {
//                 return res.status(401).json({ message: "User not found or token is invalid" });
//             }
    
//             user.lastTimeAccess = moment().toDate();
//             await user.save();
    
//             req.user = user;
//         }
    
//         req.token = decoded;
//         next();
//     } catch (error) {
//         console.error("Error occurred while authenticate:", error.message);
//         return res.status(401).json({ message: "Your session has expired. Please log in again!" });
//     }
// };

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
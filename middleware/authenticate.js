require('dotenv').config({path:"config/config.env"})
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const { JWT_SECRET } = process.env


exports.auth = async (req, res, next) => {
    try {
        const token = req.headers?.authorization?.replace('Bearer ', '')
        let user

        if(!token){
            return res.send({ status: 401, message: "Unauthorized: Invalid API key" });
        }

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
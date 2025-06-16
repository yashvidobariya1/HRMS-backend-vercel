const LoginAudit = require('../models/loginAudit');
const User = require('../models/user');
const { convertToEuropeanTimezone } = require('../utils/timezone');

exports.getAllLoggedInOutUsers = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const timePeriod = req.query.timePeriod
            const searchQuery = req.query.search ? req.query.search.trim() : ''
            const companyId = req.query.companyId

            const skip = (page - 1) * limit

            let timeFilter = {}
            if (timePeriod) {
                const now = new Date()
                let filteredDate = null

                const match = timePeriod.match(/^(\d+)(hours|week|month)$/i)
                if (match) {
                    const value = parseInt(match[1])
                    const unit = match[2].toLowerCase()

                    switch(unit){
                        case 'hours':
                            filteredDate = new Date(now.setHours(now.getHours() - value));
                            break;
                        case 'week':
                            filteredDate = new Date(now.setDate(now.getDate() - value * 7));
                            break;
                        case 'month':
                            filteredDate = new Date(now.setMonth(now.getMonth() - value));
                            break;
                    }

                    if (filteredDate) {
                        timeFilter = { lastTimeLoggedIn: { $gte: filteredDate } }
                    }
                }
            }

            let baseQuery = { isDeleted: { $ne: true }, ...timeFilter }

            if(companyId && companyId !== 'allCompany'){
                baseQuery.companyId = companyId
            } else if(req.user.role !== 'Superadmin'){
                baseQuery.locationId = { $in: req.user.locationId }
                baseQuery.companyId = req.user.companyId
            }

            // if (req.user.role === 'Superadmin') {
            //     baseQuery.role = { $in: ["Administrator", "Manager", "Employee"] }
            // } else if (req.user.role === 'Administrator') {
            //     baseQuery.companyId = req.user.companyId
            //     // baseQuery.locationId = { $in: req.user.locationId }
            //     baseQuery.role = { $in: ["Manager", "Employee"] }
            // } else if(req.user.role === 'Manager') {
            //     baseQuery.jobDetails = { $elemMatch: { assignManager: req.user._id.toString() } }
            //     baseQuery.companyId = req.user.companyId
            //     // baseQuery.locationId = { $in: req.user.locationId }
            //     baseQuery.role = { $in: ["Employee"] }
            // }

            if (searchQuery) {
                baseQuery['$or'] = [
                    { role: { $regex: searchQuery, $options: "i" } },
                    { userName: { $regex: searchQuery, $options: 'i' } }
                ]
            }

            const users = await LoginAudit.find(baseQuery).populate('userId', 'personalDetails role').skip(skip).limit(limit)
            const formattedUsers = users.length > 0 ? users.map(user => ({
                _id: user._id,
                reason: user.reason || "",
                attemptTime: convertToEuropeanTimezone(user?.attemptTime).format("YYYY-MM-DD HH:mm:ss") || "",
                userName: `${user?.userId?.personalDetails?.lastName ? `${user?.userId?.personalDetails?.firstName} ${user?.userId?.personalDetails?.lastName}` : `${user?.userId?.personalDetails?.firstName}`}` || "",
                // lastTimeLoggedIn: convertToEuropeanTimezone(user?.lastTimeLoggedIn).format("YYYY-MM-DD HH:mm:ss") || "",
                lastTimeAccess: convertToEuropeanTimezone(user?.lastTimeAccess).format("YYYY-MM-DD HH:mm:ss") || "",
                status: user?.isLoggedIn,
                role: user?.userId?.role,
                browser: user?.browser || "",
                // clientIp: user?.userIPAddess || "",
            })) : []
            const totalUsers = await LoginAudit.find(baseQuery).countDocuments()

            return res.send({
                status: 200,
                message: 'Users fetched successfully.',
                users: formattedUsers.length > 0 ? formattedUsers : [],
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error occurred while fetching logged In/Out employees:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching logged In/Out employees!' })
    }
}

// exports.getAllLoggedInOutUsers = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
//         if (allowedRoles.includes(req.user.role)) {
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 50
//             const timePeriod = req.query.timePeriod
//             const searchQuery = req.query.search ? req.query.search.trim() : ''
//             const companyId = req.query.companyId

//             const skip = (page - 1) * limit

//             let timeFilter = {}
//             if (timePeriod) {
//                 const now = new Date()
//                 let filteredDate = null

//                 const timeRegex = /^(\d+)(hours|week|month)$/i
//                 const match = timePeriod.match(timeRegex)

//                 if (match) {
//                     const value = parseInt(match[1])
//                     const unit = match[2].toLowerCase()

//                     switch(unit){
//                         case 'hours':
//                             filteredDate = new Date(now.setHours(now.getHours() - value));
//                             break;
//                         case 'week':
//                             filteredDate = new Date(now.setDate(now.getDate() - value * 7));
//                             break;
//                         case 'month':
//                             filteredDate = new Date(now.setMonth(now.getMonth() - value));
//                             break;
//                     }

//                     if (filteredDate) {
//                         timeFilter = { lastTimeLoggedIn: { $gte: filteredDate } }
//                     }
//                 }
//             }

//             let baseQuery = { isDeleted: { $ne: true }, ...timeFilter }

//             if(companyId && companyId !== 'allCompany'){
//                 baseQuery.companyId = companyId
//             } else if(req.user.role !== 'Superadmin'){
//                 baseQuery.locationId = { $in: req.user.locationId }
//                 baseQuery.companyId = req.user.companyId
//             }

//             if (req.user.role === 'Superadmin') {
//                 baseQuery.role = { $in: ["Administrator", "Manager", "Employee"] }
//             } else if (req.user.role === 'Administrator') {
//                 baseQuery.companyId = req.user.companyId
//                 // baseQuery.locationId = { $in: req.user.locationId }
//                 baseQuery.role = { $in: ["Manager", "Employee"] }
//             } else if(req.user.role === 'Manager') {
//                 baseQuery.jobDetails = { $elemMatch: { assignManager: req.user._id.toString() } }
//                 baseQuery.companyId = req.user.companyId
//                 // baseQuery.locationId = { $in: req.user.locationId }
//                 baseQuery.role = { $in: ["Employee"] }
//             }

//             if (searchQuery) {
//                 baseQuery['$or'] = [
//                     { role: { $regex: searchQuery, $options: "i" } },
//                     { userName: { $regex: searchQuery, $options: 'i' } }
//                 ]
//             }

//             const users = await User.find(baseQuery).skip(skip).limit(limit)
//             const formattedUsers = users.length > 0 ? users.map(user => ({
//                 _id: user._id,
//                 userName: `${user?.personalDetails?.lastName ? `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}` : `${user?.personalDetails?.firstName}`}` || "",
//                 lastTimeLoggedIn: convertToEuropeanTimezone(user?.lastTimeLoggedIn).format("YYYY-MM-DD HH:mm:ss") || "",
//                 lastTimeAccess: convertToEuropeanTimezone(user?.lastTimeAccess).format("YYYY-MM-DD HH:mm:ss") || "",
//                 status: user?.isLoggedIn || "",
//                 role: user?.role,
//                 browser: user?.usedBrowser || "",
//                 clientIp: user?.userIPAddess || "",
//             })) : []
//             const totalUsers = await User.find(baseQuery).countDocuments()

//             return res.send({
//                 status: 200,
//                 message: 'Users fetched successfully.',
//                 users: formattedUsers.length > 0 ? formattedUsers : [],
//                 totalUsers,
//                 totalPages: Math.ceil(totalUsers / limit) || 1,
//                 currentPage: page || 1
//             })
//         } else return res.send({ status: 403, message: "Access denied" })
//     } catch (error) {
//         console.error('Error occurred while fetching logged In/Out employees:', error)
//         return res.send({ status: 500, message: 'Error occurred while fetching logged In/Out employees!' })
//     }
// }
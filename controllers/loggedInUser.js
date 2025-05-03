const User = require('../models/user')

exports.getAllLoggedInOutUsers = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const timePeriod = parseInt(req.query.timePeriod)
            const searchQuery = req.query.search ? req.query.search.trim() : ''
            const companyId = req.query.companyId

            const skip = (page - 1) * limit

            let timeFilter = {}
            if (timePeriod) {
                const filteredHour = new Date()
                filteredHour.setHours(filteredHour.getHours() - timePeriod)
                timeFilter = { lastTimeLoggedIn: { $gte: filteredHour } }
            }

            let baseQuery = { isDeleted: { $ne: true }, ...timeFilter }

            if(req.user.role === 'Superadmin' && companyId && companyId !== 'allCompany'){
                baseQuery.companyId = companyId
            } else if(req.user.role !== 'Superadmin'){
                baseQuery.locationId = { $in: req.user.locationId }
                baseQuery.companyId = req.user.companyId
            }

            if (req.user.role === 'Superadmin') {
                baseQuery.role = { $in: ["Administrator", "Manager", "Employee"] }
            } else if (req.user.role === 'Administrator') {
                // baseQuery.companyId = req.user.companyId
                // baseQuery.locationId = { $in: req.user.locationId }
                baseQuery.role = { $in: ["Manager", "Employee"] }
            } else if(req.user.role === 'Manager') {
                // baseQuery.jobDetails = { $elemMatch: { assignManager: req.user._id.toString() } }
                // baseQuery.companyId = req.user.companyId
                // baseQuery.locationId = { $in: req.user.locationId }
                baseQuery.role = { $in: ["Employee"] }
            }

            if (searchQuery) {
                baseQuery['$or'] = [
                    { userName: { $regex: searchQuery, $options: 'i' } }
                ]
            }

            const users = await User.find(baseQuery).skip(skip).limit(limit)
            const formattedUsers = users.length > 0 ? users.map(user => ({
                _id: user._id,
                userName: `${user?.personalDetails?.lastName ? `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}` : `${user?.personalDetails?.firstName}`}` || "",
                lastTimeLoggedIn: user?.lastTimeLoggedIn || "",
                lastTimeAccess: user?.lastTimeAccess || "",
                status: user?.isLoggedIn || "",
                role: user?.role,
                browser: user?.usedBrowser || "",
                clientIp: user?.userIPAddess || "",
            })) : []
            const totalUsers = await User.find(baseQuery).countDocuments()

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
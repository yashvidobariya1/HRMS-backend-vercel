const Notification = require("../models/notification");
const { default: mongoose } = require("mongoose");
const User = require("../models/user");
const moment = require("moment");

// exports.getNotifications = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
//         if(allowedRoles.includes(req.user.role)){
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 10

//             const skip = (page - 1) * limit
//             const userId = new mongoose.Types.ObjectId(String(req.user._id))

//             const projection = req.user.role === "Superadmin" ? {} : { companyId: 1 }
//             const existingUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).select(projection)

//             if (!existingUser) {
//                 return res.send({ status: 404, message: "User not found" })
//             }

//             let matchStage = { "readBy.userId": userId }

//             let pipeline = [
//                 {
//                     $lookup: {
//                         from: "users",
//                         localField: "userId",
//                         foreignField: "_id",
//                         as: "user"
//                     }
//                 },
//                 { $unwind: "$user" },
//                 { $match: matchStage },
//                 { $sort: { createdAt: -1 } },
//                 {
//                     $addFields: {
//                         isRead: {
//                             $max: {
//                                 $map: {
//                                     input: {
//                                         $filter: {
//                                             input: "$readBy",
//                                             as: "item",
//                                             cond: { $eq: ["$$item.userId", userId] }
//                                         }
//                                     },
//                                     as: "match",
//                                     in: "$$match.isRead"
//                                 }
//                             }
//                         }
//                     }
//                 },
//                 {
//                     $facet: {
//                         paginatedResults: [
//                             { $skip: skip },
//                             { $limit: limit },
//                             {
//                                 $project: {
//                                     userId: 1,
//                                     userName: 1,
//                                     notifiedId: 1,
//                                     type: 1,
//                                     message: 1,
//                                     readBy: 1,
//                                     createdAt: 1,
//                                     updatedAt: 1,
//                                     isRead: 1
//                                 }
//                             }
//                         ],
//                         totalUnread: [
//                             { 
//                                 $match: { 
//                                     ...matchStage, 
//                                     "readBy.isRead": false 
//                                 } 
//                             },
//                             { $count: "unreadNotificationsCount" }
//                         ],
//                         totalCount: [{ $count: "total" }]
//                     }
//                 }
//             ]

//             const [result] = await Notification.aggregate(pipeline)
            
//             const notifications = result.paginatedResults || []
//             const totalNotifications = result.totalCount.length > 0 ? result.totalCount[0].total : 0
//             const unreadNotificationsCount = result.totalUnread.length > 0 ? result.totalUnread[0].unreadNotificationsCount : 0

//             res.send({
//                 status: 200,
//                 message: 'Notifications fetched successfully.',
//                 unreadNotificationsCount,
//                 notifications,
//                 totalNotifications,
//                 totalPages: Math.ceil(totalNotifications / limit) || 1,
//                 currentPage: page || 1
//             })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error("Error occurred while fetching notifications:", error)
//         res.send({ message: "Error occurred while fetching notifications!" }) 
//     }
// }

exports.getNotifications = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit

            const userId = req.user._id

            const existingUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    
            if (!existingUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            let matchStage = {
                "readBy": {
                    $elemMatch: {
                        userId: new mongoose.Types.ObjectId(String(userId))
                    }
                }
            }
            // console.log('matchStage', matchStage)

            let pipeline = [
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: "$user" },
                { $match: matchStage },
                { $sort: { createdAt: -1 } },
                {
                    $addFields: {
                        userName: {
                            $concat: ["$user.personalDetails.firstName", " ", "$user.personalDetails.lastName"] 
                        },
                        isRead: {
                            $max: {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: "$readBy",
                                            as: "item",
                                            cond: { 
                                                $eq: ["$$item.userId", new mongoose.Types.ObjectId(String(userId))] 
                                            }
                                        }
                                    },
                                    as: "match",
                                    in: "$$match.isRead"
                                }
                            }
                        }
                    }
                },
            ]

            if (searchQuery) {
                const regex = new RegExp(searchQuery.replace(/[-\s]/g, "[-\\s]*"), "i")
                pipeline.push({
                    $match: {
                        userName: { $regex: regex }
                    }
                })
            }

            pipeline.push(
                {
                    $project: {
                        userId: 1,
                        userName: 1,
                        notifiedId: 1,
                        type: 1,
                        message: 1,
                        readBy: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        isRead: 1
                    }
                }
            )

            const notifications = await Notification.aggregate([...pipeline]).skip(skip).limit(limit)

            const totalNotificationsResult = await Notification.aggregate([...pipeline, { $count: "total" }])
            const totalNotifications = totalNotificationsResult.length > 0 ? totalNotificationsResult[0].total : 0;

            let unreadNotificationsCount = 0
            const unreadNotifications = await Notification.aggregate([
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: "$user" },
                { 
                    $match: {
                        ...matchStage,
                        readBy: {
                            $elemMatch: {
                                userId: new mongoose.Types.ObjectId(String(userId)),
                                isRead: false,
                            }
                        }
                    }
                },
                { $count: 'unreadNotificationsCount' }
            ])

            unreadNotificationsCount = unreadNotifications.length > 0 ? unreadNotifications[0].unreadNotificationsCount : 0

            res.send({
                status: 200,
                message: 'Notifications fetched successfully.',
                unreadNotificationsCount,
                notifications,
                totalNotifications,
                totalPages: Math.ceil(totalNotifications / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error("Error occurred while fetching notifications:", error)
        res.send({ message: "Error occurred while fetching notifications!" }) 
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
    //     if(allowedRoles.includes(req.user.role)){
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 10

    //         const skip = (page - 1) * limit

    //         const userId = req.user._id

    //         let matchStage = {}

    //         if (req.user.role === "Superadmin") {
    //             const existingUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    
    //             if (!existingUser) {
    //                 return res.send({ status: 404, message: "User not found" })
    //             }
    //             matchStage = {
    //                 "readBy": {
    //                     $elemMatch: {
    //                         userId: new mongoose.Types.ObjectId(String(userId))
    //                     }
    //                 }
    //             }
    //         } else {
    //             const existingUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    
    //             if (!existingUser) {
    //                 return res.send({ status: 404, message: "User not found" })
    //             }
    
    //             if (req.user.role === "Administrator") {
    //                 matchStage = {
    //                     "readBy": {
    //                         $elemMatch: {
    //                             userId: new mongoose.Types.ObjectId(String(userId))
    //                         }
    //                     }
    //                 }
    //             } else if(req.user.role === "Manager") {
    //                 matchStage = {
    //                     "readBy": {
    //                         $elemMatch: {
    //                             userId: new mongoose.Types.ObjectId(String(userId))
    //                         }
    //                     }
    //                 }
    //             } else if(req.user.role === 'Employee') {
    //                 matchStage = {
    //                     // "notifiedId": userId,
    //                     "readBy": {
    //                         $elemMatch: {
    //                             userId: new mongoose.Types.ObjectId(String(userId))
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //         // console.log('matchStage', matchStage)

    //         let pipeline = [
    //             {
    //                 $lookup: {
    //                     from: "users",
    //                     localField: "userId",
    //                     foreignField: "_id",
    //                     as: "user"
    //                 }
    //             },
    //             { $unwind: "$user" },
    //             { $match: matchStage },
    //             { $sort: { createdAt: -1 } },
    //             {
    //                 $addFields: {
    //                     userName: {
    //                         $concat: ["$user.personalDetails.firstName", " ", "$user.personalDetails.lastName"] 
    //                     },
    //                     isRead: {
    //                         $max: {
    //                             $map: {
    //                                 input: {
    //                                     $filter: {
    //                                         input: "$readBy",
    //                                         as: "item",
    //                                         cond: { 
    //                                             $eq: ["$$item.userId", new mongoose.Types.ObjectId(String(userId))] 
    //                                         }
    //                                     }
    //                                 },
    //                                 as: "match",
    //                                 in: "$$match.isRead"
    //                             }
    //                         }
    //                     }
    //                 }
    //             },
    //             {
    //                 $project: {
    //                     userId: 1,
    //                     userName: 1,
    //                     notifiedId: 1,
    //                     type: 1,
    //                     message: 1,
    //                     readBy: 1,
    //                     createdAt: 1,
    //                     updatedAt: 1,
    //                     isRead: 1
    //                 }
    //             }
    //         ]

    //         const notifications = await Notification.aggregate(pipeline).skip(skip).limit(limit)

    //         const totalNotificationsResult = await Notification.aggregate([...pipeline, { $count: "total" }])
    //         const totalNotifications = totalNotificationsResult.length > 0 ? totalNotificationsResult[0].total : 0;

    //         let unreadNotificationsCount = 0
    //         const unreadNotifications = await Notification.aggregate([
    //             {
    //                 $lookup: {
    //                     from: "users",
    //                     localField: "userId",
    //                     foreignField: "_id",
    //                     as: "user"
    //                 }
    //             },
    //             { $unwind: "$user" },
    //             { 
    //                 $match: {
    //                     ...matchStage,
    //                     readBy: {
    //                         $elemMatch: {
    //                             userId: new mongoose.Types.ObjectId(String(userId)),
    //                             isRead: false,
    //                         }
    //                     }
    //                 }
    //             },
    //             { $count: 'unreadNotificationsCount' }
    //         ])

    //         unreadNotificationsCount = unreadNotifications.length > 0 ? unreadNotifications[0].unreadNotificationsCount : 0

    //         res.send({
    //             status: 200,
    //             message: 'Notifications fetched successfully.',
    //             unreadNotificationsCount,
    //             notifications,
    //             totalNotifications,
    //             totalPages: Math.ceil(totalNotifications / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error("Error occurred while fetching notifications:", error)
    //     res.send({ message: "Error occurred while fetching notifications!" }) 
    // }
}

exports.getUnreadNotificationsCount = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.user._id
            let matchStage = {}
    
            // if (req.user.role === "Superadmin") {
            //     matchStage = {}
            // } else {
                const existingUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).select("companyId")
    
                if (!existingUser) {
                    return res.send({ status: 404, message: "User not found" })
                }
    
                if (req.user.role === "Administrator") {
                    matchStage = { "user.companyId": existingUser.companyId }
                } else if (req.user.role === "Manager") {
                    matchStage = {
                        "user.companyId": existingUser.companyId,
                        "user.role": 'Employee',
                        "user.jobDetails": {
                            $elemMatch: {
                                "assignManager": userId.toString(),
                            }
                        }
                    }
                } else if(req.user.role === 'Employee') {
                    matchStage = {
                        "notifiedId": userId
                    }
                }
            // }
            // console.log('matchStage', matchStage)           
    
            const unreadNotifications = await Notification.aggregate([
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: "$user" },
                { 
                    $match: {
                        ...matchStage,
                        readBy: {
                            $elemMatch: {
                                userId: userId.toString(),
                                isRead: false,
                            }
                        }
                    }
                },
                { $sort: { createdAt: -1 } },
                {
                    $count: 'unreadNotificationsCount'
                }
            ])
            // console.log('unreadNotifications/...', unreadNotifications)

            let count = unreadNotifications.length > 0 ? unreadNotifications[0].unreadNotificationsCount : 0
    
            res.send({ status: 200, count })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error("Error occurred while fetching notifications count:", error)
        res.send({ message: "Error occurred while fetching notifications count!" })
    }
}

exports.getNotification = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const notificationId = req.params.id
            const notification = await Notification.findOne({ _id: notificationId, isDeleted: { $ne: true } })
            if(!notification){
                return res.send({ status: 404, message: 'Notification not found.' })
            }
            // console.log('notification', notification)
            res.send({ status: 200, notification })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching notification:', error)
        res.send({ message: 'Error occurred while fetching notification!' })
    }
}

exports.readNotification = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const notificationId = req.params.id

            const notification = await Notification.findOne({ _id: notificationId, isDeleted: { $ne: true } })
            if(!notification){
                return res.send({ status: 404, message: 'Notification not found' })
            }
            
            notification?.readBy.map((item) => {
                if(item.userId.toString() === req.user._id.toString()){
                    // console.log('notification read by ' + item.role)
                    item.isRead = true
                    item.readAt = moment().toDate()
                }
                // console.log('item:', item)
            })
            // console.log('notification:', notification)
            await notification.save()

            return res.send({ status: 200, notification })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while reading notification:', error)
        res.send('Error occurred while reading notification')
    }
}
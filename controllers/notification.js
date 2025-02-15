const Notification = require("../models/notification");
const { default: mongoose } = require("mongoose");
const User = require("../models/user");
const moment = require("moment");

// manager or administrator : get all their notifications pending work
// exports.getNotifications = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
//         if (allowedRoles.includes(req.user.role)) {
//             let notifiedId = req.params.id
//             let companyId = req.query.companyId
//             let locationId = req.query.locationId
//             // console.log(notifiedId);

//             if (!notifiedId || notifiedId == 'undefined' || notifiedId == 'null') {
//                 return res.send({ status: 404, message: 'Notification not found' })
//             }

//             let notifications = await Notification.aggregate([
//                 {
//                     $lookup: {
//                         from: "users",
//                         localField: "userId",
//                         foreignField: "_id",
//                         as: "user_id",
//                     },
//                 }, {
//                     $unwind: "$user_id"
//                 }, {
//                     // $match: {
//                     //     "user_id.isDeleted": false,
//                     //     notifiedId,
//                     //     companyId,
//                     //     locationId,
//                     // }
//                     $match: {
//                         "user_id.isDeleted": false,
//                         notifiedId: new mongoose.Types.ObjectId(notifiedId),
//                         ...(companyId && { "user_id.companyId": new mongoose.Types.ObjectId(companyId) }),
//                         ...(locationId && { "user_id.locationId": new mongoose.Types.ObjectId(locationId) }),
//                     }
//                 },
//                 {
//                     $project: {
//                         "user._id": "$user_id._id",
//                         "user.firstName": "$user_id.personalDetails.firstName",
//                         "user.middleName": "$user_id.personalDetails.middleName",
//                         "user.lastName": "$user_id.personalDetails.lastName",
//                         "notifiedId": "$user_id.creatorId",
//                         "notifiedRole": "$user_id.createdBy",
//                         type: 1,
//                         message: 1,
//                         isRead: 1,
//                         createdAt: 1,
//                         updatedAt: 1
//                     }
//                 },
//                 {
//                     $sort: { createdAt: -1 }
//                 },
//             ]);
//             // console.log("notifications", notifications);

//             const notificationIds = notifications.map((notification) => notification._id);
//             if (notificationIds.length > 0) {
//                 await Notification.updateMany(
//                     { _id: { $in: notificationIds } },
//                     { $set: { isRead: true } }
//                 );
//             }

//             res.send({ status: 200, message: "Notification get successfully.", notifications });
//         } else return res.send({ status: 403, message: "Access denied" })
//     } catch (error) {
//         console.error('Error fetching notifications:', error);
//         res.status(500).send({ message: 'Error fetching notifications' });
//     }
// };

// exports.getUnreadNotificationsCount = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
//         if (allowedRoles.includes(req.user.role)) {
//             const notifiedId = req.params.id;
//             const companyId = req.query.companyId;
//             const locationId = req.query.locationId;

//             if (!notifiedId || notifiedId == 'undefined' || notifiedId == 'null') {
//                 return res.send({ status: 404, message: 'Notification not found' })
//             }

//             const unreadCount = await Notification.aggregate([
//                 {
//                     $lookup: {
//                         from: "users",
//                         localField: "userId",
//                         foreignField: "_id",
//                         as: "user_id",
//                     },
//                 },
//                 {
//                     $unwind: "$user_id"
//                 },
//                 {
//                     $match: {
//                         "user_id.isDeleted": false,
//                         notifiedId: new mongoose.Types.ObjectId(notifiedId),
//                         isRead: false,
//                         ...(companyId && { "user_id.companyId": new mongoose.Types.ObjectId(companyId) }),
//                         ...(locationId && { "user_id.locationId": new mongoose.Types.ObjectId(locationId) }),
//                     }
//                 },
//                 {
//                     $count: "unreadCount"
//                 }
//             ]);

//             const count = unreadCount.length > 0 ? unreadCount[0].unreadCount : 0;

//             res.send({ status: 200, message: "New NotificationCount get successfully.", unreadCount: count });
//         } else {
//             return res.send({ status: 403, message: "Access denied" });
//         }
//     } catch (error) {
//         console.error("Error fetching unread notifications count:", error);
//         res.status(500).send({ message: "Error fetching unread notifications count" });
//     }
// };

exports.getNotifications = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            const userId = req.user._id

            let matchStage = {}
            let useMatchStage = true

            if (req.user.role === "Superadmin") {
                const existingUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    
                if (!existingUser) {
                    return res.send({ status: 404, message: "User not found" })
                }
                useMatchStage = false
            } else {
                const existingUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).select("companyId")
    
                if (!existingUser) {
                    return res.send({ status: 404, message: "User not found" })
                }
    
                if (req.user.role === "Administrator") {
                    matchStage = {
                        "user.companyId": existingUser.companyId,
                        "readBy": {
                            $elemMatch: {
                                userId: new mongoose.Types.ObjectId(String(userId))
                            }
                        }
                    }
                } else if(req.user.role === "Manager") {
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
                { $unwind: "$user" }
            ]

            if (useMatchStage) {
                pipeline.push({ $match: matchStage })
            }

            pipeline.push(
                { $sort: { createdAt: -1 } },
                {
                    $addFields: {
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

            const notifications = await Notification.aggregate(pipeline).skip(skip).limit(limit)

            const totalNotificationsResult = await Notification.aggregate([...pipeline, { $count: "total" }])
            const totalNotifications = totalNotificationsResult.length > 0 ? totalNotificationsResult[0].total : 0;

            let unreadNotificationsCount = 0
            if (useMatchStage) {
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
            } else {
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
            }

            res.send({
                status: 200,
                message: 'All notifications getted successfully.',
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
        console.error("Error occurred while fetching notifications:", error)
        res.send({ message: "Error occurred while fetching notifications!" })
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
        console.error('Error occurred while getting notification:', error)
        res.send({ message: 'Error occurred while getting notification!' })
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
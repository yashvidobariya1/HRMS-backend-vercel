const Notification = require("../models/notification");
const { default: mongoose } = require("mongoose");
const User = require("../models/user");

// manager or administartor : get all their notifications pending work
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

exports.getNotifications = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.user._id
            let matchStage = {}
    
            if (req.user.role === "Superadmin") {
                matchStage = {}
            } else {
                const existingUser = await User.findById(userId).select("companyId")
    
                if (!existingUser) {
                    return res.status(404).json({ message: "User not found" })
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
                }
            }
            console.log('matchStage', matchStage)

           
    
            const notifications = await Notification.aggregate([
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
                    $project: {
                        userId: 1,
                        notifiedId: 1,
                        type: 1,
                        message: 1,
                        isRead: 1,
                        createdAt: 1,
                        updatedAt: 1
                    }
                }
            ])
    
            res.json(notifications)
        } else return res.send({ status: 403, messgae: 'Access denied' })
    } catch (error) {
        console.error("Error fetching notifications:", error)
        res.status(500).json({ message: "Internal Server Error" })
    }
}

exports.getUnreadNotificationsCount = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const notifiedId = req.params.id;
            const companyId = req.query.companyId;
            const locationId = req.query.locationId;

            if (!notifiedId || notifiedId == 'undefined' || notifiedId == 'null') {
                return res.send({ status: 404, message: 'Notification not found' })
            }

            const unreadCount = await Notification.aggregate([
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user_id",
                    },
                },
                {
                    $unwind: "$user_id"
                },
                {
                    $match: {
                        "user_id.isDeleted": false,
                        notifiedId: new mongoose.Types.ObjectId(notifiedId),
                        isRead: false,
                        ...(companyId && { "user_id.companyId": new mongoose.Types.ObjectId(companyId) }),
                        ...(locationId && { "user_id.locationId": new mongoose.Types.ObjectId(locationId) }),
                    }
                },
                {
                    $count: "unreadCount"
                }
            ]);

            const count = unreadCount.length > 0 ? unreadCount[0].unreadCount : 0;

            res.send({ status: 200, message: "New NotificationCount get successfully.", unreadCount: count });
        } else {
            return res.send({ status: 403, message: "Access denied" });
        }
    } catch (error) {
        console.error("Error fetching unread notifications count:", error);
        res.status(500).send({ message: "Error fetching unread notifications count" });
    }
};
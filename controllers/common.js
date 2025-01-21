const User = require("../models/user");
const bcrypt = require("bcrypt");
const { transporter } = require("../utils/nodeMailer");
const cloudinary = require('../utils/cloudinary');
const Notification = require("../models/notification");
const { default: mongoose } = require("mongoose");

exports.login = async (req, res) => {
    try {
        if (!req.body.email || !req.body.password) {
            return res.send({ status: 400, message: "Email and password are required" });
        }

        const isExist = await User.findOne({ "personalDetails.email": req.body.email, isDeleted: false });

        if (!isExist) {
            return res.send({ status: 404, message: "User not found" });
        }

        const token = await isExist.generateAuthToken()
        isExist.token = token
        isExist.save()

        const personalDetails = isExist?.personalDetails
        const role = isExist?.role
        const createdAt = isExist?.createdAt
        const _id = isExist?._id

        if (isExist.password == req.body.password) {
            return res.send({
                status: 200,
                message: "User login successfully",
                user: { personalDetails, role, token, createdAt, _id },
            });
        } else {
            const hashedPassword = isExist.password;
            bcrypt.compare(req.body.password, hashedPassword, async (err, result) => {
                if (err) {
                    console.error("Error comparing passwords:", err);
                    return res.send({ status: 500, message: "Internal server error" });
                }
                if (!result) {
                    return res.send({ status: 404, message: "Invalid credential" });
                }
                return res.send({
                    status: 200,
                    message: "User login successfully",
                    user: { personalDetails, role, token, createdAt, _id },
                });
            });
        }
    } catch (error) {
        console.error("Error occurred while logging in:", error);
        res.send({ message: "Something went wrong while login!" })
    }
};

exports.emailVerification = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.send({ status: 400, message: "Please enter valid email address." })
        }

        const findUser = await User.findOne({ "personalDetails.email": email })
        if (!findUser) {
            return res.send({ status: 404, message: "User not found." })
        }

        const otp = Math.floor(100000 + Math.random() * 900000)
        findUser.otp = otp
        await findUser.save()

        if (otp) {
            let mailOptions = {
                from: process.env.NODEMAILER_EMAIL,
                to: findUser.personalDetails.email,
                subject: "HRMS: Password recovery",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="text-align: center; color: #4CAF50;">OTP Verification</h2>
                        <p>Dear ${findUser.personalDetails.firstName},</p>
                        <p>We received a request to verify your email address. Please use the OTP below to complete the verification process:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <span style="font-size: 24px; font-weight: bold; color: #333; padding: 10px 20px; background-color: #f4f4f4; border-radius: 5px; display: inline-block;">
                                ${otp}
                            </span>
                        </div>
                        <p style="text-align: center;">This OTP is valid for the next 10 minutes.</p>
                        <p>If you did not request this verification, please ignore this email or contact support if you have concerns.</p>
                        <hr style="border: none; border-top: 1px solid #ddd;">
                        <p style="font-size: 12px; color: #888; text-align: center;">
                            This is an automated message. Please do not reply.
                        </p>
                    </div>
                `,
            }

            await transporter.sendMail(mailOptions, (error, info) => {
                if (info) {
                    console.log("Email sent successfully:", info.response);
                }
            });

            return res.send({ status: 200, message: otp })
        } else {
            return res.send({ status: 400, message: "OTP not generated." })
        }
    } catch (error) {
        console.error("Error occurred while email verification:", error);
        res.send({ message: "Something went wrong while email verification!" })
    }
}

exports.otpVerification = async (req, res) => {
    try {
        const { email, otp } = req.body
        const findUser = await User.findOne({ "personalDetails.email": email, isDeleted: false })
        if (findUser) {
            if (findUser.otp === otp) {
                return res.send({ status: 200, message: "OTP verified successfully." })
            } else {
                return res.send({ status: 409, message: "Invalid OTP." })
            }
        } else {
            return res.send({ status: 404, message: "User not found." })
        }
    } catch (error) {
        console.error("Error occurred while OTP verification:", error);
        res.send({ message: "Something went wrong while OTP verification!" })
    }
}

exports.forgotPassword = async (req, res) => {
    try {

        const { email, newPassword, confirmPassword } = req.body
        const user = await User.findOne({
            "personalDetails.email": email,
            isDeleted: false
        })
        if (!user) {
            return res.send({ status: 404, message: "User not found" })
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/
        if (!passwordRegex.test(newPassword)) {
            return res.send({
                "status": 401,
                "message": "Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long."
            })
        }

        if (newPassword !== confirmPassword) {
            return res.send({ status: 400, message: "New password and confirm password do not match." })
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.password = hashedPassword
        await user.save()
        res.send({ status: 200, message: "Password updated successfully." })
    } catch (error) {
        console.error("Error occurred while forgot password:", error);
        res.send({ message: "Something went wrong while forgot password!" })
    }
}

exports.updatePassword = async (req, res) => {
    try {
        const { userId, oldPassword, newPassword, confirmPassword } = req.body

        const user = await User.findOne({ _id: userId, isDeleted: false })
        if (!user) {
            return res.send({ status: 404, message: "User not found." })
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password)
        if (!isMatch) {
            return res.send({ status: 400, message: "Old password is incorrect." })
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/
        if (!passwordRegex.test(newPassword)) {
            return res.send({
                "status": 401,
                "message": "Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long."
            })
        }

        if (newPassword !== confirmPassword) {
            return res.send({ status: 400, message: "New password and confirm password do not match." })
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)

        user.password = hashedPassword;
        await user.save()

        return res.send({ status: 200, message: "Password updated successfully." })
    } catch (error) {
        console.error("Error occurred while updating password:", error);
        res.send({ message: "Something went wrong while updating password!" })
    }
}

exports.getDetails = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const userId = req.user._id
            const user = await User.findOne({
                _id: userId,
                isDeleted: { $ne: true },
            })
            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }
            return res.send({ status: 200, user })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting details:", error);
        res.send({ message: "Something went wrong while getting details!" })
    }
}

exports.addUser = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            let {
                personalDetails,
                addressDetails,
                kinDetails,
                financialDetails,
                jobDetails,
                companyId,
                locationId,
                immigrationDetails,
                documentDetails,
                contractDetails
            } = req.body

            if (personalDetails && personalDetails.email) {
                const user = await User.findOne({ "personalDetails.email": personalDetails.email })
                if (user) {
                    return res.send({ status: 409, message: "Email already exists." });
                }
            }

            let documentDetailsFile
            if (documentDetails && Array.isArray(documentDetails)) {
                for (let i = 0; i < documentDetails.length; i++) {
                    const document = documentDetails[i].document;

                    if (!document || typeof document !== 'string') {
                        console.log(`Invalid or missing document for item ${i}`)
                    }
                    try {
                        let element = await cloudinary.uploader.upload(document, {
                            resource_type: "auto",
                            folder: "contracts",
                        });
                        // console.log('Cloudinary response:', element);
                        documentDetailsFile = {
                            fileId: element.public_id,
                            fileURL: element.secure_url,
                            fileName: documentDetails.fileName,
                        };
                    } catch (uploadError) {
                        console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                        return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                    }
                }
            }

            let contractDetailsFile
            if (contractDetails && Array.isArray(contractDetails)) {
                const document = contractDetails.contractDocument
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing contract document')
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "contracts",
                    });
                    // console.log('Cloudinary response:', element);
                    contractDetailsFile = {
                        fileId: element.public_id,
                        fileURL: element.secure_url,
                        fileName: contractDetails.fileName,
                    };
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const generatePass = () => {
                const fname = `${personalDetails.firstName}`
                const capitalizeWords = (username) => username.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                const formatName = capitalizeWords(fname)
                const uname = formatName[0]
                // console.log('uname', uname)
                const lastFourDigits = personalDetails.phone.slice(-4)
                // console.log('lastFourDigits', lastFourDigits)
                const pass = `${uname}@${lastFourDigits}`
                // console.log('pass', pass)
                return pass
            }

            const pass = generatePass()
            const hashedPassword = await bcrypt.hash(pass, 10)

            const newUser = {
                personalDetails,
                addressDetails,
                kinDetails,
                financialDetails,
                jobDetails,
                companyId,
                locationId,
                immigrationDetails,
                role: jobDetails[0]?.role,
                password: hashedPassword,
                documentDetails: documentDetailsFile,
                contractDetails: contractDetailsFile,
                createdBy: req.user.role,
                creatorId: req.user._id,
            }
            if (personalDetails.sendRegistrationLink == true) {
                try {
                    let mailOptions = {
                        from: process.env.NODEMAILER_EMAIL,
                        to: newUser.personalDetails.email,
                        subject: "Welcome to [Company Name]'s HRMS Portal",
                        html: `
                            <p>Welcome to HRMS Portal!</p>

                            <p>We are pleased to inform you that a new ${jobDetails.role} account has been successfully created by the Manager under your supervision in the HRMS portal. Below are the details:</p>

                            <ul>
                                <li><b>Name:</b> ${personalDetails.firstName} ${personalDetails.lastName}</li>
                                <li><b>Email:</b> ${personalDetails.email}</li>
                                <li><b>Position:</b> ${jobDetails[0].jobTitle}</li>
                                <li><b>Joining Date:</b> ${jobDetails[0].joiningDate}</li>
                            </ul>

                            <p>Please ensure the ${jobDetails.role} logs into the HRMS portal using their temporary credentials and updates their password promptly. Here are the login details for their reference:</p>

                            <ul>
                                <li><b>HRMS Portal Link:</b> <a href="https://example.com">HRMS Portal</a></li>
                                <li><b>Username/Email:</b> ${personalDetails.email}</li>
                                <li><b>Temporary Password:</b> ${generatePass()}</li>
                            </ul>

                            <p>If you have any questions or need further assistance, feel free to reach out to the HR manager or HR department.</p>

                            <p>Looking forward to your journey with us!</p>

                            <p>Best regards,<br>HRMS Team</p>
                        `,
                    };

                    await transporter.sendMail(mailOptions);
                    console.log('Email sent successfully');
                } catch (error) {
                    console.log('Error occurred:', error);
                }
            }
            // console.log('new user', newUser)
            const user = await User.create(newUser)

            return res.send({ status: 200, message: `${jobDetails.role} created successfully.`, user })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while adding user:", error);
        res.send({ message: "Something went wrong while adding user!" })
    }
}

exports.getUser = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const userId = req.params.id

            if (!userId || userId == 'undefined' || userId == 'null') {
                return res.send({ status: 404, message: 'User not found' })
            }

            const user = await User.findOne({
                _id: userId,
                isDeleted: { $ne: true },
            });

            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }

            return res.send({ status: 200, message: 'User get successfully.', user })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting user:", error);
        res.send({ message: "Something went wrong while getting user!" })
    }
}

exports.getAllUsers = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const users = await User.find({ isDeleted: { $ne: true } })

            return res.send({ status: 200, message: 'Users get successfully.', users })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting users:", error);
        res.send({ message: "Something went wrong while getting users!" })
    }
}

exports.updateUserDetails = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const userId = req.params.id

            const user = await User.findOne({
                _id: userId,
                isDeleted: { $ne: true }
            });

            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }

            let {
                personalDetails,
                addressDetails,
                kinDetails,
                financialDetails,
                jobDetails,
                immigrationDetails,
                documentDetails,
                contractDetails,
            } = req.body

            if (personalDetails.email && user.personalDetails.email != personalDetails.email) {
                const existingEmail = await User.findOne({ "personalDetails.email": personalDetails.email })
                if (existingEmail) {
                    return res.send({ status: 409, message: "Email already exists." });
                }
            }

            let documentDetailsFile
            if (documentDetails && Array.isArray(documentDetails)) {
                for (let i = 0; i < documentDetails.length; i++) {
                    const document = documentDetails[i].document;

                    if (!document || typeof document !== 'string') {
                        console.log(`Invalid or missing document for item ${i}`)
                    }
                    try {
                        let element = await cloudinary.uploader.upload(document, {
                            resource_type: "auto",
                            folder: "contracts",
                        });
                        // console.log('Cloudinary response:', element);
                        documentDetailsFile = {
                            fileId: element.public_id,
                            fileURL: element.secure_url,
                            fileName: documentDetails.fileName,
                        };
                    } catch (uploadError) {
                        console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                        return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                    }
                }
            }

            let contractDetailsFile
            if (contractDetails && Array.isArray(contractDetails)) {
                const document = contractDetails.contractDocument
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing contract document')
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "contracts",
                    });
                    // console.log('Cloudinary response:', element);
                    contractDetailsFile = {
                        fileId: element.public_id,
                        fileURL: element.secure_url,
                        fileName: contractDetails.fileName,
                    };
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            let updatedUser = await User.findByIdAndUpdate(
                { _id: userId },
                {
                    $set: {
                        personalDetails,
                        addressDetails,
                        kinDetails,
                        financialDetails,
                        jobDetails,
                        immigrationDetails,
                        documentDetails: documentDetailsFile,
                        contractDetails: contractDetailsFile,
                        updatedAt: new Date()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: `${jobDetails.role} details updated successfully.`, updatedUser })

        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while updating user details:", error);
        res.send({ message: "Something went wrong while updating user details!" })
    }
}

exports.deleteUserDetails = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const userId = req.params.id

            const user = await User.findOne({
                _id: userId,
                isDeleted: { $ne: true },
            });
            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }

            let deletedUser = await User.findByIdAndUpdate(userId, {
                $set: {
                    isDeleted: true,
                    canceledAt: new Date()
                }
            })

            return res.send({ status: 200, message: 'User deleted successfully.', deletedUser })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing user:", error);
        res.send({ message: "Something went wrong while removing user!" })
    }
}

exports.getNotifications = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            let notifiedId = req.params.id
            let companyId = req.query.companyId
            let locationId = req.query.locationId
            // console.log(notifiedId);

            if (!notifiedId || notifiedId == 'undefined' || notifiedId == 'null') {
                return res.send({ status: 404, message: 'Notification not found' })
            }

            let notifications = await Notification.aggregate([
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user_id",
                    },
                }, {
                    $unwind: "$user_id"
                }, {
                    $match: {
                        "user_id.isDeleted": false,
                        notifiedId: new mongoose.Types.ObjectId(notifiedId),
                        ...(companyId && { "user_id.companyId": new mongoose.Types.ObjectId(companyId) }),
                        ...(locationId && { "user_id.locationId": new mongoose.Types.ObjectId(locationId) }),
                    }
                },
                {
                    $project: {
                        "user._id": "$user_id._id",
                        "user.firstName": "$user_id.personalDetails.firstName",
                        "user.middleName": "$user_id.personalDetails.middleName",
                        "user.lastName": "$user_id.personalDetails.lastName",
                        "notifiedId": "$user_id.creatorId",
                        "notifiedRole": "$user_id.createdBy",
                        type: 1,
                        message: 1,
                        isRead: 1,
                        createdAt: 1,
                        updatedAt: 1
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
            ]);
            // console.log("notifications", notifications);

            const notificationIds = notifications.map((notification) => notification._id);
            if (notificationIds.length > 0) {
                await Notification.updateMany(
                    { _id: { $in: notificationIds } },
                    { $set: { isRead: true } }
                );
            }

            res.send({ status: 200, message: "Notification get successfully.", notifications });
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).send({ message: 'Error fetching notifications' });
    }
};

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
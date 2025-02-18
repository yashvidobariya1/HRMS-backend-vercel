const User = require("../models/user");
const bcrypt = require("bcrypt");
const { transporter } = require("../utils/nodeMailer");
const cloudinary = require('../utils/cloudinary');
const Location = require("../models/location");
const moment = require('moment')
// const CryptoJS = require("crypto-js")

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
        // isExist.token = token.JWTToken
        isExist.save()

        const personalDetails = isExist?.personalDetails
        const role = isExist?.role
        const createdAt = isExist?.createdAt
        const _id = isExist?._id

        if (isExist.password == req.body.password) {
            isExist.lastTimeLoggedIn = moment().toDate()
            return res.send({
                status: 200,
                message: "User login successfully",
                user: { personalDetails, role, token, createdAt, _id },
                // user: { personalDetails, role, token: token.encrypted_token, createdAt, _id },
            });
        } else {
            const hashedPassword = isExist.password;
            bcrypt.compare(req.body.password, hashedPassword, async (err, result) => {
                if (err) {
                    console.error("Error comparing passwords:", err);
                    return res.send({ status: 500, message: "Internal server error" });
                }
                if (!result) {
                    return res.send({ status: 401, message: "Invalid credential" });
                }
                isExist.lastTimeLoggedIn = moment().toDate()
                return res.send({
                    status: 200,
                    message: "User login successfully",
                    user: { personalDetails, role, token, createdAt, _id },
                    // user: { personalDetails, role, token: token.encrypted_token, createdAt, _id },
                });
            });
        }
    } catch (error) {
        console.error("Error occurred while logging in:", error);
        res.send({ message: "Something went wrong while login!" })
    }
};

exports.logOut = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.user._id

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            existUser.token = ""
            existUser.lastTimeLoggedOut = moment().toDate()
            await existUser.save()
            return res.send({ status: 200, message: 'Logging out successfully.' })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while logging out:', error)
        res.send({ message: 'Error occurred while logging out!' })
    }
}

// Backend developer use only
exports.decodeJWTtoken = async (req, res) => {
    // try {
    //     const { token } = req.body

    //     const bytes = CryptoJS.AES.decrypt(token, process.env.ENCRYPTION_SECRET_KEY)

    //     const decryptToken = bytes.toString(CryptoJS.enc.Utf8)

    //     return res.send({ status: 200, message: 'Decode successfully', decryptToken })

    // } catch (error) {
    //     console.error('Error occurred while decoding token:', error)
    //     res.send({ message: 'Error occurred while decoding token!' })
    // }
}

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

exports.updateProfileDetails = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.user._id

            const {
                firstName,
                middleName,
                lastName,
                dateOfBirth,
                gender,
                maritalStatus,
                phone,
                homeTelephone,
                email,
            } = req.body

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            const updatedUser = await User.findByIdAndUpdate(
                { _id: user._id, isDeleted: { $ne: true } },
                {
                    $set: {
                        personalDetails: {
                            firstName,
                            middleName,
                            lastName,
                            dateOfBirth,
                            gender,
                            maritalStatus,
                            phone,
                            homeTelephone,
                            email,
                            niNumber: user?.personalDetails?.niNumber,
                            sendRegistrationLink: user?.personalDetails?.sendRegistrationLink,
                        },
                        addressDetails: user?.addressDetails,
                        kinDetails: user?.kinDetails,
                        financialDetails: user?.financialDetails,
                        immigrationDetails: user?.immigrationDetails,
                        jobDetails: user?.jobDetails,
                        documentDetails: user?.documentDetails,
                        contractDetails: user?.contractDetails,
                    }
                }, { new: true }
            )

            let uUser = {
                firstName: updatedUser?.personalDetails?.firstName,
                middleName: updatedUser?.personalDetails?.middleName,
                lastName: updatedUser?.personalDetails?.lastName,
                dateOfBirth: updatedUser?.personalDetails?.dateOfBirth,
                gender: updatedUser?.personalDetails?.gender,
                maritalStatus: updatedUser?.personalDetails?.maritalStatus,
                phone: updatedUser?.personalDetails?.phone,
                homeTelephone: updatedUser?.personalDetails?.homeTelephone,
                email: updatedUser?.personalDetails?.email,
            }

            return res.send({ status:200, message: 'Profile updated successfully.', updatedUser: uUser })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating profile details:', error)
        res.send({ message: 'Error occurred while updating profile details!' })
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
                // companyId,
                // locationId,
                immigrationDetails,
                documentDetails,
                contractDetails
            } = req.body

            // const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            // if(!company){
            //     return res.send({ status: 404, message: 'Company not found' })
            // }

            // const allCompanysEmployees = await User.find({ companyId, isDeleted: { $ne: false } }).countDocuments()
            // console.log('allCompanysEmployees:', allCompanysEmployees)
            // console.log('company?.contractDetails?.maxEmployeesAllowed:', company?.contractDetails?.maxEmployeesAllowed)
            // if(allCompanysEmployees > company?.contractDetails?.maxEmployeesAllowed){
            //     return res.send({ status: 409, message: 'Maximum employee limit reached. Cannot add more employees.' })
            // }

            if (personalDetails && personalDetails.email) {
                const user = await User.findOne({ "personalDetails.email": personalDetails.email })
                if (user) {
                    return res.send({ status: 409, message: "Email already exists." });
                }
            }

            let locationIds = []
            if(jobDetails){
                jobDetails.forEach(JD => {
                    locationIds.push(JD.location)
                })
            }

            let documentDetailsFile = []
            if (documentDetails && Array.isArray(documentDetails)) {
                for (let i = 0; i < documentDetails.length; i++) {
                    const gettedDocument = documentDetails[i].document;

                    if (!gettedDocument || typeof gettedDocument !== 'string') {
                        console.log(`Invalid or missing document for item ${i}`)
                    }
                    try {
                        let element = await cloudinary.uploader.upload(gettedDocument, {
                            resource_type: "auto",
                            folder: "userDocuments",
                        });
                        // console.log('Cloudinary response:', element);
                        documentDetailsFile.push({
                            documentType: documentDetails[i].documentType,
                            documentName: documentDetails[i].documentName,
                            document: element.secure_url
                        })
                    } catch (uploadError) {
                        console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                        return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                    }
                }
            }

            let contractDetailsFile
            if (contractDetails?.contractDocument) {
                const document = contractDetails.contractDocument
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing contract document')
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "userContracts",
                    });
                    // console.log('Cloudinary response:', element);
                    contractDetailsFile = {
                        contractType: contractDetails.contractType,
                        contractDocument: {
                            fileURL: element.secure_url,
                            fileName: contractDetails.fileName,
                        }
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

            let companyId
            const locationId = jobDetails[0]?.location
            const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
            companyId = location?.companyId

            const newUser = {
                personalDetails,
                addressDetails,
                kinDetails,
                financialDetails,
                jobDetails,
                companyId,
                locationId: locationIds,
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
                    // console.log('Email sent successfully');
                } catch (error) {
                    console.log('Error occurred:', error);
                }
            }
            // console.log('new user', newUser)
            const user = await User.create(newUser)

            return res.send({ status: 200, message: `${user.role} created successfully.`, user })
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
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            let users
            let totalUsers

            if(req.user.role === 'Superadmin'){
                users = await User.find({ role: { $in: ["Administrator", "Manager", "Employee"] }, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalUsers = await User.find({ role: { $in: ["Administrator", "Manager", "Employee"] }, isDeleted: { $ne: true } }).countDocuments()
            } else if(req.user.role === 'Administrator') {
                users = await User.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, role: { $in: ["Manager", "Employee"] }, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalUsers = await User.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, role: { $in: ["Manager", "Employee"] }, isDeleted: { $ne: true } }).countDocuments()
            } else {
                users = await User.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, role: { $in: ["Employee"] }, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalUsers = await User.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, role: { $in: ["Employee"] }, isDeleted: { $ne: true } }).countDocuments()
            }

            return res.send({
                status: 200,
                message: 'Users got successfully.',
                users,
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit) || 1,
                currentPage: page || 1
            })
        } else {
            return res.send({ status: 403, message: "Access denied" })
        }
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

            let locationIds = []
            if(jobDetails){
                jobDetails.forEach(JD => {
                    locationIds.push(JD.location)
                })
            }

            let documentDetailsFile = []
            if (documentDetails && Array.isArray(documentDetails)) {
                for (let i = 0; i < documentDetails.length; i++) {
                    const gettedDocument = documentDetails[i].document;

                    if (!gettedDocument || typeof gettedDocument !== 'string') {
                        console.log(`Invalid or missing document for item ${i}`)
                    }
                    try {
                        if(gettedDocument.startsWith('data:')){
                            let element = await cloudinary.uploader.upload(gettedDocument, {
                                resource_type: "auto",
                                folder: "userDocuments",
                            });
                            // console.log('Cloudinary response:', element);
                            documentDetailsFile.push({
                                documentType: documentDetails[i].documentType,
                                documentName: documentDetails[i].documentName,
                                document: element.secure_url
                            })
                        } else {
                            documentDetailsFile.push({
                                documentType: documentDetails[i].documentType,
                                documentName: documentDetails[i].documentName,
                                document: gettedDocument
                            })
                        }
                    } catch (uploadError) {
                        console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                        return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                    }
                }
            }

            let contractDetailsFile
            if (contractDetails) {
                const document = contractDetails.contractDocument
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing contract document')
                }
                try {
                    if(document.startsWith('data:')){
                        let element = await cloudinary.uploader.upload(document, {
                            resource_type: "auto",
                            folder: "userContracts",
                        });
                        // console.log('Cloudinary response:', element);
                        contractDetailsFile = {
                            contractType: contractDetails.contractType,
                            contractDocument: {
                                fileURL: element.secure_url,
                                fileName: contractDetails.fileName,
                            }
                        };
                    } else {
                        contractDetailsFile = {
                            contractType: contractDetails.contractType,
                            contractDocument: {
                                fileURL: document,
                                fileName: contractDetails.fileName,
                            }
                        }
                    }
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
                        locationId: locationIds,
                        immigrationDetails,
                        documentDetails: documentDetailsFile,
                        contractDetails: contractDetailsFile,
                        updatedAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: `${updatedUser.role} details updated successfully.`, updatedUser })

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
                    canceledAt: moment().toDate()
                }
            })

            return res.send({ status: 200, message: `${deletedUser.role} deleted successfully.`, deletedUser })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing user:", error);
        res.send({ message: "Something went wrong while removing user!" })
    }
}

exports.getUserJobTitles = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const userId = req.query.EmployeeId || req.user._id
            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }
            const jobTitles = []
            user?.jobDetails.map((job) => {
                jobTitles.push({ jobId: job._id, jobName: job.jobTitle })
            })
            if(jobTitles.length > 1){
                res.send({ status: 200, message: 'User job titles get successfully.', multipleJobTitle: true, jobTitles })
            } else {
                res.send({ status: 200, message: 'User job titles get successfully.', multipleJobTitle: false, jobTitles })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while finding user job type:', error)
        res.send({ message: 'Error occurred while finding user role job type!' })
    }
}







// =================================================================pending work for generating the offer letter===========================================================

// const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
// const axios = require("axios");
// const pdf = require('pdf-parse');
// const puppeteer = require('puppeteer');
// const streamifier = require("streamifier");
// const Contract = require("../models/contract");
// const Company = require("../models/company");


// first method
// Utility: Fetch PDF from URL
async function fetchPDF(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
} 
// Utility: Extract text and replace placeholders
// async function replacePlaceholdersInPDF(pdfBytes, data) {
//     // Step 1: Extract text from PDF
//     const textContent = await pdfParse(pdfBytes);
//     console.log('textContent:', textContent);

//     // Step 2: Replace placeholders in text
//     let modifiedText = textContent.text;
//     Object.keys(data).forEach((key) => {
//         const placeholder = `{${key}}`; // Placeholder format: {name}, {position}, etc.
//         modifiedText = modifiedText.replace(new RegExp(placeholder, 'g'), data[key]);
//     });

//     // Step 3: Load the PDF with pdf-lib to modify content
//     const pdfDoc = await PDFDocument.load(pdfBytes);
//     const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

//     const pages = pdfDoc.getPages();

//     // Example: Replace placeholders on the first page
//     const page = pages[0];
//     const { width, height } = page.getSize();
//     page.drawText(modifiedText, {
//         x: 50,
//         y: height - 50,
//         font: helveticaFont,
//         size: 12,
//     });

//     // Serialize the updated PDF
//     const updatedPdfBytes = await pdfDoc.save();
//     return updatedPdfBytes;
// }
async function replacePlaceholdersInPDF(pdfBytes, data) {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();

    pages.forEach((page) => {
        const { width, height } = page.getSize();

        // Define placeholder positions
        const placeholders = [
            { key: 'name', placeholder: '{name}', x: 150, y: height - 100 },
            { key: 'email', placeholder: '{email}', x: 150, y: height - 120 },
            { key: 'position', placeholder: '{position}', x: 150, y: height - 140 },
            { key: 'joiningDate', placeholder: '{joiningDate}', x: 150, y: height - 160 },
            { key: 'company', placeholder: '{company}', x: 150, y: height - 180 },
        ];

        let adjustedY = height - 100; // Starting Y position

        placeholders.forEach(({ key, placeholder, x, y }) => {
            const value = data[key]; // Get the value for the placeholder

            if (value) {
                // Draw the updated text
                page.drawText(`${value}`, {
                    x,
                    y: adjustedY,
                    size: 12,
                    font: helveticaFont,
                    // color: rgb(0, 0, 0), // Black color
                });

                adjustedY -= 20; // Move to the next line
            }
        });
    });

    const updatedPdfBytes = await pdfDoc.save();
    return updatedPdfBytes;
}

// exports.generateOfferLetter = async (req, res) => {
//     try {
//         const { name, position, company, joiningDate, email, pdfUrl } = req.body;
    
//         if (!name || !position || !company || !joiningDate || !email || !pdfUrl) {
//             return res.status(400).send({ error: 'All fields are required!' });
//         }

//         // Step 1: Fetch PDF from URL
//         const pdfBytes = await fetchPDF(pdfUrl);

//         // Step 2: Replace placeholders in the PDF
//         const updatedPdfBytes = await replacePlaceholdersInPDF(pdfBytes, {
//             name,
//             position,
//             company,
//             joiningDate,
//         });

//         // Step 3: Save the updated PDF to a temporary file
//         const filePath = path.join(__dirname, 'generated-offer-letter.pdf');
//         fs.writeFileSync(filePath, updatedPdfBytes);

//         // Step 4: Send the updated PDF via email
//         const mailOptions = {
//             from: 'your-email@gmail.com',
//             to: email,
//             subject: 'Your Offer Letter',
//             text: `Dear ${name},\n\nPlease find your offer letter attached.`,
//             attachments: [{ filename: 'offer-letter.pdf', path: filePath }],
//         };
//         await transporter.sendMail(mailOptions);

//         // Cleanup: Remove the temporary file
//         fs.unlinkSync(filePath);
    
//         res.status(200).send({ message: 'Offer letter sent successfully!' });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Something went wrong!' });
//     }
// };








// secound method


const getContractById = async (contractId) => {
    
    const contract = await Contract.findOne({ _id: contractId, isDeleted: { $ne: true } })

    return {
        contractName: contract?.contractName,
        companyName: contract?.companyName,
        contractURL: contract?.contract?.fileURL,
    };
}



// exports.generateContractLetter = async (req, res) => {
//     try {
//         const { name, position, company, joiningDate, email, contractId } = req.body;
    
//         if (!name || !position || !company || !joiningDate || !email) {
//             return res.status(400).send({ error: 'All fields are required!' })
//         }

//         const gettedContract = await getContractById(contractId)
//         if(!gettedContract){
//             return res.send({ status: 404, message: 'Contract not found!' })
//         }
//         const cloudinaryUrl = gettedContract?.contractURL;
//         const response = await axios.get(cloudinaryUrl, { responseType: "arraybuffer" });
//         const content = response.data;

//         const data = await pdf(content);

//         // Generate HTML content
//         const htmlContent = `
//             <!DOCTYPE html>
//             <html lang="en">
//             <head>
//                 <meta charset="UTF-8">
//                 <meta name="viewport" content="width=device-width, initial-scale=1.0">
//                 <title>PDF to HTML</title>
//             </head>
//             <body>
//                 <pre>${data.text}</pre>
//             </body>
//             </html>
//         `;

//         fs.writeFileSync('contractLetter.html', htmlContent, 'utf8')

//         // const uploadToCloudinary = async (pdfBytes) => {
//         //     return new Promise((resolve, reject) => {
//         //         const uploadStream = cloudinary.uploader.upload_stream(
//         //             { resource_type: "auto", folder: "employeeContract" },
//         //             (error, result) => {
//         //                 if (error) reject(error);
//         //                 else resolve(result);
//         //             }
//         //         );
//         //         streamifier.createReadStream(pdfBytes).pipe(uploadStream);
//         //     });
//         // };

//         // const uploadResult = await uploadToCloudinary(pdfBytes)
//         // const generatedUrl = uploadResult.secure_url

//         return res.send({
//             status: 200,
//             message: 'Contract letter generated successfully for user.',
//             // employeeContractForm: generatedUrl
//         })
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Something went wrong!' });
//     }
// };


exports.generateContractLetterLLLLL = async (req, res) => {
    try {
        const { name, position, company, joiningDate, email, contractId } = req.body;

        // Validate input
        if (!name || !position || !company || !joiningDate || !email) {
            return res.status(400).send({ error: "All fields are required!" });
        }

        // Fetch contract by ID
        const gettedContract = await getContractById(contractId);
        if (!gettedContract) {
            return res.status(404).send({ message: "Contract not found!" });
        }

        // Fetch the PDF from Cloudinary
        const cloudinaryUrl = gettedContract?.contractURL;
        const response = await axios.get(cloudinaryUrl, { responseType: "arraybuffer" });
        const pdfBytes = response.data;

        // Load the existing PDF
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Embed a font for adding text
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Get the first page of the document
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        // Set the coordinates for where the new data will be placed
        const contentX = 50; // X coordinate
        let contentY = 700; // Starting Y coordinate

        // Add dynamic content to the PDF
        const lineHeight = 20; // Spacing between lines
        const content = [
            `Name: ${name}`,
            `Position: ${position}`,
            `Company: ${company}`,
            `Joining Date: ${joiningDate}`,
            `Email: ${email}`,
        ];

        // Draw each line of content
        content.forEach((line) => {
            firstPage.drawText(line, {
                x: contentX,
                y: contentY,
                size: 12,
                font: helveticaFont,
                color: rgb(0, 0, 0),
            });
            contentY -= lineHeight;
        });

        // Serialize the PDF to bytes
        const updatedPdfBytes = await pdfDoc.save();

        // Upload the updated PDF to Cloudinary
        const uploadToCloudinary = async (pdfBuffer) => {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: "auto", folder: "employeeContract" },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                streamifier.createReadStream(pdfBuffer).pipe(uploadStream);
            });
        };

        const uploadResult = await uploadToCloudinary(updatedPdfBytes);
        const generatedUrl = uploadResult.secure_url;

        return res.send({
            status: 200,
            message: "Contract letter generated and uploaded successfully.",
            employeeContractForm: generatedUrl,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Something went wrong!" });
    }
}

exports.generateContractLetter = async (req, res) => {
    try {
        const { name, position, company, joiningDate, email, contractId } = req.body;

        // Validate input
        if (!name || !position || !company || !joiningDate || !email) {
            return res.status(400).send({ error: "All fields are required!" });
        }

        // Fetch contract by ID
        const gettedContract = await getContractById(contractId);
        if (!gettedContract) {
            return res.status(404).send({ message: "Contract not found!" });
        }

        // Fetch the PDF from Cloudinary
        const cloudinaryUrl = gettedContract?.contractURL;
        const response = await axios.get(cloudinaryUrl, { responseType: "arraybuffer" });
        const pdfBytes = response.data;

        // Load the existing PDF
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Embed a font for adding text
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Get the first page of the document
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        // Set the coordinates for where the new data will be placed
        const contentX = 50; // X coordinate
        let contentY = 700; // Starting Y coordinate
        const lineHeight = 20; // Spacing between lines

        // Define the content to add
        const content = [
            `Name: ${name}`,
            `Position: ${position}`,
            `Company: ${company}`,
            `Joining Date: ${joiningDate}`,
            `Email: ${email}`,
        ];

        // Helper function to calculate font size dynamically
        const calculateFontSize = (text, maxWidth, font) => {
            let fontSize = 12; // Default size
            while (font.widthOfTextAtSize(text, fontSize) > maxWidth && fontSize > 6) {
                fontSize -= 1; // Decrease font size until it fits
            }
            return fontSize;
        };

        // Clear placeholder area and add text dynamically
        content.forEach((line) => {
            // Calculate font size to fit text
            const fontSize = calculateFontSize(line, 300, helveticaFont);

            // Clear the placeholder area
            firstPage.drawRectangle({
                x: contentX - 5,
                y: contentY - 5,
                width: 300,
                height: lineHeight,
                color: rgb(1, 1, 1), // White background
            });

            // Add the text
            firstPage.drawText(line, {
                x: contentX,
                y: contentY,
                size: fontSize,
                font: helveticaFont,
                color: rgb(0, 0, 0), // Black text
            });

            contentY -= lineHeight; // Move down for the next line
        });

        // Serialize the PDF to bytes
        const updatedPdfBytes = await pdfDoc.save();

        // Upload the updated PDF to Cloudinary
        const uploadToCloudinary = async (pdfBuffer) => {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: "auto", folder: "employeeContract" },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                streamifier.createReadStream(pdfBuffer).pipe(uploadStream);
            });
        };

        const uploadResult = await uploadToCloudinary(updatedPdfBytes);
        const generatedUrl = uploadResult.secure_url;

        return res.send({
            status: 200,
            message: "Contract letter generated and uploaded successfully.",
            employeeContractForm: generatedUrl,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Something went wrong!" });
    }
};

// with using puppeteer
// exports.generateContractLetter = async (req, res) => {
//     try {
//         const { name, position, company, joiningDate, email, contractId } = req.body;

//         if (!name || !position || !company || !joiningDate || !email) {
//             return res.status(400).send({ error: 'All fields are required!' });
//         }

//         const gettedContract = await getContractById(contractId);
//         if (!gettedContract) {
//             return res.status(404).send({ message: 'Contract not found!' });
//         }

//         const cloudinaryUrl = gettedContract?.contractURL;
//         const response = await axios.get(cloudinaryUrl, { responseType: "arraybuffer" });
//         const content = response.data;

//         const pdfData = await pdf(content);
//         console.log('pdfData:', pdfData)
//         let pdfText = pdfData.text;

//         pdfText = pdfText
//             .replace(/{name}/g, name)
//             .replace(/{email}/g, email)
//             .replace(/{position}/g, position)
//             .replace(/{joiningDate}/g, joiningDate)
//             .replace(/{company}/g, company);

//         const htmlContent = `
//             <!DOCTYPE html>
//             <html lang="en">
//             <head>
//                 <meta charset="UTF-8">
//                 <meta name="viewport" content="width=device-width, initial-scale=1.0">
//                 <title>Contract Letter</title>
//                 <style>
//                     body {
//                         font-family: Arial, sans-serif;
//                         line-height: 1.6;
//                         margin: 20px;
//                         padding: 0;
//                     }
//                     h1 {
//                         color: #333;
//                     }
//                     .content {
//                         border: 1px solid #ccc;
//                         padding: 20px;
//                         border-radius: 10px;
//                         background: #f9f9f9;
//                     }
//                 </style>
//             </head>
//             <body>
//                 <div class="content">
//                     <pre>${pdfText}</pre>
//                 </div>
//             </body>
//             </html>
//         `;

//         const browser = await puppeteer.launch();
//         const page = await browser.newPage();
//         await page.setContent(htmlContent, { waitUntil: 'load' });

//         const pdfBuffer = await page.pdf({ format: 'A4' });
//         await browser.close();

//         const uploadToCloudinary = async (pdfBuffer) => {
//             return new Promise((resolve, reject) => {
//                 const uploadStream = cloudinary.uploader.upload_stream(
//                     { resource_type: 'auto', folder: 'employeeContract' },
//                     (error, result) => {
//                         if (error) reject(error);
//                         else resolve(result);
//                     }
//                 );
//                 streamifier.createReadStream(pdfBuffer).pipe(uploadStream);
//             });
//         };

//         const uploadResult = await uploadToCloudinary(pdfBuffer);
//         const generatedUrl = uploadResult.secure_url;

//         return res.send({
//             status: 200,
//             message: 'Contract letter generated and uploaded successfully.',
//             employeeContractForm: generatedUrl,
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Something went wrong!' });
//     }
// }

// this function complete worked but text was overlapping
// exports.generateContractLetter = async (req, res) => {
//     try {
//         const { name, position, company, joiningDate, email, contractId } = req.body;
    
//         if (!name || !position || !company || !joiningDate || !email) {
//             return res.status(400).send({ error: 'All fields are required!' })
//         }

//         const gettedContract = await getContractById(contractId)
//         if(!gettedContract){
//             return res.send({ status: 404, message: 'Contract not found!' })
//         }
//         const cloudinaryUrl = gettedContract?.contractURL;
//         const response = await axios.get(cloudinaryUrl, { responseType: "arraybuffer" });
//         const content = response.data;

//         const pdfDoc = await PDFDocument.load(content);

//         const pages = pdfDoc.getPages();
//         const firstPage = pages[0];
//         firstPage.drawText(`Name: ${name}`, { x: 50, y: 700, size: 12 });
//         firstPage.drawText(`Position: ${position}`, { x: 50, y: 680, size: 12 });
//         firstPage.drawText(`Company: ${company}`, { x: 50, y: 660, size: 12 });
//         firstPage.drawText(`Joining Date: ${joiningDate}`, { x: 50, y: 640, size: 12 });
//         firstPage.drawText(`Email: ${email}`, { x: 50, y: 620, size: 12 });

//         const pdfBytes = await pdfDoc.save();

//         const uploadToCloudinary = async (pdfBytes) => {
//             return new Promise((resolve, reject) => {
//                 const uploadStream = cloudinary.uploader.upload_stream(
//                     { resource_type: "auto", folder: "employeeContract" },
//                     (error, result) => {
//                         if (error) reject(error);
//                         else resolve(result);
//                     }
//                 );
//                 streamifier.createReadStream(pdfBytes).pipe(uploadStream);
//             });
//         };

//         const uploadResult = await uploadToCloudinary(pdfBytes)
//         const generatedUrl = uploadResult.secure_url

//         return res.send({
//             status: 200,
//             message: 'Contract letter generated successfully for user.',
//             employeeContractForm: generatedUrl
//         })
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Something went wrong!' });
//     }
// };

// exports.generateOfferLetter = async (req, res) => {
//     try {
//         const { name, position, company, joiningDate, email, pdfUrl } = req.body;
    
//         if (!name || !position || !company || !joiningDate || !email || !pdfUrl) {
//             return res.status(400).send({ error: 'All fields are required!' });
//         }

//         async function fetchPDF(url) {
//             const response = await axios.get(url, { responseType: 'arraybuffer' });
//             return response.data;
//         }

//         // async function replacePDFPlaceholders(pdfBytes, data) {
//         //     const pdfDoc = await PDFDocument.load(pdfBytes);
//         //     console.log('pdfDoc/...', pdfDoc)
//         //     const font = await pdfDoc.embedFont(PDFDocument.PDFStandardFonts.Helvetica);
          
//         //     const pages = pdfDoc.getPages();
//         //     pages.forEach((page) => {
//         //         const { width, height } = page.getSize();
//         //         page.drawText(`Name: ${data.name}`, { x: 50, y: height - 100, size: 12, font });
//         //         page.drawText(`Position: ${data.position}`, { x: 50, y: height - 120, size: 12, font });
//         //         page.drawText(`Company: ${data.company}`, { x: 50, y: height - 140, size: 12, font });
//         //         page.drawText(`Joining Date: ${data.joiningDate}`, { x: 50, y: height - 160, size: 12, font });
//         //     });
          
//         //     const newPdfBytes = await pdfDoc.save();
//         //     return newPdfBytes;
//         // }
//         async function replacePDFPlaceholders(pdfBytes, data) {
//             const pdfDoc = await PDFDocument.load(pdfBytes);
          
//             // Embed the font
//             const helveticaFont = await pdfDoc.embedFont(PDFDocument.PDFStandardFonts.Helvetica);
          
//             // Get all pages in the document
//             const pages = pdfDoc.getPages();
          
//             // Modify the first page (or iterate through all pages as needed)
//             pages.forEach((page) => {
//               const { width, height } = page.getSize();
//               page.drawText(`Name: ${data.name}`, {
//                 x: 50,
//                 y: height - 100,
//                 size: 12,
//                 font: helveticaFont, // Use the embedded font
//               });
//               page.drawText(`Position: ${data.position}`, {
//                 x: 50,
//                 y: height - 120,
//                 size: 12,
//                 font: helveticaFont,
//               });
//               page.drawText(`Company: ${data.company}`, {
//                 x: 50,
//                 y: height - 140,
//                 size: 12,
//                 font: helveticaFont,
//               });
//               page.drawText(`Joining Date: ${data.joiningDate}`, {
//                 x: 50,
//                 y: height - 160,
//                 size: 12,
//                 font: helveticaFont,
//               });
//             });
          
//             // Serialize the updated PDF to bytes
//             const newPdfBytes = await pdfDoc.save();
//             return newPdfBytes;
//           }
          

//         function replaceDOCXPlaceholders(filePath, data) {
//             const content = fs.readFileSync(filePath, 'binary');
//             const zip = new PizZip(content);
//             const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
          
//             doc.render(data);
          
//             const buf = doc.getZip().generate({ type: 'nodebuffer' });
//             return buf;
//         }

//         // Step 1: Fetch PDF from the provided URL
//         const pdfBytes = await fetchPDF(pdfUrl)
//         // Step 2: Replace placeholders in the PDF
//         console.log('pdfBytes/...', pdfBytes)
//         const updatedPdfBytes = await replacePDFPlaceholders(pdfBytes, { name, position, company, joiningDate })
//         // Step 3: Save the updated PDF to a temporary file
//         const filePath = path.join(__dirname, 'generated-offer-letter.pdf');
//         fs.writeFileSync(filePath, updatedPdfBytes);
//         // Step 4: Send the updated PDF via email
//         const mailOptions = {
//             from: process.env.NODEMAILER_EMAIL,
//             to: email,
//             subject: 'Your Offer Letter',
//             text: `Dear ${name},\n\nPlease find your offer letter attached.`,
//             attachments: [{ filename: 'offer-letter.pdf', path: filePath }],
//         };    
//         await transporter.sendMail(mailOptions);
//         // Cleanup: Remove the temporary file
//         fs.unlinkSync(filePath);
    
//         // const filePath = req.file.path;
//         // const extension = path.extname(req.file.originalname).toLowerCase();
    
//         // let generatedFilePath;
//         // if (extension === '.pdf') {
//         //     // Replace placeholders in PDF
//         //     const data = { name, position, company, joiningDate };
//         //     const pdfBytes = await replacePDFPlaceholders(filePath, data);
    
//         //     generatedFilePath = path.join('generated', `${name}-offer-letter.pdf`);
//         //     fs.writeFileSync(generatedFilePath, pdfBytes);
//         // } else if (extension === '.docx') {
//         //     // Replace placeholders in DOCX
//         //     const data = { name, position, company, joiningDate };
//         //     const docxBytes = replaceDOCXPlaceholders(filePath, data);
    
//         //     generatedFilePath = path.join('generated', `${name}-offer-letter.docx`);
//         //     fs.writeFileSync(generatedFilePath, docxBytes);
//         // } else {
//         //     return res.status(400).send({ error: 'Unsupported file format!' });
//         // }
    
//         // // Send email
//         // const mailOptions = {
//         //     from: process.env.NODEMAILER_EMAIL,
//         //     to: email,
//         //     subject: 'Your Offer Letter',
//         //     text: `Dear ${name},\n\nPlease find your offer letter attached.`,
//         //     attachments: [{ filename: path.basename(generatedFilePath), path: generatedFilePath }],
//         // };
    
//         // await transporter.sendMail(mailOptions);
    
//         // // Clean up files
//         // fs.unlinkSync(filePath); // Remove uploaded template
//         // fs.unlinkSync(generatedFilePath); // Remove generated file after sending
    
//         res.status(200).send({ message: 'Offer letter sent successfully!' });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Something went wrong!' });
//     }
// };
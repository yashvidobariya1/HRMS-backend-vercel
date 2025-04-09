const User = require("../models/user");
const Location = require("../models/location");
const Company = require("../models/company");
const Contract = require("../models/contract");
const bcrypt = require("bcrypt");
const { transporter } = require("../utils/nodeMailer");
const cloudinary = require('../utils/cloudinary');
const moment = require('moment');
const { default: axios } = require("axios");
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const useragent = require("useragent");
const streamifier = require('streamifier');
const Template = require("../models/template");
const Task = require("../models/task");

exports.login = async (req, res) => {
    try {
        if (!req.body.email || !req.body.password) {
            return res.send({ status: 400, message: "Email and password are required" });
        }

        const isExist = await User.findOne({ "personalDetails.email": req.body.email, isDeleted: false });

        if (!isExist) {
            return res.send({ status: 404, message: "User not found" });
        }

        if(isExist && isExist?.isActive === false){
            return res.send({ status: 400, message: 'You do not have permission for loogIn!' })
        }

        const token = await isExist.generateAuthToken()
        const browser = useragent.parse(req.headers["user-agent"]);
        isExist.token = token
        // isExist.token = token.JWTToken
        isExist.lastTimeLoggedIn = moment().toDate()
        isExist.isLoggedIn = true
        isExist.usedBrowser = browser
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
        const userId = req.query.userId

        const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
        if(!existUser){
            return res.send({ status: 404, message: 'User not found' })
        }

        existUser.token = ""
        existUser.lastTimeLoggedOut = moment().toDate()
        existUser.isLoggedIn = false
        await existUser.save()
        return res.send({ status: 200, message: 'Logging out successfully.' })
    } catch (error) {
        console.error('Error occurred while logging out:', error)
        res.send({ message: 'Error occurred while logging out!' })
    }
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

            findUser.isEmailVerified = true
            await findUser.save()

            return res.send({ status: 200, message: 'OTP will be send to your registered email', otp })
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

        if(!findUser){
            return res.send({ status: 404, message: "User not found." })
        }

        if(findUser?.isEmailVerified !== true){
            return res.send({ status: 400, message: 'Email is not verified, please verify your email!' })
        } 
        if (findUser.otp === otp) {
            findUser.isOTPVerified = true
            await findUser.save()
            return res.send({ status: 200, message: "OTP verified successfully." })
        } else {
            return res.send({ status: 409, message: "Invalid OTP." })
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

        if(user?.isEmailVerified !== true){
            return res.send({ status: 400, message: 'Email is not verified, please verify your email!' })
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
        user.isEmailVerified = false
        user.isOTPVerified = false
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
            const userDetails = {
                personalDetails: user?.personalDetails,
                documentDetails: user?.documentDetails
            }
            return res.send({ status: 200, user: userDetails })
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
                documentDetails
            } = req.body

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
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
                        documentDetails: documentDetailsFile,
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
                documentDetails: updatedUser?.documentDetails
            }

            return res.send({ status:200, message: 'Profile updated successfully.', updatedUser: uUser })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating profile details:', error)
        res.send({ message: 'Error occurred while updating profile details!' })
    }
}

const generateContractForUser = async (userData, contractId) => {
    try {      
        const contract = await Contract.findOne({ _id: contractId, isDeleted: { $ne: true } })
        
        const response = await axios.get(contract?.contract , { responseType: 'arraybuffer' })
        const content = response.data

        const zip = new PizZip(content)
        const doc = new Docxtemplater(zip)

        doc.render(userData)

        const modifiedDoc = doc.getZip().generate({ type: 'nodebuffer' })

        return modifiedDoc
    } catch (error) {
        console.error('Error occurred while generating contract:', error)
        return { message: 'Error occurred while generating contract:' }
    }
}

const uploadBufferToCloudinary = (buffer, folder = 'contracts') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'raw', folder },
            (error, result) => {
                if (error) return reject(error)
                resolve(result)
            }
        )
        streamifier.createReadStream(buffer).pipe(uploadStream);
    })
}

async function generateUserId() {
    const lastUser = await User.findOne().sort({ unique_ID: -1 }).select("unique_ID")

    let newId = (lastUser && typeof lastUser.unique_ID === "number") ? lastUser.unique_ID + 1 : 1001

    if (newId > 9999) {
        return new Error("User ID limit exceeded. No available IDs.")
    }

    let existingUser = await User.findOne({ unique_ID: newId })
    while (existingUser) {
        newId++
        if (newId > 9999) {
            return new Error("User ID limit exceeded. No available IDs.")
        }
        existingUser = await User.findOne({ unique_ID: newId })
    }
  
    return newId;
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

            let companyId
            const locationId = jobDetails[0]?.location
            const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
            companyId = location?.companyId

            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            const allCompanysEmployees = await User.find({ companyId, isDeleted: { $ne: false } }).countDocuments()
            // console.log('allCompanysEmployees:', allCompanysEmployees)
            // console.log('company?.contractDetails?.maxEmployeesAllowed:', company?.contractDetails?.maxEmployeesAllowed)
            if(allCompanysEmployees > company?.contractDetails?.maxEmployeesAllowed){
                return res.send({ status: 409, message: 'Maximum employee limit reached. Cannot add more employees.' })
            }

            if (personalDetails && personalDetails.email) {
                const user = await User.findOne({ "personalDetails.email": personalDetails.email, isDeleted: { $ne: true } })
                if (user) {
                    return res.send({ status: 409, message: "Email already exists." });
                }
            }

            let locationIds = []
            if(jobDetails){
                jobDetails.forEach(JD => {
                    locationIds.push(JD.location)
                })
                // for check template assigned or not
                jobDetails.forEach(async JD => {
                    if(JD?.templateId){
                        const template = await Template.findOne({ _id: JD.templateId, isDeleted: { $ne: true } })
                        if(!template){
                            return res.send({ status: 404, message: 'Template not found' })
                        }
                        JD.isTemplateSigned = false
                    }
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
            // if (contractDetails?.contractDocument) {
            //     const document = contractDetails.contractDocument
            //     if (!document || typeof document !== 'string') {
            //         console.log('Invalid or missing contract document')
            //     }
            //     try {
            //         let element = await cloudinary.uploader.upload(document, {
            //             resource_type: "auto",
            //             folder: "userContracts",
            //         });
            //         // console.log('Cloudinary response:', element);
            //         contractDetailsFile = {
            //             contractType: contractDetails.contractType,
            //             contractDocument: {
            //                 fileURL: element.secure_url,
            //                 fileName: contractDetails.fileName,
            //             }
            //         };
            //     } catch (uploadError) {
            //         console.error("Error occurred while uploading file to Cloudinary:", uploadError);
            //         return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
            //     }
            // }
            if(contractDetails?.contractType){
                contractDetailsFile = {
                    contractId: contractDetails?.contractType,
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
                locationId: locationIds,
                immigrationDetails,
                role: jobDetails[0]?.role,
                password: hashedPassword,
                documentDetails: documentDetailsFile,
                contractDetails: contractDetailsFile,
                createdBy: req.user.role,
                creatorId: req.user._id,
            }

            let userData = {
                EMPLOYEE_NAME: `${newUser?.personalDetails?.firstName} ${newUser?.personalDetails?.lastName}`,
                EMPLOYEE_EMAIL: newUser?.personalDetails?.email,
                EMPLOYEE_CONTACT_NUMBER: newUser?.personalDetails?.phone,
                JOB_START_DATE: 'START_DATE',
                EMPLOYEE_JOB_TITLE: 'JOB_TITLE',
                WEEKLY_HOURS: 'WEEKLY_HOURS',
                ANNUAL_SALARY: 'ANNUAL_SALARY',
                COMPANY_NAME: company?.companyDetails?.businessName
            }

            const contractId = contractDetails?.contractType
            let generatedContract

            const contract = await Contract.findOne({ _id: contractId, isDeleted: { $ne: true } })
            if(!contract){
                return res.send({ status: 404, message: 'Contract not found' })
            }
            generatedContract = await generateContractForUser(userData, contractId)

            const contractURL = await uploadBufferToCloudinary(generatedContract)
            // console.log('contractURL?.secure_url:', contractURL?.secure_url)

            if (personalDetails.sendRegistrationLink == true) {
                try {
                    const attachedFileName = `${newUser?.personalDetails?.firstName}${newUser?.personalDetails?.lastName}-contract-${moment().format("YYYYMMDDHHmmssSSS") + Math.floor(Math.random() * 1000)}.pdf`
                    let mailOptions = {
                        from: process.env.NODEMAILER_EMAIL,
                        to: newUser.personalDetails.email,
                        subject: `Welcome to ${company?.companyDetails?.businessName}'s HRMS Portal`,
                        html: `
                            <p>Welcome to HRMS Portal!</p>

                            <p>We are pleased to inform you that a new ${newUser.role} account has been successfully created by the Manager under your supervision in the HRMS portal. Below are the details:</p>

                            <ul>
                                <li><b>Name:</b> ${personalDetails.firstName} ${personalDetails.lastName}</li>
                                <li><b>Email:</b> ${personalDetails.email}</li>
                                <li><b>Position:</b> ${jobDetails[0].jobTitle}</li>
                                <li><b>Joining Date:</b> ${jobDetails[0].joiningDate}</li>
                            </ul>

                            <p>Please ensure the ${newUser.role} logs into the HRMS portal using their temporary credentials and updates their password promptly. Here are the login details for their reference:</p>

                            <ul>
                                <li><b>HRMS Portal Link:</b> <a href="https://example.com">HRMS Portal</a></li>
                                <li><b>Username/Email:</b> ${personalDetails.email}</li>
                                <li><b>Temporary Password:</b> ${generatePass()}</li>
                            </ul>

                            <p>If you have any questions or need further assistance, feel free to reach out to the HR manager or HR department.</p>

                            <p>Looking forward to your journey with us!</p>

                            <p>Best regards,<br>HRMS Team</p>
                        `,
                        attachments: [{ filename: attachedFileName, content: generatedContract }],
                    };

                    await transporter.sendMail(mailOptions);
                    // console.log('Email sent successfully');
                } catch (error) {
                    console.log('Error occurred:', error);
                }
            }
            // console.log('new user', newUser)
            const unique_ID = await generateUserId()
            const user = await User.create({
                ...newUser,
                unique_ID,
                userContractURL: contractURL?.secure_url
            })

            return res.send({ status: 200, message: `${newUser.role} created successfully.`, user })
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

const getGracePoints = async (userId, jobId) => {
    const startDate = moment().startOf('month').toDate()
    const endDate = moment().endOf('month').toDate()
    const countOfLateClockIn = await Task.find({ userId, jobId, isLate: true, createdAt: { $gte: startDate, $lte: endDate } }).countDocuments()
    return countOfLateClockIn > 0 ? countOfLateClockIn : 0
}

const calculateUserGracePoints = async (users) => {
    return Promise.all(users.map(async (user) => {
        let roleWisePoints = []

        await Promise.all(user.jobDetails.map(async (job) => {
            const { _id: jobId, jobTitle } = job
            let gracePoints = await getGracePoints(user._id, jobId)

            roleWisePoints.push({
                jobId,
                jobTitle,
                gracePoints
            })
        }))

        return {
            ...user.toObject(),
            roleWisePoints
        }
    }))
}

exports.getAllUsers = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10
            // const timePeriod = parseInt(req.query.timePeriod)
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit

            // let timeFilter = {}
            // if (timePeriod) {
            //     const filteredHour = new Date()
            //     filteredHour.setHours(filteredHour.getHours() - timePeriod)
            //     timeFilter = { lastTimeLoggedIn: { $gte: filteredHour } }
            // }

            // let baseQuery = { isDeleted: { $ne: true }, ...timeFilter }
            let baseQuery = { isDeleted: { $ne: true } }

            if (req.user.role === 'Superadmin') {
                baseQuery.role = { $in: ["Administrator", "Manager", "Employee"] }
            } else if (req.user.role === 'Administrator') {
                baseQuery.companyId = req.user.companyId
                baseQuery.locationId = { $in: req.user.locationId }
                baseQuery.role = { $in: ["Manager", "Employee"] }
            } else if(req.user.role === 'Manager') {
                baseQuery.jobDetails = { $elemMatch: { assignManager: req.user._id.toString() } }
                baseQuery.companyId = req.user.companyId
                baseQuery.locationId = { $in: req.user.locationId }
                baseQuery.role = { $in: ["Employee"] }
            }

            if (searchQuery) {
                baseQuery.$or = [
                    { "personalDetails.firstName": { $regex: searchQuery, $options: "i" } },
                    { "personalDetails.lastName": { $regex: searchQuery, $options: "i" } }
                ];
            }

            const allUsers = await User.find(baseQuery)            
            const updateUsers = await calculateUserGracePoints(allUsers)
            const users = updateUsers.slice(skip, skip + limit)
            const totalUsers = updateUsers.length

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
            // if (contractDetails) {
            //     const document = contractDetails.contractDocument
            //     if (!document || typeof document !== 'string') {
            //         console.log('Invalid or missing contract document')
            //     }
            //     try {
            //         if(document.startsWith('data:')){
            //             let element = await cloudinary.uploader.upload(document, {
            //                 resource_type: "auto",
            //                 folder: "userContracts",
            //             });
            //             // console.log('Cloudinary response:', element);
            //             contractDetailsFile = {
            //                 contractType: contractDetails.contractType,
            //                 contractDocument: {
            //                     fileURL: element.secure_url,
            //                     fileName: contractDetails.fileName,
            //                 }
            //             };
            //         } else {
            //             contractDetailsFile = {
            //                 contractType: contractDetails.contractType,
            //                 contractDocument: {
            //                     fileURL: document,
            //                     fileName: contractDetails.fileName,
            //                 }
            //             }
            //         }
            //     } catch (uploadError) {
            //         console.error("Error occurred while uploading file to Cloudinary:", uploadError);
            //         return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
            //     }
            // }

            if(user?.contractDetails?.contractId == contractDetails?.contractType){
                contractDetailsFile = {
                    contractId: user?.contractDetails?.contractId
                }
            } else {
                contractDetailsFile = {
                    contractId: contractDetails?.contractType,
                }

                const contract = await Contract.findOne({ _id: contractDetailsFile?.contractId, isDeleted: { $ne: true } })
                if(!contract){
                    return res.send({ status: 404, message: 'Contract not found' })
                }

                const company = await Company.findOne({ _id: user?.companyId, isDeleted: { $ne: true } })
                if(!company){
                    return res.send({ status: 404, message: 'Company not found' })
                }

                let userData = {
                    EMPLOYEE_NAME: `${personalDetails?.firstName} ${personalDetails?.lastName}`,
                    EMPLOYEE_EMAIL: personalDetails?.email,
                    EMPLOYEE_CONTACT_NUMBER: personalDetails?.phone,
                    JOB_START_DATE: 'START_DATE',
                    EMPLOYEE_JOB_TITLE: 'JOB_TITLE',
                    WEEKLY_HOURS: 'WEEKLY_HOURS',
                    ANNUAL_SALARY: 'ANNUAL_SALARY',
                    COMPANY_NAME: company?.companyDetails?.businessName
                }

                const generatedContract = await generateContractForUser(userData, contractDetailsFile?.contractId)
                const attachedFileName = `${personalDetails?.firstName}${personalDetails?.lastName}-updated-contract-${moment().format("YYYYMMDDHHmmssSSS") + Math.floor(Math.random() * 1000)}.pdf`
                
                let mailOptions = {
                    from: process.env.NODEMAILER_EMAIL,
                    to: personalDetails?.email,
                    subject: "Your contract will be updated",
                    html: `
                        <p>Dear ${personalDetails?.firstName}${personalDetails?.lastName},</p>
                        <p>Your contract has been updated. Please find the attached updated contract.</p>
                        <p>Best Regards,<br>${company?.companyDetails?.businessName}</p>
                    `,
                    attachments: [{ filename: attachedFileName, content: generatedContract }],
                }
                await transporter.sendMail(mailOptions)
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

exports.sendMailToEmployee = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const { EmployeeId, subject, message } = req.body

            const existEmployee = await User.findOne({ _id: EmployeeId, isDeleted: { $ne: true } })
            if(!existEmployee){
                return res.send({ status: 404, message: 'Employee not found' })
            }

            const employeeEmail = existEmployee?.personalDetails?.email
            if(!employeeEmail){
                return res.send({ status: 404, message: 'Employee email not found' })
            }

            const mailOptions = {
                from: process.env.NODEMAILER_EMAIL,
                to: employeeEmail,
                subject: subject,
                html: `
                    <p>Hello ${existEmployee?.personalDetails?.firstName} ${existEmployee?.personalDetails?.lastName},</p>
                    <p>${message}</p>
                    <p>Best regards,<br>HRMS Team</p>
                `
            }

            transporter.sendMail(mailOptions)

            return res.send({ status: 200, message: 'Mail sent successfully' })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while sending mail:', error)
        res.send({ message: 'Error occurred while sending mail!' })
    }
}

exports.activateDeactivateUser = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin']
        if(allowedRoles.includes(req.user.role)){
            const { userId } = req.query

            const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!user){
                return res.send({ status: 404, message: 'User not found' })
            }

            if(user.isActive){
                user.isActive = false
                await user.save()
                return res.send({ status: 200, message: 'User deactivate successfully' })
            } else {
                user.isActive = true
                await user.save()
                return res.send({ status: 200, message: 'User activate successfully' })
            }

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deacting user:', error)
        res.send({ message: 'Error occurred while deacting user!' })
    }
}
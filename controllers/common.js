const User = require("../models/user");
const bcrypt = require("bcrypt");
const geolib = require('geolib')
const Timesheet = require("../models/timeSheet");
const { transporter } = require("../utils/nodeMailer");

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
            return res.send({ status: 200, user})
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
                immigrationDetails,
                documentDetails,
                contractDetails
            } = req.body

            // if (!personalDetails || !addressDetails || !jobDetails || !immigrationDetails) {
            //     return res.status(400).send({ message: "All sections of employee details are required." });
            // }

            if(personalDetails && personalDetails.email){
                const user = await User.findOne({ "personalDetails.email": personalDetails.email })
                if(user){
                    return res.send({ status: 409, message: "Email already exists." });
                }
            }

            if (documentDetails && Array.isArray(documentDetails)) {
                for (let i = 0; i < documentDetails.length; i++) {
                    const document = documentDetails[i].document;

                    if (!document || typeof document !== 'string') {
                        console.log(`Invalid or missing document for item ${i}`)
                    }
                    if (/^[A-Za-z0-9+/=]+$/.test(document)) {
                        if (document?.startsWith("JVBER")) {
                            documentDetails[i].document = `data:application/pdf;base64,${document}`;
                        } else if (document?.startsWith("iVBOR") || document?.startsWith("/9j/")) {
                            const mimeType = document.startsWith("iVBOR") ? "image/png" : "image/jpeg";
                            documentDetails[i].document = `data:${mimeType};base64,${document}`;
                        } else {
                            documentDetails[i].document = `data:text/plain;base64,${document}`;
                        }
                    } else {
                        console.log(`Invalid Base64 string for item ${i}`);
                    }
                }
            } else {
                console.log('documentDetails is not an array or is undefined');
            }

            if(contractDetails.contractDocument){
                const document = contractDetails.contractDocument
                if(!document || typeof document !== 'string'){
                    console.log('Invalid or missing contract document')
                }
                if(/^[A-Za-z0-9+/=]+$/.test(document)){
                    if (document?.startsWith("JVBER")) {
                        contractDetails.contractDocument = `data:application/pdf;base64,${document}`;
                    } else if (document?.startsWith("iVBOR") || document?.startsWith("/9j/")) {
                        const mimeType = document.startsWith("iVBOR") ? "image/png" : "image/jpeg";
                        contractDetails.contractDocument = `data:${mimeType};base64,${document}`;
                    } else {
                        contractDetails.contractDocument = `data:text/plain;base64,${document}`;
                    }
                } else {
                    console.log('Invalid Base64 string for contract document')
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

            const newEmployee = {
                personalDetails,
                addressDetails,
                kinDetails,
                financialDetails,
                jobDetails,
                immigrationDetails,
                role: jobDetails?.role,
                documentDetails,
                contractDetails,
                createdBy: req.user.role,
                creatorId: req.user._id,
            }
            if (personalDetails.sendRegistrationLink == true) {
                try {
                    let mailOptions = {
                        from: process.env.NODEMAILER_EMAIL,
                        to: newEmployee.personalDetails.email,
                        subject: "Welcome to [Company Name]'s HRMS Portal",
                        html: `
                            <p>Welcome to HRMS Portal!</p>

                            <p>We are pleased to inform you that a new employee account has been successfully created by the Manager under your supervision in the HRMS portal. Below are the details:</p>

                            <ul>
                                <li><b>Name:</b> ${personalDetails.firstName} ${personalDetails.lastName}</li>
                                <li><b>Email:</b> ${personalDetails.email}</li>
                                <li><b>Position:</b> ${jobDetails.jobTitle}</li>
                                <li><b>Joining Date:</b> ${jobDetails.joiningDate}</li>
                            </ul>

                            <p>Please ensure the employee logs into the HRMS portal using their temporary credentials and updates their password promptly. Here are the login details for their reference:</p>

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
            // console.log('new employee', newEmployee)
            const user = await User.create(newEmployee)

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
                return res.send({ status: 404, message: 'Employee not found' })
            }

            const user = await User.findOne({
                _id: userId,
                isDeleted: { $ne: true },
            });

            if (!user) {
                return res.send({ status: 404, message: 'User not found' })
            }

            if(user.documentDetails){
                for(let i=0; i<user.documentDetails.length; i++){
                    const doc = user.documentDetails[i];
                    doc.document = 'documentFile.pdf'
                }
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
            const users = await User.find()
            users.forEach((e) => {
                if (e.documentDetails.length > 0) {
                    for (let i = 0; i < e.documentDetails.length; i++) {
                        const doc = e.documentDetails[i];
                        doc.document = 'documentFile.pdf'
                    }
                }
            })
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

            if (personalDetails.email && employee.personalDetails.email != personalDetails.email) {
                const existingEmail = await User.findOne({ "personalDetails.email": personalDetails.email })
                if (existingEmail) {
                    return res.send({ status: 409, message: "Email already exists." });
                }
            }

            const updatedPersonalDetails = {
                firstName: personalDetails?.firstName,
                middleName: personalDetails?.middleName,
                lastName: personalDetails?.lastName,
                dateOfBirth: personalDetails?.dateOfBirth,
                gender: personalDetails?.gender,
                maritalStatus: personalDetails?.maritalStatus,
                phone: personalDetails?.phone,
                homeTelephone: personalDetails?.homeTelephone,
                email: personalDetails?.email,
                niNumber: personalDetails?.niNumber,
                sendRegistrationLink: personalDetails?.sendRegistrationLink
            }

            const updatedAddressDetails = {
                address: addressDetails?.address,
                addressLine2: addressDetails?.addressLine2,
                city: addressDetails?.city,
                postCode: addressDetails?.postCode,
            }

            const updatedKinDetails = {
                kinName: kinDetails?.kinName,
                relationshipToYou: kinDetails?.relationshipToYou,
                address: kinDetails?.address,
                postCode: kinDetails?.postCode,
                emergencyContactNumber: kinDetails?.emergencyContactNumber,
                email: kinDetails?.email,
            }

            const updatedFinancialDetails = {
                bankName: financialDetails?.bankName,
                holderName: financialDetails?.holderName,
                sortCode: financialDetails?.sortCode,
                accountNumber: financialDetails?.accountNumber,
                payrollFrequency: financialDetails?.payrollFrequency,
                pension: financialDetails?.pension,
            }

            const updatedJobDetails = {
                jobTitle: jobDetails?.jobTitle,
                jobDescription: jobDetails?.jobDescription,
                annualSalary: jobDetails?.annualSalary,
                hourlyRate: jobDetails?.hourlyRate,
                weeklyWorkingHours: jobDetails?.weeklyWorkingHours,
                weeklyWorkingHoursPattern: jobDetails?.weeklyWorkingHoursPattern,
                weeklySalary: jobDetails?.weeklySalary,
                joiningDate: jobDetails?.joiningDate,
                socCode: jobDetails?.socCode,
                modeOfTransfer: jobDetails?.modeOfTransfer,
                sickLeavesAllow: jobDetails?.sickLeavesAllow,
                leavesAllow: jobDetails?.leavesAllow,
                location: jobDetails?.location,
                assignManager: jobDetails?.assignManager,
                role: jobDetails?.role,
            }

            const updatedImmigrationDetails = {
                passportNumber: immigrationDetails?.passportNumber,
                countryOfIssue: immigrationDetails?.countryOfIssue,
                passportExpiry: immigrationDetails?.passportExpiry,
                nationality: immigrationDetails?.nationality,
                visaCategory: immigrationDetails?.visaCategory,
                visaValidFrom: immigrationDetails?.visaValidFrom,
                visaValidTo: immigrationDetails?.visaValidTo,
                brpNumber: immigrationDetails?.brpNumber,
                cosNumber: immigrationDetails?.cosNumber,
                restriction: immigrationDetails?.restriction,
                shareCode: immigrationDetails?.shareCode,
                rightToWorkCheckDate: immigrationDetails?.rightToWorkCheckDate,
                rightToWorkEndDate: immigrationDetails?.rightToWorkEndDate,
            }

            if (documentDetails && Array.isArray(documentDetails)) {
                for (let i = 0; i < documentDetails.length; i++) {
                    const document = documentDetails[i].document;

                    if (!document || typeof document !== 'string') {
                        console.log(`Invalid or missing document for item ${i}`)
                    }
                    if (/^[A-Za-z0-9+/=]+$/.test(document)) {
                        if (document?.startsWith("JVBER")) {
                            documentDetails[i].document = `data:application/pdf;base64,${document}`;
                        } else if (document?.startsWith("iVBOR") || document?.startsWith("/9j/")) {
                            const mimeType = document.startsWith("iVBOR") ? "image/png" : "image/jpeg";
                            documentDetails[i].document = `data:${mimeType};base64,${document}`;
                        } else {
                            documentDetails[i].document = `data:text/plain;base64,${document}`;
                        }
                    } else {
                        console.log(`Invalid Base64 string for item ${i}`);
                    }
                }
            }

            let updatedUser = await User.findByIdAndUpdate(
                { _id: userId },
                {
                    $set: {
                        personalDetails: updatedPersonalDetails,
                        addressDetails: updatedAddressDetails,
                        kinDetails: updatedKinDetails,
                        financialDetails: updatedFinancialDetails,
                        jobDetails: updatedJobDetails,
                        immigrationDetails: updatedImmigrationDetails,
                        documentDetails,
                        contractDetails,
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

exports.getOwnTimeSheet = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const userId = req.user._id
            const user = await User.findOne({
                _id: userId,
                isDeleted: { $ne: true },
            })
            if(!user) {
                return res.send({ status: 404, message: 'User not found' })
            }
            const currentDate = new Date().toISOString().slice(0, 10)
            const timesheet = await Timesheet.findOne({ userId, date: currentDate })
            if(timesheet) {
                return res.send({ status: 200, message: 'Time sheet get successfully.', timesheet})
            } else {
                return res.send({ status: 404, message: 'Record is not found!', timesheet: [] })
            }
                            
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error('Error occurred while getting time sheet:', error)
        res.send({ message: "Something went wrong while getting time sheet!" })
    }
}

exports.clockInFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            // console.log('req.user.role/...', req.user.role)
            const { userId, location } = req.body

            const existUser = await User.findById(userId)
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 400, message: "Something went wrong, Please try again!" })
            }

            await User.updateOne(
                { _id: existUser._id },
                { $set: { lastKnownLocation: location } }
            )

            // const GEOFENCE_CENTER = { latitude: 21.2171, longitude: 72.8588 } // for out of geofenc area ( varachha location is)

            // const GEOFENCE_CENTER = { latitude: 21.2297, longitude: 72.8385 } // for out of geofenc area ( gajera school location )

            // const GEOFENCE_CENTER = { latitude: 21.2252, longitude: 72.8083 } // for out of geofenc area ( kantheriya hanuman ji temple location )

            // const GEOFENCE_CENTER = { latitude: 21.2242, longitude: 72.8068 } // ( office location )
            
            const GEOFENCE_CENTER = { latitude: 21.2337, longitude: 72.8138 } // for successfully clocking ( getted location for clocking )
            const GEOFENCE_RADIUS = 1000 // meters

            if (!geolib.isPointWithinRadius(
                { latitude: location.latitude, longitude: location.longitude },
                GEOFENCE_CENTER,
                GEOFENCE_RADIUS
            )) {
                return res.send({ status: 403, message: 'You are outside the geofence area.' })
            }

            const currentDate = new Date().toISOString().slice(0, 10)
            let timesheet = await Timesheet.findOne({ userId, date: currentDate })

            if (!timesheet) {
                timesheet = new Timesheet({
                    userId,
                    date: currentDate,
                    clockingTime: [],
                    totalHours: '0h 0m 0s'
                })
            }

            const clockInsToday = timesheet.clockingTime.filter(entry => entry.clockIn).length
            if (clockInsToday >= 2) {
                return res.send({ status: 400, message: "You can only clock in two times per day." })
            }

            const lastClocking = timesheet.clockingTime[timesheet.clockingTime.length - 1]

            if (lastClocking && !lastClocking.clockOut) {
                return res.send({ status: 400, message: "Please clock out before clocking in again." })
            }

            timesheet.clockingTime.push({
                clockIn: new Date(),
                clockOut: "",
                isTimerOn: true
            })

            await timesheet.save()

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while clock in:", error);
        res.send({ message: "Something went wrong while clock in!" })
    }
}

exports.clockOutFunc = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const { userId, location } = req.body

            const existUser = await User.findById(userId)
            if (!existUser) {
                return res.send({ status: 404, message: "User not found" })
            }

            if (!location || !location.latitude || !location.longitude) {
                return res.send({ status: 400, message: "Something went wrong, Please try again!" })
            }

            const currentDate = new Date().toISOString().slice(0, 10);
            const timesheet = await Timesheet.findOne({ userId, date: currentDate })

            if (!timesheet) {
                return res.send({ status: 404, message: "No timesheet found for today." })
            }

            const lastClocking = timesheet.clockingTime[timesheet.clockingTime.length - 1]
            if (!lastClocking || lastClocking.clockOut) {
                return res.send({ status: 400, message: "No active clock-in to clock out from." })
            }

            lastClocking.clockOut = new Date()
            lastClocking.isTimerOn = false

            const clockInTime = new Date(lastClocking.clockIn)
            const clockOutTime = new Date(lastClocking.clockOut)

            const formatDuration = (clockInTime, clockOutTime) => {
                let diffInSeconds = Math.floor((clockOutTime - clockInTime) / 1000)
                const hours = Math.floor(diffInSeconds / 3600)
                diffInSeconds %= 3600
                const minutes = Math.floor(diffInSeconds / 60)
                const seconds = diffInSeconds % 60

                return `${hours}h ${minutes}m ${seconds}s`
            }

            const duration = formatDuration(clockInTime, clockOutTime)
            lastClocking.totalTiming = duration

            if(timesheet.totalHours == '0h 0m 0s'){
                timesheet.totalHours = duration
            } else {
                const parseTime = (duration) => {
                    const regex = /(\d+)h|(\d+)m|(\d+)s/g
                    let hours = 0, minutes = 0, seconds = 0
                    let match

                    while ((match = regex.exec(duration)) !== null) {
                        if (match[1]) hours = parseInt(match[1], 10)
                        if (match[2]) minutes = parseInt(match[2], 10)
                        if (match[3]) seconds = parseInt(match[3], 10)
                    }

                    return { hours, minutes, seconds }
                }
                const addDurations = (duration1, duration2) => {
                    const time1 = parseTime(duration1)
                    const time2 = parseTime(duration2)

                    let totalSeconds = time1.seconds + time2.seconds
                    let totalMinutes = time1.minutes + time2.minutes + Math.floor(totalSeconds / 60)
                    let totalHours = time1.hours + time2.hours + Math.floor(totalMinutes / 60)

                    totalSeconds %= 60
                    totalMinutes %= 60

                    return `${totalHours}h ${totalMinutes}m ${totalSeconds}s`
                }

                const result = addDurations(timesheet.totalHours, duration)
                timesheet.totalHours = result
            }

            await timesheet.save()

            return res.send({ status: 200, timesheet })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while clock out:", error);
        res.send({ message: "Something went wrong while clock out!" })
    }
}
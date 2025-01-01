const User = require('../models/user')
const bcrypt = require('bcrypt')

exports.addManager = async (req, res) => {
    try {
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
                    if (document.startsWith("JVBER")) {
                        documentDetails[i].document = `data:application/pdf;base64,${document}`;
                    } else if (document.startsWith("iVBOR") || document.startsWith("/9j/")) {
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

        if (personalDetails.sendRegistrationLink == true) {
            let mailOptions = {
                from: process.env.NODEMAILER_EMAIL,
                to: newEmployee.personalDetails.email,
                subject: "Welcome to [Company Name]'s HRMS Portal",
                html: `
                    <p>Dear ${newEmployee.personalDetails.firstName} ${newEmployee.personalDetails.lastName},</p>

                    <p>Welcome to HRMS Portal!</p>

                    <p>We are pleased to inform you that a new manager account has been successfully created by the Administrator under your supervision in the HRMS portal. Below are the details:</p>

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

                    <p>If you have any questions or need further assistance, feel free to reach out to the HR department.</p>

                    <p>Looking forward to your journey with us!</p>

                    <p>Best regards,<br>HRMS Team</p>
                `
            }
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error occurred:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
        }

        const newManager = {
            personalDetails :{
                ...personalDetails,
                password: hashedPassword
            },
            addressDetails,
            kinDetails,
            financialDetails,
            jobDetails,
            immigrationDetails,
            role: jobDetails?.role,
            documentDetails,
            contractDetails,
            // createdBy: req.user.role,
            // creatorId: req.user._id,
        }

        // console.log('new manager', newManager)
        const manager = await User.create(newManager)

        return res.send({ status: 200, message: 'Manager created successfully.', manager })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getManager = async (req, res) => {
    try {
        const managerId = req.params.id
        if (!managerId || managerId == 'undefined' || managerId == 'null') {
            return res.send({ status: 404, message: 'Manager not found' })
        }
        const manager = await User.findOne({
            _id: managerId,
            isDeleted: { $ne: true }
        })

        if (!manager) {
            return res.send({ status: 404, message: 'Manager not found.' })
        }
        return res.send({ status: 200, message: 'Manager get successfully.', manager })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getAllManager = async (req, res) => {
    try {
        const managers = await User.find({
            role: "Manager",
            isDeleted: { $ne: true }
        })
        return res.send({ status: 200, message: 'Manager all get successfully.', managers })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.updateManagerDetails = async (req, res) => {
    try {
        const managerId = req.params.id

        const manager = await User.findById({
            _id: managerId,
            isDeleted: { $ne: true }
        })
        // console.log('manager/...', manager)

        if (!manager) {
            return res.send({ status: 404, message: 'Manager not found' })
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
            postCode: kinDetails?.kinName,
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

        let updateManager = await User.findByIdAndUpdate(
            { _id: managerId },
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

        return res.send({ status: 200, message: 'Manager details updated successfully.', updateManager })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.deleteManager = async (req, res) => {
    try {
        const managerId = req.params.id

        const manager = await User.findOne({
            _id: managerId,
            isDeleted: { $ne: true }
        })

        if (!manager) {
            return res.send({ status: 404, message: 'Manager not found' })
        }

        let deletedManager = await User.findByIdAndUpdate(managerId, {
            $set: {
                isDeleted: true,
                canceledAt: new Date()
            }
        })

        return res.send({ status: 200, message: 'Manager deleted successfully.', deletedManager })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}
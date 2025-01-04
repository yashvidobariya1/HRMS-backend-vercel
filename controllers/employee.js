const User = require("../models/user")
const bcrypt = require('bcrypt')
const { transporter } = require("../utils/nodeMailer");

exports.addEmployee = async (req, res) => {
    try {
        // if (req.user.role == 'Manager') {
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
            personalDetails: {
                ...personalDetails,
                password: hashedPassword,
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
        const employee = await User.create(newEmployee)

        return res.send({ status: 200, message: 'Employee created successfully.', employee })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getEmployee = async (req, res) => {
    try {
        // if (req.user.role == 'Manager') {
        const employeeId = req.params.id

        if (!employeeId || employeeId == 'undefined' || employeeId == 'null') {
            return res.send({ status: 404, message: 'Employee not found' })
        }

        const employee = await User.findOne({
            _id: employeeId,
            isDeleted: { $ne: true },
        });

        if (!employee) {
            return res.send({ status: 404, message: 'Employee not found' })
        }

        if(employee.documentDetails.length > 0){
            for(let i=0; i<employee.documentDetails.length; i++){
                const doc = employee.documentDetails[i];
                doc.document = 'documentFile.pdf'
            }
        }

        return res.send({ status: 200, message: 'Employee get successfully.', employee })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getAllEmployees = async (req, res) => {
    try {
        // if (req.user.role == 'Manager') {
        const employees = await User.find({ role: 'Employee', isDeleted: { $ne: true } })
        if (!employees) {
            return res.send('Employees not found')
        }
        if(employees.documentDetails.length > 0){
            for(let i=0; i<employees.documentDetails.length; i++){
                const doc = employees.documentDetails[i];
                doc.document = 'documentFile.pdf'
            }
        }
        res.send({ status: 200, message: 'Employee all get successfully.', employees })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.updateEmployee = async (req, res) => {
    try {
        // if (req.user.role == 'Manager') {
        const employeeId = req.params.id

        const employee = await User.findOne({
            _id: employeeId,
            isDeleted: { $ne: true }
        });

        if (!employee) {
            return res.send({ status: 404, message: 'Employee not found' })
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

        let updatedEmployee = await User.findByIdAndUpdate(
            { _id: employeeId },
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

        return res.send({ status: 200, message: 'Employee details updated successfully.', updatedEmployee })

        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.deleteEmployee = async (req, res) => {
    try {
        // if (req.user.role == 'Manager') {
        const employeeId = req.params.id

        const employee = await User.findOne({
            _id: employeeId,
            isDeleted: { $ne: true },
        });
        if (!employee) {
            return res.send({ status: 404, message: 'Employee not found' })
        }

        let deletedEmployee = await User.findByIdAndUpdate(employeeId, {
            $set: {
                isDeleted: true,
                canceledAt: new Date()
            }
        })

        return res.send({ status: 200, message: 'Employee deleted successfully.', deletedEmployee })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getDetails = async (req, res) => {
    // try {
    //     // if(req.user.role == 'Employee') {
    //         const employeeId = req.user._id
    //         const employee = await User.findOne({
    //             _id: employeeId,
    //             isDeleted: { $ne: true },
    //         });
    //         if(!employee) {
    //             return res.status(404).json({ message: 'Employee not found' })
    //         }
    //         return res.status(200).send(employee)
    //     // } else return res.status(401).send('You can not authorize for this action.')
    // } catch (error) {
    //     console.log('Error:', error)
    //     return res.send(error.message)
    // }
}
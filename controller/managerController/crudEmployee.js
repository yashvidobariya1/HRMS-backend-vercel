const User = require("../../models/user")


exports.addEmployee = async (req, res) => {
    try {
        // if(req.user.role == 'Manager'){
            let {
                personalDetails,
                addressDetails,
                jobDetails,
                immigrationDetails,
                documentDetails,
                contractDetails
            } = req.body

            // if (!personalDetails || !addressDetails || !jobDetails || !immigrationDetails) {
            //     return res.status(400).send({ message: "All sections of employee details are required." });
            // }            

            const newEmployee = {
                personalDetails,
                addressDetails,
                jobDetails,
                immigrationDetails,
                role: "Employee",
                documentDetails,
                contractDetails,
                // createdBy: req.user.role,
                // creatorId: req.user._id,
            }

            // console.log('new employee', newEmployee)
            const employee = await User.create(newEmployee)

            return res.status(200).send({ message: 'Employee created successfully.', employee })
        // } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.messsage)
    }
}

exports.getEmployee = async (req, res) => {
    try {
        // if(req.user.role == 'Manager'){
            const employeeId = req.params.id

            const employee = await User.findById(employeeId)

            if(!employee) {
                return res.status(404).send('Employee not found')
            }

            return res.status(200).send(employee)
        // } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.messsage)
    }
}

exports.updateEmployee = (req, res) => {
    try {
        if(req.user.role == 'Manager'){
            const employeeId = req.params.id

            const employee = User.findById(employeeId)

            if(!employee) {
                return res.status(404).send('Employee not found')
            }

            let {
                personalDetails,
                addressDetails,
                jobDetails,
                immigrationDetails
            } = req.body

            let updatedEmployee = User.findOneAndUpdate(
                { _id: employeeId },
                {
                    $set: {
                        personalDetails: {
                            firstName: personalDetails.firstName || employee.personalDetails.firstName,
                            middleName: personalDetails.middleName || employee.personalDetails.middleName,
                            lastName: personalDetails.lastName || employee.personalDetails.lastName,
                            dateOfBirth: personalDetails.dateOfBirth || employee.personalDetails.dateOfBirth,
                            gender: personalDetails.gender || employee.personalDetails.gender,
                            maritalStatus: personalDetails.maritalStatus || employee.personalDetails.maritalStatus,
                            phone: personalDetails.phone || employee.personalDetails.phone,
                            homeTelephone: personalDetails.homeTelephone || employee.personalDetails.homeTelephone,
                            email: personalDetails.email || employee.personalDetails.email,
                            niNumber: personalDetails.niNumber || employee.personalDetails.niNumber,
                        },
                        addressDetails: {
                            address: addressDetails.address || employee.addressDetails.address,
                            addressLine2: addressDetails.addressLine2 || employee.addressDetails.addressLine2,
                            city: addressDetails.city || employee.addressDetails.city,
                            postCode: addressDetails.postCode || employee.addressDetails.postCode,
                        },
                        jobDetails: {
                            jobTitle: jobDetails.jobTitle || employee.jobDetails.jobTitle,
                            jobDescription: jobDetails.jobDescription || employee.jobDetails.jobDescription,
                            annualSalary: jobDetails.annualSalary || employee.jobDetails.annualSalary,
                            hourlyRate: jobDetails.hourlyRate || employee.jobDetails.hourlyRate,
                            weeklyWorkingHours: jobDetails.weeklyWorkingHours || employee.jobDetails.weeklyWorkingHours,
                            joiningDate: jobDetails.joiningDate || employee.jobDetails.joiningDate,
                            location: jobDetails.location || employee.jobDetails.location,
                            assignManager: jobDetails.assignManager || employee.jobDetails.assignManager,
                            role: jobDetails.role || employee.jobDetails.role,
                        },
                        immigrationDetails: {
                            passportNumber: immigrationDetails.passportNumber || employee.immigrationDetails.passportNumber,
                            countryOfIssue: immigrationDetails.countryOfIssue || employee.immigrationDetails.passportNumber,
                            passportExpiry: immigrationDetails.passportExpiry || employee.immigrationDetails.passportNumber,
                            nationality: immigrationDetails.nationality || employee.immigrationDetails.passportNumber,
                            visaCategory: immigrationDetails.visaCategory || employee.immigrationDetails.passportNumber,
                            visaValidFrom: immigrationDetails.visaValidFrom || employee.immigrationDetails.passportNumber,
                            visaValidTo: immigrationDetails.visaValidTo || employee.immigrationDetails.passportNumber,
                            brpNumber: immigrationDetails.brpNumber || employee.immigrationDetails.passportNumber,
                            cosNumber: immigrationDetails.cosNumber || employee.immigrationDetails.passportNumber,
                            restriction: immigrationDetails.restriction || employee.immigrationDetails.passportNumber,
                            shareCode: immigrationDetails.shareCode || employee.immigrationDetails.passportNumber,
                            rightToWorkCheckDate: immigrationDetails.rightToWorkCheckDate || employee.immigrationDetails.passportNumber,
                            rightToWorkEndDate: immigrationDetails.rightToWorkEndDate || employee.immigrationDetails.passportNumber,
                        },
                        documentDetails,
                        contractDetails,
                        updatedAt: new Date()
                    }
                }, { new: true }
            )
            
            return res.status(200).send({ message: 'Employee details updated successfully.', updatedEmployee })

        } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.messsage)
    }
}

exports.deleteEmployee = (req, res) => {
    try {
        if(req.user.role == 'Manager'){
            const employeeId = req.params.id

            const employee = User.findById(employeeId)

            if(!employee) {
                return res.status(404).send('Employee not found')
            }

            let deletedEmployee = User.findOneAndDelete(employeeId)

            return res.status(200).send({ message: 'Employee removed successfully.', deletedEmployee })
        } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.messsage)
    }
}
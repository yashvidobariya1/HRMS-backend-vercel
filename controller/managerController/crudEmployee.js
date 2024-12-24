

exports.addEmployee = async (req, res) => {
    try {
        if(req.user.role == 'Manager'){
            let {
                personalDetails,
                addressDetails,
                jobDetails,
                immigrationDetails
            } = req.body

            // if (!personalDetails || !addressDetails || !jobDetails || !immigrationDetails) {
            //     return res.status(400).send({ message: "All sections of employee details are required." });
            // }            

            const newEmployee = {
                personalDetails: {
                    firstName: personalDetails.firstName,
                    middleName: personalDetails.middleName,
                    lastName: personalDetails.lastName,
                    dateOfBirth: personalDetails.dateOfBirth,
                    gender: personalDetails.gender,
                    maritalStatus: personalDetails.maritalStatus,
                    phone: personalDetails.phone,
                    email: personalDetails.email,
                },
                addressDetails: {
                    address: addressDetails.address,
                    addressLine2: addressDetails.addressLine2,
                    city: addressDetails.city,
                    postCode: addressDetails.postCode,
                },
                jobDetails: {
                    jobTitle: jobDetails.jobTitle,
                    annualSalary: jobDetails.annualSalary,
                    hourlyRate: jobDetails.hourlyRate,
                    weeklyWorkingHours: jobDetails.weeklyWorkingHours,
                    joiningDate: jobDetails.joiningDate,
                },
                immigrationDetails: {
                    passportNumber: immigrationDetails.passportNumber,
                    countryOfIssue: immigrationDetails.countryOfIssue,
                    nationality: immigrationDetails.nationality,
                    visaCategory: immigrationDetails.visaCategory,
                    visaValidFrom: immigrationDetails.visaValidFrom,
                    visaValidTo: immigrationDetails.visaValidTo,
                }
            }

            console.log('new employee', newEmployee)
            const employee = User.create(newEmployee)
            await employee.save()

            return res.status(200).send({ message: 'Employee created successfully.', employee })
        } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.messsage)
    }
}

exports.getEmployee = (req, res) => {
    try {
        if(req.user.role == 'Manager'){
            const employeeId = req.params.id

            const employee = User.findById(employeeId)

            if(!employee) {
                return res.status(404).send('Employee not found')
            }

            return res.status(200).send(employee)
        } else return res.status(401).send('You can not authorize for this action.')
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
                            gender: personalDetails.gender || employee.personalDetails.firstName,
                            maritalStatus: personalDetails.maritalStatus || employee.personalDetails.firstName,
                            phone: personalDetails.phone || employee.personalDetails.firstName,
                            email: personalDetails.email || employee.personalDetails.firstName,
                        },
                        addressDetails: {
                            address: addressDetails.address || employee.addressDetails.address,
                            addressLine2: addressDetails.addressLine2 || employee.addressDetails.addressLine2,
                            city: addressDetails.city || employee.addressDetails.city,
                            postCode: addressDetails.postCode || employee.addressDetails.postCode,
                        },
                        jobDetails: {
                            jobTitle: jobDetails.jobTitle || employee.jobDetails.jobTitle,
                            annualSalary: jobDetails.annualSalary || employee.jobDetails.annualSalary,
                            hourlyRate: jobDetails.hourlyRate || employee.jobDetails.hourlyRate,
                            weeklyWorkingHours: jobDetails.weeklyWorkingHours || employee.jobDetails.weeklyWorkingHours,
                            joiningDate: jobDetails.joiningDate || employee.jobDetails.joiningDate,
                        },
                        immigrationDetails: {
                            passportNumber: immigrationDetails.passportNumber || employee.passportDetails.passportNumber,
                            countryOfIssue: immigrationDetails.countryOfIssue || employee.passportDetails.countryOfIssue,
                            nationality: immigrationDetails.nationality || employee.passportDetails.nationality,
                            visaCategory: immigrationDetails.visaCategory || employee.passportDetails.visaCategory,
                            visaValidFrom: immigrationDetails.visaValidFrom || employee.passportDetails.visaValidFrom,
                            visaValidTo: immigrationDetails.visaValidTo || employee.passportDetails.visaValidTo,
                        }
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
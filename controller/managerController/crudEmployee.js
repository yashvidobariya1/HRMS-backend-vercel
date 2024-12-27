const User = require("../../models/user")
const fs = require('fs');
const path = require('path');

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
            
            if (documentDetails && Array.isArray(documentDetails)) {
                for (let i = 0; i < documentDetails.length; i++) {
                    const document = documentDetails[i].document;
    
                    if (document) {
                        const base64Data = document.replace(/^data:image\/\w+;base64,/, '');
                        documentDetails[i].document = `data:image/png;base64,${base64Data}`
                    } else {
                        console.log(`No document provided for item ${i}`);
                    }
                }
            } else {
                console.log('documentDetails is not an array or is undefined');
            }

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
                // createdBy: req.user.role,
                // creatorId: req.user._id,
            }

            // console.log('new employee', newEmployee)
            const employee = await User.create(newEmployee)

            return res.status(200).send({ message: 'Employee created successfully.', employee })
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
                return res.status(404).send({ message: 'Employee not found' })
            }

            const employee = await User.findOne({
                _id: employeeId,
                isDeleted: { $ne: true },
            });

            if (!employee) {
                return res.status(404).send({ message: 'Employee not found' })
            }

            return res.status(200).send({ message: 'Employee get successfully.', employee })
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
            if(!employees) {
                return res.status(404).send('Employees not found')
            }
            res.status(200).send({ message: 'Employee all get successfully.', employees })
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
                return res.status(404).send({ message: 'Employee not found' })
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
                firstName: personalDetails?.firstName || employee.personalDetails.firstName,
                middleName: personalDetails?.middleName || employee.personalDetails.middleName,
                lastName: personalDetails?.lastName || employee.personalDetails.lastName,
                dateOfBirth: personalDetails?.dateOfBirth || employee.personalDetails.dateOfBirth,
                gender: personalDetails?.gender || employee.personalDetails.gender,
                maritalStatus: personalDetails?.maritalStatus || employee.personalDetails.maritalStatus,
                phone: personalDetails?.phone || employee.personalDetails.phone,
                homeTelephone: personalDetails?.homeTelephone || employee.personalDetails.homeTelephone,
                email: personalDetails?.email || employee.personalDetails.email,
                niNumber: personalDetails?.niNumber || employee.personalDetails.niNumber,
            }

            const updatedAddressDetails = {
                address: addressDetails?.address || employee.addressDetails.address,
                addressLine2: addressDetails?.addressLine2 || employee.addressDetails.addressLine2,
                city: addressDetails?.city || employee.addressDetails.city,
                postCode: addressDetails?.postCode || employee.addressDetails.postCode,
            }

            const updatedKinDetails = {
                kinName: kinDetails?.kinName || employee.kinDetails.kinName,
                relationshipToYou: kinDetails?.relationshipToYou || employee.kinDetails.relationshipToYou,
                address: kinDetails?.address || employee.kinDetails.address,
                postCode: kinDetails?.kinName || employee.kinDetails.kinName,
                emergencyContactNumber: kinDetails?.emergencyContactNumber || employee.kinDetails.emergencyContactNumber,
                email: kinDetails?.email || employee.kinDetails.email,
            }

            const updatedFinancialDetails = {
                bankName: financialDetails?.bankName || employee.financialDetails.bankName,
                holderName: financialDetails?.holderName || employee.financialDetails.holderName,
                sortCode: financialDetails?.sortCode || employee.financialDetails.sortCode,
                accountNumber: financialDetails?.accountNumber || employee.financialDetails.accountNumber,
                payrollFrequency: financialDetails?.payrollFrequency || employee.financialDetails.payrollFrequency,
                pension: financialDetails?.pension || employee.financialDetails.pension,
            }

            const updatedJobDetails = {
                jobTitle: jobDetails?.jobTitle || employee.jobDetails.jobTitle,
                jobDescription: jobDetails?.jobDescription || employee.jobDetails.jobDescription,
                annualSalary: jobDetails?.annualSalary || employee.jobDetails.annualSalary,
                hourlyRate: jobDetails?.hourlyRate || employee.jobDetails.hourlyRate,
                weeklyWorkingHours: jobDetails?.weeklyWorkingHours || employee.jobDetails.weeklyWorkingHours,
                weeklyWorkingHoursPattern: jobDetails?.weeklyWorkingHoursPattern || employee.jobDetails.weeklyWorkingHoursPattern,
                weeklySalary: jobDetails?.weeklySalary || employee.jobDetails.weeklySalary,
                joiningDate: jobDetails?.joiningDate || employee.jobDetails.joiningDate,
                socCode: jobDetails?.socCode || employee.jobDetails.socCode,
                modeOfTransfer: jobDetails?.modeOfTransfer || employee.jobDetails.modeOfTransfer,
                sickLeavesAllow: jobDetails?.sickLeavesAllow || employee.jobDetails.sickLeavesAllow,
                leavesAllow: jobDetails?.leavesAllow || employee.jobDetails.leavesAllow,
                location: jobDetails?.location || employee.jobDetails.location,
                assignManager: jobDetails?.assignManager || employee.jobDetails.assignManager,
                role: jobDetails?.role || employee.jobDetails.role,
            }

            const updatedImmigrationDetails = {
                passportNumber: immigrationDetails?.passportNumber || employee.immigrationDetails.passportNumber,
                countryOfIssue: immigrationDetails?.countryOfIssue || employee.immigrationDetails.countryOfIssue,
                passportExpiry: immigrationDetails?.passportExpiry || employee.immigrationDetails.passportExpiry,
                nationality: immigrationDetails?.nationality || employee.immigrationDetails.nationality,
                visaCategory: immigrationDetails?.visaCategory || employee.immigrationDetails.visaCategory,
                visaValidFrom: immigrationDetails?.visaValidFrom || employee.immigrationDetails.visaValidFrom,
                visaValidTo: immigrationDetails?.visaValidTo || employee.immigrationDetails.visaValidTo,
                brpNumber: immigrationDetails?.brpNumber || employee.immigrationDetails.brpNumber,
                cosNumber: immigrationDetails?.cosNumber || employee.immigrationDetails.cosNumber,
                restriction: immigrationDetails?.restriction || employee.immigrationDetails.restriction,
                shareCode: immigrationDetails?.shareCode || employee.immigrationDetails.shareCode,
                rightToWorkCheckDate: immigrationDetails?.rightToWorkCheckDate || employee.immigrationDetails.rightToWorkCheckDate,
                rightToWorkEndDate: immigrationDetails?.rightToWorkEndDate || employee.immigrationDetails.rightToWorkEndDate,
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

            return res.status(200).send({ message: 'Employee details updated successfully.', updatedEmployee })

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
                return res.status(404).send({ message: 'Employee not found' })
            }

            let deletedEmployee = await User.findByIdAndUpdate(employeeId, {
                $set: {
                    isDeleted: true,
                    canceledAt: new Date()
                }
            })

            return res.status(200).send({ message: 'Employee deleted successfully.', deletedEmployee })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

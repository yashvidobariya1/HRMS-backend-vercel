const Company = require("../../models/company")


exports.addCompany = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
            let {
                companyDetails,
                employeeSettings,
                contractDetails
            } = req.body            

            const newCompany = {
                companyDetails,
                employeeSettings,
                contractDetails
            }

            // console.log('new company', newCompany)
            const company = await Company.create(newCompany)

            return res.status(200).send({ message: 'Company created successfully.', company })
        // } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}

exports.getCompany = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
            const companyId = req.params.id

            const company = await Company.findById(companyId)

            if(!company) {
                return res.status(404).send('Company not found')
            }

            return res.status(200).send(company)
        // } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}

exports.getAllCompany = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {

            const company = await Company.find()

            if(!company) {
                return res.status(404).send('Company not found')
            }

            return res.status(200).send(company)
        // } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}

exports.updateCompanyDetails = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
            const companyId = req.params.id

            const company = await Company.findById(companyId)

            if(!company) {
                return res.status(404).send('Company not found')
            }

            let {
                companyDetails,
                employeeSettings,
                contractDetails
            } = req.body

            const updatedCompanyDetails = {
                companyCode: companyDetails?.companyCode || company.companyDetails?.companyCode,
                businessName: companyDetails?.businessName || company.companyDetails?.businessName,
                companyLogo: companyDetails?.companyLogo || company.companyDetails?.companyLogo,
                companyRegistrationNumber: companyDetails?.companyRegistrationNumber || company.companyDetails?.companyRegistrationNumber,
                payeReferenceNumber: companyDetails?.payeReferenceNumber || company.companyDetails?.payeReferenceNumber,
                address: companyDetails?.address || company.companyDetails?.address,
                addressLine2: companyDetails?.addressLine2 || company.companyDetails?.addressLine2,
                city: companyDetails?.city || company.companyDetails?.city,
                postCode: companyDetails?.postCode || company.companyDetails?.postCode,
                country: companyDetails?.country || company.companyDetails?.country,
                timeZone: companyDetails?.timeZone || company.companyDetails?.timeZone,
                contactPersonFirstname: companyDetails?.contactPersonFirstname || company.companyDetails?.contactPersonFirstname,
                contactPersonMiddlename: companyDetails?.contactPersonMiddlename || company.companyDetails?.contactPersonMiddlename,
                contactPersonLastname: companyDetails?.contactPersonLastname || company.companyDetails?.contactPersonLastname,
                contactPersonEmail: companyDetails?.contactPersonEmail || company.companyDetails?.contactPersonEmail,
                contactPhone: companyDetails?.contactPhone || company.companyDetails?.contactPhone,
                adminToReceiveNotification: companyDetails?.adminToReceiveNotification || company.companyDetails?.adminToReceiveNotification,
                additionalEmailsForCompliance: companyDetails?.additionalEmailsForCompliance || company.companyDetails?.additionalEmailsForCompliance,
                pensionProvider: companyDetails?.pensionProvider || company.companyDetails?.pensionProvider,
            }

            const updatedEmployeeSettinf = {
                payrollFrequency: employeeSettings?.payrollFrequency || company.employeeSettings?.payrollFrequency,
                immigrationReminders: {
                    day1st: employeeSettings?.immigrationReminders?.day1st || company.employeeSettings?.immigrationReminders?.day1st,
                    day2nd: employeeSettings?.immigrationReminders?.day2nd || company.employeeSettings?.immigrationReminders?.day2nd,
                    day3rd: employeeSettings?.immigrationReminders?.day3rd || company.employeeSettings?.immigrationReminders?.day3rd
                },
                holidayYear: employeeSettings?.holidayYear || company.employeeSettings?.holidayYear,
                noticePeriodDays: employeeSettings?.noticePeriodDays || company.employeeSettings?.noticePeriodDays,
                contactConfirmationDays: employeeSettings?.contactConfirmationDays || company.employeeSettings?.contactConfirmationDays,
                rightToWorkCheckReminder: employeeSettings?.rightToWorkCheckReminder || company.employeeSettings?.rightToWorkCheckReminder,
                leaveEntitlements: {
                    holidaysExcludingBank: employeeSettings?.leaveEntitlements?.holidaysExcludingBank || company.employeeSettings?.leaveEntitlements?.holidaysExcludingBank,
                    sickLeaves: employeeSettings?.leaveEntitlements?.sickLeaves || company.employeeSettings?.leaveEntitlements?.sickLeaves
                },
            }

            const updateContractDetails = {
                startDate: contractDetails?.startDate || company.contractDetails?.startDate,
                endDate: contractDetails?.endDate || company.contractDetails?.endDate,
                maxEmployeesAllowed: contractDetails?.maxEmployeesAllowed || company.contractDetails?.maxEmployeesAllowed,
            }

            let updatedCompany = await Company.findByIdAndUpdate(
                { _id: companyId },
                {
                    $set: {
                        companyDetails: updatedCompanyDetails,
                        employeeSettings: updatedEmployeeSettinf,
                        contractDetails: updateContractDetails,
                        updatedAt: new Date()
                    }
                }, { new: true }
            )
            // await updatedCompany.save()
            
            return res.status(200).send({ message: 'Company details updated successfully.', updatedCompany })
        // } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}

exports.deleteCompany = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
            const companyId = req.params.id

            const company = await Company.findById(companyId)

            if(!company) {
                return res.status(404).send('Company not found')
            }

            let deletedCompany = await Company.findByIdAndDelete(companyId)

            return res.status(200).send({ message: 'Company removed successfully.', deletedCompany })
        // } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}
const Company = require("../models/company")

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
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getCompany = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
        const companyId = req.params.id
        if (!companyId || companyId == 'undefined' || companyId == 'null') {
            return res.status(404).send({ message: 'Company not found' })
        }
        const company = await Company.findOne({
            _id: companyId,
            isDeleted: { $ne: true }
        });

        if (!company) {
            return res.status(404).send({ message: 'Company not found' })
        }

        return res.status(200).send({ message: 'Company get successfully.', company })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getAllCompany = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {

        const company = await Company.find({ isDeleted: { $ne: true } })

        if (!company) {
            return res.status(404).send({ message: 'Company not found' })
        }

        return res.status(200).send({ message: 'Company all get successfully.', company })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.updateCompanyDetails = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
        const companyId = req.params.id

        const company = await Company.findOne({
            _id: companyId,
            isDeleted: { $ne: true }
        });

        if (!company) {
            return res.status(404).send({ message: 'Company not found' })
        }

        let {
            companyDetails,
            employeeSettings,
            contractDetails
        } = req.body

        const updatedCompanyDetails = {
            companyCode: companyDetails?.companyCode,
            businessName: companyDetails?.businessName,
            companyLogo: companyDetails?.companyLogo,
            companyRegistrationNumber: companyDetails?.companyRegistrationNumber,
            payeReferenceNumber: companyDetails?.payeReferenceNumber,
            address: companyDetails?.address,
            addressLine2: companyDetails?.addressLine2,
            city: companyDetails?.city,
            postCode: companyDetails?.postCode,
            country: companyDetails?.country,
            timeZone: companyDetails?.timeZone,
            contactPersonFirstname: companyDetails?.contactPersonFirstname,
            contactPersonMiddlename: companyDetails?.contactPersonMiddlename,
            contactPersonLastname: companyDetails?.contactPersonLastname,
            contactPersonEmail: companyDetails?.contactPersonEmail,
            contactPhone: companyDetails?.contactPhone,
            adminToReceiveNotification: companyDetails?.adminToReceiveNotification,
            additionalEmailsForCompliance: companyDetails?.additionalEmailsForCompliance,
            pensionProvider: companyDetails?.pensionProvider,
        }

        const updatedEmployeeSettinf = {
            payrollFrequency: employeeSettings?.payrollFrequency,
            immigrationReminders: {
                day1st: employeeSettings?.immigrationReminders?.day1st,
                day2nd: employeeSettings?.immigrationReminders?.day2nd,
                day3rd: employeeSettings?.immigrationReminders?.day3rdd
            },
            holidayYear: employeeSettings?.holidayYear,
            noticePeriodDays: employeeSettings?.noticePeriodDays,
            contactConfirmationDays: employeeSettings?.contactConfirmationDays,
            rightToWorkCheckReminder: employeeSettings?.rightToWorkCheckReminder,
            leaveEntitlements: {
                holidaysExcludingBank: employeeSettings?.leaveEntitlements?.holidaysExcludingBank,
                sickLeaves: employeeSettings?.leaveEntitlements?.sickLeavess
            },
        }

        const updateContractDetails = {
            startDate: contractDetails?.startDate,
            endDate: contractDetails?.endDate,
            maxEmployeesAllowed: contractDetails?.maxEmployeesAllowed,
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
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.deleteCompany = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
        const companyId = req.params.id

        const company = await Company.findOne({
            _id: companyId,
            isDeleted: { $ne: true }
        });

        if (!company) {
            return res.status(404).send({ message: 'Company not found' })
        }

        let deletedCompany = await Company.findByIdAndUpdate(companyId, {
            $set: {
                isDeleted: true,
                canceledAt: new Date()
            }
        })

        return res.status(200).send({ message: 'Company deleted successfully.', deletedCompany })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}
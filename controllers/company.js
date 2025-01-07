const Company = require("../models/company")

exports.addCompany = async (req, res) => {
    try {
        if(req.user.role == 'Superadmin') {
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

            return res.send({ status: 200, message: 'Company created successfully.', company })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while adding company:", error);
        res.send({ message: "Something went wrong while adding company!" })
    }
}

exports.getCompany = async (req, res) => {
    try {
        if(req.user.role == 'Superadmin') {
            const companyId = req.params.id
            if (!companyId || companyId == 'undefined' || companyId == 'null') {
                return res.send({ status: 404, message: 'Company not found' })
            }
            const company = await Company.findOne({
                _id: companyId,
                isDeleted: { $ne: true }
            });

            if (!company) {
                return res.send({ status: 404, message: 'Company not found' })
            }

            return res.send({ status: 200, message: 'Company get successfully.', company })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting company:", error);
        res.send({ message: "Something went wrong while getting company!" })
    }
}

exports.getAllCompany = async (req, res) => {
    try {
        if(req.user.role == 'Superadmin') {

            const company = await Company.find({ isDeleted: { $ne: true } })

            if (!company) {
                return res.send({ status: 404, message: 'Company not found' })
            }

            return res.send({ status: 200, message: 'Company all get successfully.', company })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting companies:", error);
        res.send({ message: "Something went wrong while getting companies!" })
    }
}

exports.updateCompanyDetails = async (req, res) => {
    try {
        if(req.user.role == 'Superadmin') {
            const companyId = req.params.id

            const company = await Company.findOne({
                _id: companyId,
                isDeleted: { $ne: true }
            });

            if (!company) {
                return res.send({ status: 404, message: 'Company not found' })
            }

            let {
                companyDetails,
                employeeSettings,
                contractDetails
            } = req.body

            const updatedCompanyDetails = {
                companyCode: companyDetails?.companyCode || company?.companyDetails?.companyCode,
                businessName: companyDetails?.businessName || company?.companyDetails?.businessName,
                companyLogo: companyDetails?.companyLogo || company?.companyDetails?.companyLogo,
                companyRegistrationNumber: companyDetails?.companyRegistrationNumber || company?.companyDetails?.companyRegistrationNumber,
                payeReferenceNumber: companyDetails?.payeReferenceNumber || company?.companyDetails?.payeReferenceNumber,
                address: companyDetails?.address || company?.companyDetails?.address,
                addressLine2: companyDetails?.addressLine2 || company?.companyDetails?.addressLine2,
                city: companyDetails?.city || company?.companyDetails?.city,
                postCode: companyDetails?.postCode || company?.companyDetails?.postCode,
                country: companyDetails?.country || company?.companyDetails?.country,
                timeZone: companyDetails?.timeZone || company?.companyDetails?.timeZone,
                contactPersonFirstname: companyDetails?.contactPersonFirstname || company?.companyDetails?.contactPersonFirstname,
                contactPersonMiddlename: companyDetails?.contactPersonMiddlename || company?.companyDetails?.contactPersonMiddlename,
                contactPersonLastname: companyDetails?.contactPersonLastname || company?.companyDetails?.contactPersonLastname,
                contactPersonEmail: companyDetails?.contactPersonEmail || company?.companyDetails?.contactPersonEmail,
                contactPhone: companyDetails?.contactPhone || company?.companyDetails?.contactPhone,
                adminToReceiveNotification: companyDetails?.adminToReceiveNotification || company?.companyDetails?.adminToReceiveNotification,
                additionalEmailsForCompliance: companyDetails?.additionalEmailsForCompliance || company?.companyDetails?.additionalEmailsForCompliance,
                pensionProvider: companyDetails?.pensionProvider || company?.companyDetails?.pensionProvider,
            }

            const updatedEmployeeSettinf = {
                payrollFrequency: employeeSettings?.payrollFrequency || company?.employeeSettings?.payrollFrequency,
                immigrationReminderDay1st: employeeSettings?.immigrationReminderDay1st || company?.employeeSettings?.immigrationReminderDay1st,
                immigrationReminderDay2nd: employeeSettings?.immigrationReminderDay2nd || company?.employeeSettings?.immigrationReminderDay2nd,
                immigrationReminderDay3rd: employeeSettings?.immigrationReminderDay3rd || company?.employeeSettings?.immigrationReminderDay3rd,
                holidayYear: employeeSettings?.holidayYear || company?.employeeSettings?.holidayYear,
                noticePeriodDays: employeeSettings?.noticePeriodDays || company?.employeeSettings?.noticePeriodDays,
                contactConfirmationDays: employeeSettings?.contactConfirmationDays || company?.employeeSettings?.contactConfirmationDays,
                rightToWorkCheckReminder: employeeSettings?.rightToWorkCheckReminder || company?.employeeSettings?.rightToWorkCheckReminder,
                holidaysExcludingBank: employeeSettings?.holidaysExcludingBank || company?.employeeSettings?.holidaysExcludingBank,
                sickLeaves: employeeSettings?.sickLeaves || company?.employeeSettings?.sickLeaves,
            }

            const updateContractDetails = {
                startDate: contractDetails?.startDate || company?.contractDetails?.startDate,
                endDate: contractDetails?.endDate || company?.contractDetails?.endDate,
                maxEmployeesAllowed: contractDetails?.maxEmployeesAllowed || company?.contractDetails?.maxEmployeesAllowed,
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

            return res.send({ status: 200, message: 'Company details updated successfully.', updatedCompany })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while updating company details:", error);
        res.send({ message: "Something went wrong while updating company details!" })
    }
}

exports.deleteCompany = async (req, res) => {
    try {
        if(req.user.role == 'Superadmin') {
            const companyId = req.params.id

            const company = await Company.findOne({
                _id: companyId,
                isDeleted: { $ne: true }
            });

            if (!company) {
                return res.send({ status: 404, message: 'Company not found' })
            }

            let deletedCompany = await Company.findByIdAndUpdate(companyId, {
                $set: {
                    isDeleted: true,
                    canceledAt: new Date()
                }
            })

            return res.send({ status: 404, message: 'Company deleted successfully.', deletedCompany })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing company:", error);
        res.send({ message: "Something went wrong while removing company!" })
    }
}
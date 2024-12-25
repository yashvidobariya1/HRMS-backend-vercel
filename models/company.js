const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean, default: false
    },
    companyDetails: {
        companyCode: String,
        businessName: String,
        companyLogo: String,
        companyRegistrationNumber: String,
        payeReferenceNumber: String,
        address: String,
        addressLine2: String,
        city: String,
        postCode: String,
        country: String,
        timeZone: String,
        contactPersonFirstname: String,
        contactPersonMiddlename: String,
        contactPersonLastname: String,
        contactPersonEmail: String,
        contactPhone: String,
        adminToReceiveNotification: String,
        additionalEmailsForCompliance: String,
        pensionProvider: String,
    },
    employeeSettings: {
        payrollFrequency: String,
        immigrationReminders: {
            day1st: String,
            day2nd: String,
            day3rd: String
        },
        holidayYear: String,
        noticePeriodDays: String,
        contactConfirmationDays: String,
        rightToWorkCheckReminder: String,
        leaveEntitlements: {
            holidaysExcludingBank: String,
            sickLeaves: String
        },
    },
    contractDetails: {
        startDate: String,
        endDate: String,
        maxEmployeesAllowed: String,
    },
    canceledAt: Date
}, { timestamps: true });

const Company = mongoose.model('Company', companySchema);

module.exports = Company;

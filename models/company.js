const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean, default: false
    },
    companyDetails: {
        companyCode: String,
        businessName: String,
        companyLogo: {
            fileId: String,
            fileName: String,
            fileURL: String,
        },
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
        immigrationReminderDay1st: Number,
        immigrationReminderDay2nd: Number,
        immigrationReminderDay3rd: Number,
        holidayYear: String,
        noticePeriodDays: Number,
        contactConfirmationDays: Number,
        rightToWorkCheckReminder: Number,
        holidaysExcludingBank: Number,
        sickLeaves: Number
    },
    contractDetails: {
        startDate: String,
        endDate: String,
        maxEmployeesAllowed: Number,
    },
    canceledAt: Date
}, { timestamps: true });

const Company = mongoose.model('Company', companySchema);

module.exports = Company;

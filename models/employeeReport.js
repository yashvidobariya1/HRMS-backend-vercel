const mongoose = require('mongoose');

const EmployeeReportSchema = new mongoose.Schema(
    {
        isDeleted: {
            type: Boolean,
            default: false,
        },
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client'
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company'
        },
        reportFrequency: {
            type: String,
            enum: ['Daily', 'Weekly', 'Monthly'],
        },
        startDate: String,
        endDate: String,
        links: [{
            email: String,
            link: String,
            token: String
        }],
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        },
        actionBy: String,
        rejectionReason: String,
        // employees: [{
        //     userId: {
        //         type: mongoose.Schema.Types.ObjectId,
        //         ref: 'User'
        //     },
        //     jobId: mongoose.Schema.Types.ObjectId,
        //     jobTitle: String,
        //     jobRole: String,
        //     status: {
        //         type: String,
        //         enum: ['Pending', 'Approved', 'Rejected'],
        //         default: 'Pending'
        //     },
        //     rejectionReason: String
        // }],
        // token: String,
        // createdBy: String,
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }, { timestamps: true }
)

const EmployeeReport = mongoose.model('EmployeeReport', EmployeeReportSchema)

module.exports = EmployeeReport

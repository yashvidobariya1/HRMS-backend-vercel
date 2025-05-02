const mongoose = require('mongoose')

const RecruitmentJobSchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean,
        default: false
    },
    jobPhoto: String,
    jobTitle: String, // required
    jobDescription: String, // required
    jobLocation: String,

    jobCategory: String,
    jobApplyTo: String,
    // jobStatus: String, // required
    companyId: {
        type: String,
        ref: 'Company'
    },
    locationId: {
        type: String,
        ref: 'Location'
    },
    companyWebSite: String,
    companyEmail: String, // required
    // companyContactNumber: String,
    email: String,
    totalApplicants: {
        type: Number,
        default: 0
    },
    jobPostedLink: String,
    jobUniqueKey: String,
    createdBy: String, // creator role
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    canceledAt: Date,
    
}, { timestamps: true })

const RecruitmentJob = mongoose.model('RecruitmentJob', RecruitmentJobSchema)

module.exports = RecruitmentJob
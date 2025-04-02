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
    jobStatus: String, // required
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
    },
    companyWebSite: String,
    companyEmail: String, // required
    companyContactNumber: Number,
    totalApplicant: Number,
    jobPostedLink: String,
    jobUniqueKey: String,
    createdBy: String, // creator role
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
    
}, { timestamps: true })

const RecruitmentJob = mongoose.model('RecruitmentJob', RecruitmentJobSchema)

module.exports = RecruitmentJob
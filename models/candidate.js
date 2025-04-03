const mongoose = require('mongoose')

const CandidateSchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean,
        default: false
    },
    jobPostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RecruitmentJob',
    },
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
    candidateResume: String,
    canceledAt: Date,
    
}, { timestamps: true })

const Candidate = mongoose.model('Candidate', CandidateSchema)

module.exports = Candidate
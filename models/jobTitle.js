const mongoose = require('mongoose')

const jobTitlesSchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean,
        default: false
    },
    name: String,
    isActive: {
        type: Boolean,
        default: true
    },
    canceledAt: Date,
}, { timestamps: true })

const JobTitles = mongoose.model('JobTitles', jobTitlesSchema)

module.exports = JobTitles

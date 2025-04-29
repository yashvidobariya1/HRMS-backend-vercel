const mongoose = require('mongoose')

const jobTitlesSchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean,
        default: false
    },
    name: String,
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Inactive'
    },
    canceledAt: Date,
}, { timestamps: true })

const JobTitles = mongoose.model('JobTitles', jobTitlesSchema)

module.exports = JobTitles

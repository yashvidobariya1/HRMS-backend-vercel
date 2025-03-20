const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
    {
        isDeleted: {
            type: Boolean,
            default: false
        },
        taskName: String,
        taskType: String,
        taskDescription: String,
        startDate: String,
        startTime: String,
        endDate: String,
        endTime: String,
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company'
        },
        locationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Location'
        },
        status: {
            type: String,
            enum: ['Pending', 'Completed', 'Assigned'],
            default: 'Pending'
        },
        creatorBy: String,
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        canceledAt: Date
    }, { timestamps: true }
)

const Task = mongoose.model('Task', TaskSchema)

module.exports = Task

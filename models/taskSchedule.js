const mongoose = require('mongoose');

const TaskScheduleSchema = new mongoose.Schema(
    {
        isDeleted: {
            type: Boolean,
            default: false
        },
        users: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            jobId: mongoose.Schema.Types.ObjectId,
            taskStatus: {
                type: String,
                enum: ['Pending', 'Completed'],
                default: 'Pending'
            }
        }],
        assignedTask: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task'
        },
        startDate: String,
        startTime: String,
        endDate: String,
        endTime: String,
        assignedBy: String,
        assignerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ["Assigned", "Completed", "Cancelled"],
            default: "Assigned"
        },
        canceledAt: Date,
    }, { timestamps: true }
)

const TaskSchedule = mongoose.model('TaskSchedule', TaskScheduleSchema)

module.exports = TaskSchedule

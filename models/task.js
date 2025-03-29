const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
    {
        isDeleted: {
            type: Boolean,
            default: false
        },
        taskName: String,
        taskDescription: String,
        taskDate: String,
        startTime: String,
        endTime: String,
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        jobId: mongoose.Schema.Types.ObjectId,
        status: {
            type: String,
            enum: ['Assigned', 'Cancelled'],
            default: 'Assigned'
        },
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        canceledAt: Date
    }, { timestamps: true }
)
// const TaskSchema = new mongoose.Schema(
//     {
//         isDeleted: {
//             type: Boolean,
//             default: false
//         },
//         taskName: String,
//         taskType: String,
//         taskDescription: String,
//         startDate: String,
//         startTime: String,
//         endDate: String,
//         endTime: String,
//         companyId: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Company'
//         },
//         locationId: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Location'
//         },
//         status: {
//             type: String,
//             enum: ['Pending', 'Completed', 'Assigned'],
//             default: 'Pending'
//         },
//         createdBy: String,
//         creatorName: String,
//         creatorId: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User'
//         },
//         canceledAt: Date
//     }, { timestamps: true }
// )

const Task = mongoose.model('Task', TaskSchema)

module.exports = Task

const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    userName: String,
    userEmail: String,
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    leaveType: String,
    slectionDuration: String,
    startDate: String,
    endDate: String,
    leaveDays: String,
    reasonOfLeave: String,
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    isPaidLeave: Boolean,
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approverRole: String,
    approvalReason: String,
    rejectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectorRole: String,
    rejectionReason: String
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);


// const mongoose = require('mongoose');

// const leaveRequestSchema = new mongoose.Schema({
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     userName: String,
//     userEmail: String,
//     leaveType: String,
//     startDate: String,
//     endDate: String,
//     reason: String,
//     companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
//     locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
//     status: {
//         type: String,
//         enum: ['Pending', 'Approved', 'Rejected'],
//         default: 'pending'
//     },
//     leaveDays: {
//         type: Number,
//     }
// }, { timestamps: true });

// module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);

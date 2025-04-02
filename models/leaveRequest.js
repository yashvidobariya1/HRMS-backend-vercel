const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    jobId: mongoose.Schema.Types.ObjectId,
    // userName: String,
    userEmail: String,
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    leaveType: String,
    selectionDuration: String,
    startDate: String,
    endDate: String,
    totalLeaveDays: Number,
    numberOfApproveLeaves: Number,
    leaves: [{
        leaveDate: String,
        leaveType: String,
        isPaidLeave: Boolean,
        isHalfPaidLeave: Boolean,
        isApproved: { type: Boolean, default: false }
    }],
    reasonOfLeave: String,
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    // isPaidLeave: Boolean,
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approverRole: String,
    approvalReason: String,
    rejectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectorRole: String,
    rejectionReason: String,
    isDeleted: { type: Boolean, default: false }
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

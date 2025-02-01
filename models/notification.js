const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    notifiedId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    type: String,
    message: String,
    readBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: String,
        isRead: { type: Boolean, default: false },
        readAt: Date,
    }]
},{ timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
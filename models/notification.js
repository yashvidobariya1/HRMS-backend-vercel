const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notifiedId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    type: String,
    message: String,
    isRead: { type: Boolean, default: false }
},{ timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
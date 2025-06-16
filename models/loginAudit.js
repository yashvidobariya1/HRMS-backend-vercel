const mongoose = require('mongoose')

const loginAuditSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    reason: { type: String, default: 'Login attempt' },
    attemptTime: Date,
    isLoggedIn: Boolean,
    lastTimeAccess: Date,
    lastTimeLoggedIn: Date,
    lastTimeLoggedOut: Date,
    ipAddress: { type: String, default: '' },
    browser: { type: String, default: '' },
}, { timestamps: true })

const LoginAudit = mongoose.model('LoginAudit', loginAuditSchema)

module.exports = LoginAudit

const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    templateName: String,
    isDeleted: {
        type: Boolean,
        default: false
    },
    template: String,
    templateFileName: String,
    createdRole: String,
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    uploadBy: String,
    // companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    // companyName: String,
    canceledAt: Date
}, { timestamps: true });

const Template = mongoose.model('Templates', templateSchema);

 module.exports = Template
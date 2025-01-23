const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    contractName: String,
    isDeleted: {
        type: Boolean,
        default: false
    },
    contract: {
        fileId: String,
        fileName: String,
        fileURL: String,
    },
    createdRole: {
        type: String
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId
    },
    uploadBy: String,
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    companyName: String
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);
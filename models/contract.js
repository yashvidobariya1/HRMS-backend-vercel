const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    contractName: String,
    isDeleted: {
        type: Boolean,
        default: false
    },
    contract: String,
    contractFileName: String,
    createdRole: {
        type: String
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId
    },
    uploadBy: String,
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    companyName: String,
    cancelAt: Date
}, { timestamps: true });

const Contract= mongoose.model('Contract', contractSchema);

module.exports = Contract
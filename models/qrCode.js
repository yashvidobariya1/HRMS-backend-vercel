const mongoose = require('mongoose');

const QRCodeSchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean,
        default: false
    },
    isCompanyQR: {
        type: Boolean,
        default: false
    },
    isLocationQR: {
        type: Boolean,
        default: false
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
    },
    valueOfQRCode: {
        qrId: String,
        qrURL: String,
        qrValue: String,
        qrType: String,
    },
}, { timestamps: true });

module.exports = mongoose.model('QRCode', QRCodeSchema)
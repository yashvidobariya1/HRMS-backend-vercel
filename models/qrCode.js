const mongoose = require('mongoose');

const QRCodeSchema = new mongoose.Schema({
    // isDeleted: {
    //     type: Boolean,
    //     default: false
    // },
    isActive: Boolean,
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
    companyName: String,
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
    },
    locationName: String,
    qrURL: String,
    qrValue: String,
    qrType: String,
}, { timestamps: true });

module.exports = mongoose.model('QRCode', QRCodeSchema)
const mongoose = require('mongoose')

const clientSchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean, default: false
    },
    clientName: String,
    contactNumber: String,
    email: [{
        type: String
    }],
    address: String,
    addressLine2: String,
    city: String,
    country: String,
    postCode: String,
    latitude: String,
    longitude: String,
    radius: String,
    QRCodeImage: String,
    breakTime: Number,
    graceTime: Number,
    isAutoGenerateReport: { type: Boolean },
    reportFrequency: {
        type: String,
        enum: ['Daily', 'Weekly', 'Monthly'],
    },
    reportTime: String,
    weekday: String,
    monthDate: String,
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
    },
    // locationId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Location'
    // },
    createdBy: String,
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    canceledAt: Date
}, { timestamps: true })

const Client = mongoose.model('Client', clientSchema)

module.exports = Client

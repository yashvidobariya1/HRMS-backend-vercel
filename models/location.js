const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
    isDeleted: {
        type: Boolean, default: false
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
    },
    payeReferenceNumber: String,
    locationName: String,
    address: String,
    addressLine2: String,
    city: String,
    postcode: String,
    country: String,
    ukviApproved: { type: Boolean, default: false },
    canceledAt: Date,
}, { timestamps: true });

const Location = mongoose.model("Location", locationSchema);

module.exports = Location;
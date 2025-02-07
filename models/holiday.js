const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company'
        },
        locationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Location'
        },
        date: String,
        occasion: String,
        // Department: [{
        //     type: String
        // }],
        // user_Type:[{
        //     type: String
        // }],
        isDeleted: {
            type: Boolean,
            default: false
        },
        canceledAt: Date
    }, { timestamps: true }
)

const Holiday = mongoose.model('Holiday', HolidaySchema)

module.exports = Holiday

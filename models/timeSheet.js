const mongoose = require('mongoose');

const TimesheetSchema = new mongoose.Schema(
    {
        isDeleted: {
            type: Boolean,
            default: false
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        jobId: mongoose.Schema.Types.ObjectId,
        locationId: String,
        clientId: String,
        date: {
            type: String,
        },
        isTimerOn: {
            type: Boolean,
            default: false
        },
        clockinTime: [{
            clockIn: Date,
            isDeleted: {
                type: Boolean,
                default: false
            },
            comment: {
                type: String,
                default: "",
            },
            clockOut: {
                type: Date
            },
            totalTiming: {
                type: String,
                default: 0
            },
            isClockin: {
                type: Boolean,
                default: false
            }
        }],
        breakTimeDeducted: {
            type: Boolean,
            default: false
        },
        totalHours: {
            type: String,
            default: "0h 0m 0s"
        },
        isOverTime: { type: Boolean, default: false },
        overTime: {
            type: String,
            default: "0h 0m 0s"
        }
    }, {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                if (ret.clockinTime) {
                    ret.clockinTime.forEach(entry => {
                        if (entry.clockOut === null) {
                            entry.clockOut = "";
                        }
                    });
                }
                return ret;
            }
        }
    }
)

const Timesheet = mongoose.model('Timesheet', TimesheetSchema)

module.exports = Timesheet

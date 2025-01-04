const mongoose = require('mongoose');

const TimesheetSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        isTimerOn: {
            type: Boolean,
            default: false
        },
        date: {
            type: String,
        },
        clockingTime: [{
            clockIn: Date,
            clockOut: {
                type: Date,
                // default: ""
            },
            totalTiming: {
                type: String,
                default: 0
            }
        }],
        totalHours: {
            type: String,
            default: 0
        },
        overTime: {
            type: Number,
            default: 0
        }
    }, {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                if (ret.clockingTime) {
                    ret.clockingTime.forEach(entry => {
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

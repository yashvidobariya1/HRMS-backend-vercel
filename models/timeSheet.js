const mongoose = require('mongoose');

const TimesheetSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        date: {
            type: String,
        },
        isTimerOn: {
            type: Boolean,
            default: false
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
            },
            isClocking: {
                type: Boolean,
                default: false
            }
        }],
        totalHours: {
            type: String,
            default: "0h 0m 0s"
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

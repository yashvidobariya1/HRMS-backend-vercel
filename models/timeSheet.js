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
        clockinTime: [{
            clockIn: Date,
            clockOut: {
                type: Date,
                // default: ""
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

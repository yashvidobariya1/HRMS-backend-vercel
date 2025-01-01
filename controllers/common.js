// const { default: axios } = require("axios");
const User = require("../models/user");
const bcrypt = require("bcrypt");
// const Timesheet = require("../models/timeSheet");

exports.login = async (req, res) => {
    try {
        if (!req.body.email || !req.body.password) {
            return res.send({ status: 400, message: "Email and password are required" });
        }

        const isExist = await User.findOne({ "personalDetails.email": req.body.email, isDeleted: false });

        if (!isExist) {
            return res.send({ status: 404, message: "User not found" });
        }
        if (isExist.personalDetails.password == req.body.password) {
            return res.send({
                status: 200,
                message: "User login successfully",
                user: isExist.toJSON(),
            });
        } else {
            const hashedPassword = isExist.personalDetails.password;
            await bcrypt.compare(req.body.password, hashedPassword, async (err, result) => {
                if (err) {
                    console.error("Error comparing passwords:", err);
                    return res.send({ status: 500, message: "Internal server error" });
                }
                if (!result) {
                    return res.send({ status: 404,message: "Password does not match" });
                }
                return res.send({
                    status: 200,
                    message: "User login successfully",
                    user: isExist.toJSON(),
                });
            });
        }
    } catch (error) {
        console.error("Error occurred while logging in:", error);
        return res.send({ message: error.message })
    }
};

exports.forgotPassword = async (req, res) => {
    try {

        const { email, newPassword } = req.body
        const user = await User.findOne({
            "personalDetails.email": email,
            isDeleted: false
        })
        if (!user) {
            return res.json({ status: 404, message: "User not found" })
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.personalDetails.password = hashedPassword
        await user.save()
        res.send({ status: 404, message: "Password updated successfully." })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
        return res.send({ status: 200, message: 'Users get successfully.', users })
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}

// const geolib = require('geolib')
// exports.clockInFunc = async (req, res) => {
//     try {
        
//         // first method for get user's location
        
//         // const { userId } = req.body;

//         // const user = await User.findById(userId)

//         // if (!user) {
//         //     return res.json({ status: 404, message: "User not found" })
//         // }

//         // const ip = req.headers['ip']
//         // const ipInfoToken = "5340022e70f960"
        
//         // const response = await axios.get(`https://ipinfo.io/${ip}?token=${ipInfoToken}`)
//         // console.log('response/...', response)
//         // const locData = response.data
//         // let latitude = locData.loc.split(',')[0]
//         // let longitude = locData.loc.split(',')[1]



//         // secound method for get user's location

//         const { userId, location } = req.body

//         const existUser = await User.findById(userId)

//         if (!existUser) {
//             return res.json({ status: 404, message: "User not found" })
//         }

//         if (location && location.latitude && location.longitude) {
//             console.log('User location:', location)
//             await User.updateOne(
//                 { _id: existUser._id },
//                 { $set: { lastKnownLocation: location } }
//             )
//         }

//         const GEOFENCE_CENTER = { latitude: 21.1959, longitude: 72.8302 }
//         const GEOFENCE_RADIUS = 100 // meters

//         let latitude = location.latitude
//         let longitude = location.longitude

//         if (!geolib.isPointWithinRadius(
//             { latitude, longitude },
//             GEOFENCE_CENTER,
//             GEOFENCE_RADIUS
//         )) {
//             return res.status(403).json({ message: 'You are outside the geofence area.' });
//         }

//         const timesheet = new Timesheet({
//             userId,
//             clockingTime: {
//                 clockIn: new Date()
//             },
//             location: { latitude, longitude },
//         });

//         try {
//             await timesheet.save();
//             res.status(200).json(timesheet);
//         } catch (error) {
//             res.status(500).json({ message: 'Error clocking in', error });
//         }

//     } catch (error) {
//         console.log('Error:', error)
//         return res.send({ message: error.message })
//     }
// }

// exports.clockInFunc = async (req, res) => {
//     try {
//         const { userId, location } = req.body;

//         // Check if user exists
//         const existUser = await User.findById(userId);
//         if (!existUser) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         // Validate location
//         if (!location || !location.latitude || !location.longitude) {
//             return res.status(400).json({ message: "Invalid location data" });
//         }

//         // Update user's last known location
//         await User.updateOne(
//             { _id: existUser._id },
//             { $set: { lastKnownLocation: location } }
//         );

//         // Geofence check
//         const GEOFENCE_CENTER = { latitude: 21.1959, longitude: 72.8302 };
//         const GEOFENCE_RADIUS = 100; // meters

//         if (!geolib.isPointWithinRadius(
//             { latitude: location.latitude, longitude: location.longitude },
//             GEOFENCE_CENTER,
//             GEOFENCE_RADIUS
//         )) {
//             return res.status(403).json({ message: 'You are outside the geofence area.' });
//         }

//         // Find existing timesheet for the day
//         const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
//         let timesheet = await Timesheet.findOne({ userId, date: currentDate });

//         if (!timesheet) {
//             // Create a new timesheet for the day if it doesn't exist
//             timesheet = new Timesheet({
//                 userId,
//                 date: currentDate,
//                 clockingTime: [],
//                 totalHours: 0
//             });
//         }

//         const lastClocking = timesheet.clockingTime[timesheet.clockingTime.length - 1];

//         if (lastClocking && !lastClocking.clockOut) {
//             return res.status(400).json({ message: "Please clock out before clocking in again." });
//         }

//         // Add a new clock-in entry
//         timesheet.clockingTime.push({ clockIn: new Date(), location });

//         await timesheet.save();

//         return res.status(200).json(timesheet);
//     } catch (error) {
//         console.error('Error:', error);
//         return res.status(500).json({ message: error.message });
//     }
// };

// exports.clockOutFunc = async (req, res) => {
//     try {
//         const { userId } = req.body;

//         // Find today's timesheet
//         const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
//         const timesheet = await Timesheet.findOne({ userId, date: currentDate });

//         if (!timesheet) {
//             return res.status(404).json({ message: "No timesheet found for today." });
//         }

//         const lastClocking = timesheet.clockingTime[timesheet.clockingTime.length - 1];

//         if (!lastClocking || lastClocking.clockOut) {
//             return res.status(400).json({ message: "No active clock-in to clock out from." });
//         }

//         // Record clock-out time
//         lastClocking.clockOut = new Date();

//         // Calculate total hours
//         const clockInTime = new Date(lastClocking.clockIn);
//         const clockOutTime = new Date(lastClocking.clockOut);
//         const duration = (clockOutTime - clockInTime) / (1000 * 60 * 60); // Hours

//         timesheet.totalHours += duration;

//         await timesheet.save();

//         return res.status(200).json(timesheet);
//     } catch (error) {
//         console.error('Error:', error);
//         return res.status(500).json({ message: error.message });
//     }
// };
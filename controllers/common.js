const User = require("../models/user");
const bcrypt = require("bcrypt");

exports.login = async (req, res) => {
    try {
        if (!req.body.email || !req.body.password) {
            return res.status(400).send({ message: "Email and password are required" });
        }

        const isExist = await User.findOne({ "personalDetails.email": req.body.email, isDeleted: false });

        if (!isExist) {
            return res.status(404).send({ message: "User not found" });
        }
        if (isExist.personalDetails.password == req.body.password) {
            return res.status(200).send({
                message: "User login successfully",
                user: isExist.toJSON(),
            });
        } else {
            const hashedPassword = isExist.personalDetails.password;
            bcrypt.compare(req.body.password, hashedPassword, (err, result) => {
                if (err) {
                    console.error("Error comparing passwords:", err);
                    return res.status(500).send({ message: "Internal server error" });
                }
                if (!result) {
                    return res.status(404).send({ message: "Password does not match" });
                }
                return res.status(200).send({
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
            return res.status(404).json({ message: "User not found" })
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.personalDetails.password = hashedPassword
        await user.save()
        res.status(200).send({ message: "Password updated successfully." })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
        return res.status(200).send({ message: 'Users get successfully.', users })
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}
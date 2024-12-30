const User = require("../models/user");
const bcrypt = require("bcrypt");

exports.login = async (req, res) => {
    try {
        if (!req.body.email || !req.body.password) {
            return res.status(400).send({ message: "Email and password are required" });
        }

        const isExist = await User.findOne({ "personalDetails.email": req.body.email });

        if (!isExist || isExist.isDeleted) {
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
                if (result) {
                    return res.status(200).send({
                        message: "User login successfully",
                        user: isExist.toJSON(),
                    });
                } else {
                    console.error("Error comparing passwords:", err);
                    return res.status(500).send({ message: "Password does not match" });
                }
            });
        }
    } catch (error) {
        console.error("Error occurred while logging in:", error);
        return res.status(500).send({ message: error.message });
    }
};

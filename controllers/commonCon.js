const User = require("../models/user")
const bcrypt = require('bcrypt')

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
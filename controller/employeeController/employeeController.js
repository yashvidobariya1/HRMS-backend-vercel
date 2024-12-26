const User = require("../../models/user")


exports.getDetails = async (req, res) => {
    // try {
    //     // if(req.user.role == 'Employee') {
    //         const employeeId = req.user._id
    //         const employee = await User.findOne({
    //             _id: employeeId,
    //             isDeleted: { $ne: true },
    //         });
    //         if(!employee) {
    //             return res.status(404).json({ message: 'Employee not found' })
    //         }
    //         return res.status(200).send(employee)
    //     // } else return res.status(401).send('You can not authorize for this action.')
    // } catch (error) {
    //     console.log('Error:', error)
    //     return res.send(error.message)
    // }
}
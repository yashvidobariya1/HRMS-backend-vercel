const User = require('../models/user')
const bcrypt = require('bcrypt')
const { transporter } = require('../utils/nodeMailer')
const cloudinary = require('../utils/cloudinary');
const moment = require('moment')

exports.addManager = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         let {
    //             personalDetails,
    //             addressDetails,
    //             kinDetails,
    //             financialDetails,
    //             jobDetails,
    //             companyId,
    //             // locationId,
    //             immigrationDetails,
    //             documentDetails,
    //             contractDetails
    //         } = req.body

    //         if (personalDetails && personalDetails.email) {
    //             const user = await User.findOne({ "personalDetails.email": personalDetails.email })
    //             if (user) {
    //                 return res.send({ status: 409, message: "Email already exists." });
    //             }
    //         }

    //         let locationIds = []
    //         if(jobDetails){
    //             jobDetails.forEach(JD => {
    //                 locationIds.push(JD.location)
    //             })
    //         }

    //         let documentDetailsFile = []
    //         if (documentDetails && Array.isArray(documentDetails)) {
    //             for (let i = 0; i < documentDetails.length; i++) {
    //                 const document = documentDetails[i].document;

    //                 if (!document || typeof document !== 'string') {
    //                     console.log(`Invalid or missing document for item ${i}`)
    //                 }
    //                 try {
    //                     let element = await cloudinary.uploader.upload(document, {
    //                         resource_type: "auto",
    //                         folder: "contracts",
    //                     });
    //                     // console.log('Cloudinary response:', element);
    //                     documentDetailsFile.push({
    //                         documentType: documentDetails[i].documentType,
    //                         document: {
    //                             fileURL: element.secure_url,
    //                             fileName: documentDetails[i].fileName,
    //                         }                            
    //                     })
    //                 } catch (uploadError) {
    //                     console.error("Error occurred while uploading file to Cloudinary:", uploadError);
    //                     return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
    //                 }
    //             }
    //         }

    //         let contractDetailsFile
    //         if (contractDetails) {
    //             const document = contractDetails.contractDocument
    //             if (!document || typeof document !== 'string') {
    //                 console.log('Invalid or missing contract document')
    //             }
    //             try {
    //                 let element = await cloudinary.uploader.upload(document, {
    //                     resource_type: "auto",
    //                     folder: "contracts",
    //                 });
    //                 // console.log('Cloudinary response:', element);
    //                 contractDetailsFile = {
    //                     contractType: contractDetails.contractType,
    //                     contractDocument: {
    //                         fileURL: element.secure_url,
    //                         fileName: contractDetails.fileName,
    //                     }
    //                 };
    //             } catch (uploadError) {
    //                 console.error("Error occurred while uploading file to Cloudinary:", uploadError);
    //                 return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
    //             }
    //         }

    //         const generatePass = () => {
    //             const fname = `${personalDetails.firstName}`
    //             const capitalizeWords = (username) => username.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    //             const formatName = capitalizeWords(fname)
    //             const uname = formatName[0]
    //             // console.log('uname', uname)
    //             const lastFourDigits = personalDetails.phone.slice(-4)
    //             // console.log('lastFourDigits', lastFourDigits)
    //             const pass = `${uname}@${lastFourDigits}`
    //             // console.log('pass', pass)
    //             return pass
    //         }

    //         const pass = generatePass()
    //         const hashedPassword = await bcrypt.hash(pass, 10)

    //         if (personalDetails.sendRegistrationLink == true) {
    //             let mailOptions = {
    //                 from: process.env.NODEMAILER_EMAIL,
    //                 to: personalDetails.email,
    //                 subject: "Welcome to [Company Name]'s HRMS Portal",
    //                 html: `
    //                     <p>Dear ${personalDetails.firstName} ${personalDetails.lastName},</p>
    
    //                     <p>Welcome to HRMS Portal!</p>
    
    //                     <p>We are pleased to inform you that a new manager account has been successfully created by the Administrator under your supervision in the HRMS portal. Below are the details:</p>
    
    //                     <ul>
    //                         <li><b>Name:</b> ${personalDetails.firstName} ${personalDetails.lastName}</li>
    //                         <li><b>Email:</b> ${personalDetails.email}</li>
    //                         <li><b>Position:</b> ${jobDetails[0].jobTitle}</li>
    //                         <li><b>Joining Date:</b> ${jobDetails[0].joiningDate}</li>
    //                     </ul>
    
    //                     <p>Please ensure the manager logs into the HRMS portal using their temporary credentials and updates their password promptly. Here are the login details for their reference:</p>
    
    //                     <ul>
    //                         <li><b>HRMS Portal Link:</b> <a href="https://example.com">HRMS Portal</a></li>
    //                         <li><b>Username/Email:</b> ${personalDetails.email}</li>
    //                         <li><b>Temporary Password:</b> ${generatePass()}</li>
    //                     </ul>
    
    //                     <p>If you have any questions or need further assistance, feel free to reach out to the HR department.</p>
    
    //                     <p>Looking forward to your journey with us!</p>
    
    //                     <p>Best regards,<br>HRMS Team</p>
    //                 `
    //             }
    //             transporter.sendMail(mailOptions);
    //         }

    //         const newManager = {
    //             personalDetails,
    //             addressDetails,
    //             kinDetails,
    //             financialDetails,
    //             jobDetails,
    //             companyId,
    //             locationId: locationIds,
    //             immigrationDetails,
    //             role: jobDetails[0]?.role,
    //             password: hashedPassword,
    //             documentDetails: documentDetailsFile,
    //             contractDetails: contractDetailsFile,
    //             createdBy: req.user.role,
    //             creatorId: req.user._id,
    //         }

    //         // console.log('new manager', newManager)
    //         const manager = await User.create(newManager)

    //         return res.send({ status: 200, message: 'Manager created successfully.', manager })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while adding manager:", error);
    //     res.send({ message: "Something went wrong while adding manager!" })
    // }
}

exports.getManager = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const managerId = req.params.id
    //         if (!managerId || managerId == 'undefined' || managerId == 'null') {
    //             return res.send({ status: 404, message: 'Manager not found' })
    //         }
    //         const manager = await User.findOne({
    //             _id: managerId,
    //             isDeleted: { $ne: true }
    //         })

    //         if (!manager) {
    //             return res.send({ status: 404, message: 'Manager not found' })
    //         }

    //         return res.send({ status: 200, message: 'Manager get successfully.', manager })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while getting manager:", error);
    //     res.send({ message: "Something went wrong while getting manager!" })
    // }
}

exports.getAllManager = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 10

    //         const skip = (page - 1) * limit
    //         const managers = await User.find({ role: "Manager", isDeleted: { $ne: true } }).skip(skip).limit(limit)

    //         const totalManagers = await User.find({ role: "Manager", isDeleted: { $ne: true } }).countDocuments()

    //         return res.send({
    //             status: 200,
    //             message: 'Manager all get successfully.',
    //             managers,
    //             totalManagers,
    //             totalPages: Math.ceil(totalManagers / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while getting managers:", error);
    //     res.send({ message: "Something went wrong while getting managers!" })
    // }
}

exports.updateManagerDetails = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const managerId = req.params.id

    //         const manager = await User.findOne({
    //             _id: managerId,
    //             isDeleted: { $ne: true }
    //         })
    //         // console.log('manager/...', manager)

    //         if (!manager) {
    //             return res.send({ status: 404, message: 'Manager not found' })
    //         }

    //         let {
    //             personalDetails,
    //             addressDetails,
    //             kinDetails,
    //             financialDetails,
    //             jobDetails,
    //             immigrationDetails,
    //             documentDetails,
    //             contractDetails,
    //         } = req.body

    //         if (personalDetails.email && manager.personalDetails.email != personalDetails.email) {
    //             const existingEmail = await User.findOne({ "personalDetails.email": personalDetails.email })
    //             if (existingEmail) {
    //                 return res.send({ status: 409, message: "Email already exists." });
    //             }
    //         }

    //         let locationIds = []
    //         if(jobDetails){
    //             jobDetails.forEach(JD => {
    //                 locationIds.push(JD.location)
    //             })
    //         }

    //         let documentDetailsFile = []
    //         if (documentDetails && Array.isArray(documentDetails)) {
    //             for (let i = 0; i < documentDetails.length; i++) {
    //                 const document = documentDetails[i].document;

    //                 if (!document || typeof document !== 'string') {
    //                     console.log(`Invalid or missing document for item ${i}`)
    //                 }
    //                 try {
    //                     let element = await cloudinary.uploader.upload(document, {
    //                         resource_type: "auto",
    //                         folder: "contracts",
    //                     });
    //                     // console.log('Cloudinary response:', element);
    //                     documentDetailsFile.push({
    //                         documentType: documentDetails[i].documentType,
    //                         document: {
    //                             fileURL: element.secure_url,
    //                             fileName: documentDetails[i].fileName,
    //                         }                            
    //                     })
    //                 } catch (uploadError) {
    //                     console.error("Error occurred while uploading file to Cloudinary:", uploadError);
    //                     return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
    //                 }
    //             }
    //         }

    //         let contractDetailsFile
    //         if (contractDetails) {
    //             const document = contractDetails.contractDocument
    //             if (!document || typeof document !== 'string') {
    //                 console.log('Invalid or missing contract document')
    //             }
    //             try {
    //                 let element = await cloudinary.uploader.upload(document, {
    //                     resource_type: "auto",
    //                     folder: "contracts",
    //                 });
    //                 // console.log('Cloudinary response:', element);
    //                 contractDetailsFile = {
    //                     contractType: contractDetails.contractType,
    //                     contractDocument: {
    //                         fileURL: element.secure_url,
    //                         fileName: contractDetails.fileName,
    //                     }
    //                 };
    //             } catch (uploadError) {
    //                 console.error("Error occurred while uploading file to Cloudinary:", uploadError);
    //                 return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
    //             }
    //         }

    //         let updateManager = await User.findByIdAndUpdate(
    //             { _id: managerId },
    //             {
    //                 $set: {
    //                     personalDetails,
    //                     addressDetails,
    //                     kinDetails,
    //                     financialDetails,
    //                     jobDetails,
    //                     locationId: locationIds,
    //                     immigrationDetails,
    //                     documentDetails: documentDetailsFile,
    //                     contractDetails: contractDetailsFile,
    //                     updatedAt: moment().toDate()
    //                 }
    //             }, { new: true }
    //         )

    //         return res.send({ status: 200, message: 'Manager details updated successfully.', updateManager })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while updating manager details:", error);
    //     res.send({ message: "Something went wrong while updating manager details!" })
    // }
}

exports.deleteManager = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const managerId = req.params.id

    //         const manager = await User.findOne({
    //             _id: managerId,
    //             isDeleted: { $ne: true }
    //         })

    //         if (!manager) {
    //             return res.send({ status: 404, message: 'Manager not found' })
    //         }

    //         let deletedManager = await User.findByIdAndUpdate(managerId, {
    //             $set: {
    //                 isDeleted: true,
    //                 canceledAt: moment().toDate()
    //             }
    //         })

    //         return res.send({ status: 200, message: 'Manager deleted successfully.', deletedManager })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while removing manager:", error);
    //     res.send({ message: "Something went wrong while removing manager!" })
    // }
}
const User = require("../models/user")
const bcrypt = require('bcrypt')
const { transporter } = require("../utils/nodeMailer");
const cloudinary = require('../utils/cloudinary');

exports.addEmployee = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
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

    //         const newEmployee = {
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
    //         if (personalDetails.sendRegistrationLink == true) {
    //             try {
    //                 let mailOptions = {
    //                     from: process.env.NODEMAILER_EMAIL,
    //                     to: newEmployee.personalDetails.email,
    //                     subject: "Welcome to [Company Name]'s HRMS Portal",
    //                     html: `
    //                         <p>Welcome to HRMS Portal!</p>

    //                         <p>We are pleased to inform you that a new employee account has been successfully created by the Manager under your supervision in the HRMS portal. Below are the details:</p>

    //                         <ul>
    //                             <li><b>Name:</b> ${personalDetails.firstName} ${personalDetails.lastName}</li>
    //                             <li><b>Email:</b> ${personalDetails.email}</li>
    //                             <li><b>Position:</b> ${jobDetails[0].jobTitle}</li>
    //                             <li><b>Joining Date:</b> ${jobDetails[0].joiningDate}</li>
    //                         </ul>

    //                         <p>Please ensure the employee logs into the HRMS portal using their temporary credentials and updates their password promptly. Here are the login details for their reference:</p>

    //                         <ul>
    //                             <li><b>HRMS Portal Link:</b> <a href="https://example.com">HRMS Portal</a></li>
    //                             <li><b>Username/Email:</b> ${personalDetails.email}</li>
    //                             <li><b>Temporary Password:</b> ${generatePass()}</li>
    //                         </ul>

    //                         <p>If you have any questions or need further assistance, feel free to reach out to the HR manager or HR department.</p>

    //                         <p>Looking forward to your journey with us!</p>

    //                         <p>Best regards,<br>HRMS Team</p>
    //                     `,
    //                 };

    //                 await transporter.sendMail(mailOptions);
    //                 // console.log('Email sent successfully');
    //             } catch (error) {
    //                 console.log('Error occurred:', error);
    //             }
    //         }
    //         // console.log('new employee', newEmployee)
    //         const employee = await User.create(newEmployee)

    //         return res.send({ status: 200, message: 'Employee created successfully.', employee })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while adding employee:", error);
    //     res.send({ message: "Something went wrong while adding employee!" })
    // }
}

exports.getEmployee = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const employeeId = req.params.id

    //         if (!employeeId || employeeId == 'undefined' || employeeId == 'null') {
    //             return res.send({ status: 404, message: 'Employee not found' })
    //         }

    //         const employee = await User.findOne({
    //             _id: employeeId,
    //             isDeleted: { $ne: true },
    //         });

    //         if (!employee) {
    //             return res.send({ status: 404, message: 'Employee not found' })
    //         }

    //         return res.send({ status: 200, message: 'Employee get successfully.', employee })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while getting employee:", error);
    //     res.send({ message: "Something went wrong while getting employee!" })
    // }
}

exports.getAllEmployees = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 10

    //         const skip = (page - 1) * limit

    //         const employees = await User.find({ role: 'Employee', isDeleted: { $ne: true } }).skip(skip).limit(limit)

    //         const totalEmployees = await User.find({ role: 'Employee', isDeleted: { $ne: true } }).countDocuments()
            
    //         return res.send({
    //             status: 200,
    //             message: 'Employee all get successfully.',
    //             employees,
    //             totalEmployees,
    //             totalPages: Math.ceil(totalEmployees / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while getting employees:", error);
    //     res.send({ message: "Something went wrong while getting employees!" })
    // }
}

exports.updateEmployee = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const employeeId = req.params.id

    //         const employee = await User.findOne({
    //             _id: employeeId,
    //             isDeleted: { $ne: true }
    //         });

    //         if (!employee) {
    //             return res.send({ status: 404, message: 'Employee not found' })
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

    //         if (personalDetails.email && employee.personalDetails.email != personalDetails.email) {
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

    //         let updatedEmployee = await User.findByIdAndUpdate(
    //             { _id: employeeId },
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
    //                     updatedAt: new Date()
    //                 }
    //             }, { new: true }
    //         )

    //         return res.send({ status: 200, message: 'Employee details updated successfully.', updatedEmployee })

    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while updating employee details:", error);
    //     res.send({ message: "Something went wrong while updating employee details!" })
    // }
}

exports.deleteEmployee = async (req, res) => {
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const employeeId = req.params.id

    //         const employee = await User.findOne({
    //             _id: employeeId,
    //             isDeleted: { $ne: true },
    //         });
    //         if (!employee) {
    //             return res.send({ status: 404, message: 'Employee not found' })
    //         }

    //         let deletedEmployee = await User.findByIdAndUpdate(employeeId, {
    //             $set: {
    //                 isDeleted: true,
    //                 canceledAt: new Date()
    //             }
    //         })

    //         return res.send({ status: 200, message: 'Employee deleted successfully.', deletedEmployee })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while removing employee:", error);
    //     res.send({ message: "Something went wrong while removing employee!" })
    // }
}
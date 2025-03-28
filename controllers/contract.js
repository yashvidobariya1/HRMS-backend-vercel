const Company = require("../models/company");
const Contract = require("../models/contract");
const cloudinary = require('../utils/cloudinary');
const User = require("../models/user");
const axios = require('axios');
const fs = require('fs');
// const FormData = require('form-data');
const pdfParse = require('pdf-parse');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// const pdfform = require('pdfform.js');
// const pdffiller = require("node-pdffiller");
const mammoth = require('mammoth')
const moment = require('moment');

exports.addContract = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {

            let {
                contractName,
                contract,
                companyId,
                contractFileName
            } = req.body

            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found.' })
            }

            if (!contractName || !contract) {
                return res.send({ status: 400, message: "Contract name and contract are required." });
            }

            if (contractName) {
                const existingContract = await Contract.findOne({ contractName, companyId, isDeleted: { $ne: true } });
                if (existingContract) {
                    return res.send({ status: 409, message: `A contract with the name ${contractName} already exists for this company.` });
                }
            }

            if (contract) {
                const document = contract;

                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing contract document');
                    return res.send({ status: 400, message: "Invalid or missing contract document." });
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "contracts",
                    });
                    // console.log('Cloudinary response:', element);
                    contract = element.secure_url
                } catch (uploadError) {
                    // console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const { firstName, lastName } = req.user.personalDetails;
            const name = [firstName, lastName].filter(Boolean).join(" ");
            const contractForm = {
                contractName,
                contract,
                contractFileName,
                createdRole: req.user.role,
                creatorId: req.user._id,
                uploadBy: name,
                companyId: companyId,
                companyName: company?.companyDetails?.businessName
            }
            // console.log('new contractForm', contractForm)
            let newContract = await Contract.create(contractForm)

            return res.send({ status: 200, message: `Contract form created successfully.`, newContract })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while adding contract form:", error);
        res.send({ message: "Something went wrong while adding contract form!" })
    }
}

// pending work

// const extractPlaceholders = (text) => {
//     const placeholderRegex = /{{(.*?)}}/g; // Match placeholders like {{employeeName}}
//     let matches = text.match(placeholderRegex);
//     return matches ? matches.map(match => match.replace(/{{|}}/g, '').trim()) : [];
// };

// exports.addContract = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
//         if (!allowedRoles.includes(req.user.role)) {
//             return res.send({ status: 403, message: "Access denied" });
//         }

//         let { contractName, contract, companyId, contractFileName } = req.body;

//         const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } });
//         if (!company) {
//             return res.send({ status: 404, message: 'Company not found.' });
//         }

//         if (!contractName || !contract) {
//             return res.send({ status: 400, message: "Contract name and contract are required." });
//         }

//         const existingContract = await Contract.findOne({ contractName, companyId, isDeleted: { $ne: true } });
//         if (existingContract) {
//             return res.send({ status: 409, message: `A contract with the name ${contractName} already exists for this company.` });
//         }

//         let documentUrl;
//         try {
//             let uploadResponse = await cloudinary.uploader.upload(contract, {
//                 resource_type: "auto",
//                 folder: "contracts",
//             });
//             documentUrl = uploadResponse.secure_url;
//         } catch (uploadError) {
//             return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
//         }

//         // Required keys in the contract file
//         const requiredKeys = ["employeeName", "email", "contactNumber", "joiningDate", "annualSalary"];
//         let extractedKeys = [];

//         // Extract placeholders from file
//         if (contractFileName.endsWith('.pdf')) {
//             try {
//                 const pdfBuffer = Buffer.from(contract, 'base64'); // Convert base64 to buffer
//                 const pdfData = await pdfParse(pdfBuffer);
                
//                 if (!pdfData || !pdfData.text) {
//                     throw new Error("PDF extraction failed: No text found.");
//                 }

//                 extractedKeys = extractPlaceholders(pdfData.text);
//             } catch (pdfError) {
//                 console.error("PDF Parsing Error:", pdfError);
//                 return res.send({ status: 400, message: "Error parsing the PDF file. Ensure it contains selectable text." });
//             }
//         } else if (contractFileName.endsWith('.docx')) {
//             try {
//                 const { value } = await mammoth.extractRawText({ buffer: Buffer.from(contract, 'base64') });
                
//                 if (!value) {
//                     throw new Error("DOCX extraction failed: No text found.");
//                 }

//                 extractedKeys = extractPlaceholders(value);
//             } catch (docxError) {
//                 console.error("DOCX Parsing Error:", docxError);
//                 return res.send({ status: 400, message: "Error parsing the DOCX file. Ensure it is a valid document." });
//             }
//         } else {
//             return res.send({ status: 400, message: "Unsupported file format. Only PDF and DOCX are allowed." });
//         }

//         // Validate missing and extra keys
//         const missingKeys = requiredKeys.filter(key => !extractedKeys.includes(key));
//         const extraKeys = extractedKeys.filter(key => !requiredKeys.includes(key));

//         if (missingKeys.length > 0 || extraKeys.length > 0) {
//             return res.send({
//                 status: 400,
//                 message: "Contract file contains invalid placeholders.",
//                 missingKeys: missingKeys.length > 0 ? `Missing keys: ${missingKeys.join(", ")}` : null,
//                 extraKeys: extraKeys.length > 0 ? `Extra keys: ${extraKeys.join(", ")}` : null
//             });
//         }

//         // Save contract to database
//         const { firstName, lastName } = req.user.personalDetails;
//         const name = [firstName, lastName].filter(Boolean).join(" ");

//         let newContract = await Contract.create({
//             contractName,
//             contract: documentUrl,
//             contractFileName,
//             createdRole: req.user.role,
//             creatorId: req.user._id,
//             uploadBy: name,
//             companyId,
//             companyName: company?.companyDetails?.businessName
//         });

//         return res.send({ status: 200, message: "Contract form created successfully.", newContract });

//     } catch (error) {
//         console.error("Error occurred while adding contract form:", error);
//         res.send({ status: 500, message: "Something went wrong while adding contract form!" });
//     }
// };

exports.getAllContract = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            let contracts
            let totalContracts
            if(req.user.role === 'Superadmin'){
                contracts = await Contract.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalContracts = await Contract.find({ isDeleted: { $ne: true } }).countDocuments()
            } else {
                contracts = await Contract.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalContracts = await Contract.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).countDocuments()
            }

            return res.send({
                status: 200,
                message: 'Contracts fetched successfully.',
                contracts,
                totalContracts,
                totalPages: Math.ceil(totalContracts / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching contract form:", error);
        res.send({ message: "Something went wrong while fetching contract form!" })
    }
}

exports.getAllContractOfCompany = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit
            const companyId = req.body.companyId || req.user.companyId
            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            const contracts = await Contract.find({ companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)

            const totalContracts = await Contract.find({ companyId, isDeleted: { $ne: true } }).countDocuments()

            return res.send({
                status: 200,
                message: 'Contracts fetched successfully.',
                contracts,
                totalContracts,
                totalPages: Math.ceil(totalContracts / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching contract form:", error);
        res.send({ message: "Something went wrong while fetching contract form!" })
    }
}

exports.getContract = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const contractId = req.params.id

            if (!contractId || contractId == 'undefined' || contractId == 'null') {
                return res.send({ status: 404, message: 'Contract not found' })
            }

            const contract = await Contract.findOne({
                _id: contractId,
                isDeleted: false
            });

            if (!contract) {
                return res.send({ status: 404, message: 'Contract not found' })
            }

            return res.send({ status: 200, message: 'Contract fetched successfully.', contract })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching Contract:", error);
        res.send({ message: "Something went wrong while fetching Contract!" })
    }
}

exports.updateContract = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const contractId = req.params.id

            const isExist = await Contract.findOne({
                _id: contractId,
                isDeleted: false
            });

            if (!isExist) {
                return res.send({ status: 404, message: 'Contract not found' })
            }

            let {
                contractName,
                contract,
                companyId,
                contractFileName
            } = req.body

            if (contractName && isExist.contractName != contractName) {
                const existingContract = await Contract.findOne({ contractName, companyId, isDeleted: { $ne: true }  });
                if (existingContract) {
                    return res.send({ status: 409, message: `A contract with the name "${contractName}" already exists for this company.` });
                }
            }

            if (contract && contract.startsWith('data:')) {
                const document = contract
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing contract document')
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "contracts",
                    });
                    // console.log('Cloudinary response:', element);
                    contract = element.secure_url
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            } else {
                contract = isExist?.contract
            }

            let updatedContract = await Contract.findByIdAndUpdate(
                { _id: contractId },
                {
                    $set: {
                        contractName,
                        contract,
                        contractFileName,
                        companyId,
                        updatedAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: `Contract details updated successfully.`, updatedContract })

        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while updating contract details:", error);
        res.send({ message: "Something went wrong while updating contract details!" })
    }
}

exports.deleteContract = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const contractId = req.params.id

            const isExist = await Contract.findOne({
                _id: contractId,
                isDeleted: { $ne: true },
            });
            if (!isExist) {
                return res.send({ status: 404, message: 'Contract not found' })
            }

            let deletedContract = await Contract.findByIdAndUpdate(
                { _id: contractId, isDeleted: { $ne: true } },
                { 
                    $set: { 
                        isDeleted: true,
                        canceledAt: moment().toDate()
                    }
                }
            )

            return res.send({ status: 200, message: 'Contract deleted successfully.', deletedContract })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing contract:", error);
        res.send({ message: "Something went wrong while removing contract!" })
    }
}


   

// async function downloadPDF(pdfUrl, outputPath) {
//     const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
//     await fs.writeFileSync(outputPath, response.data);
//     console.log('✅ PDF downloaded:', outputPath);
//     return outputPath;
// }


// async function replacePlaceholders(inputPath, outputPath, replacements) {
//     // const pdfBuffer = fs.readFileSync(inputPath);
//     // const parsedData = await pdfParse(pdfBuffer);
    
//     // console.log('parsedData:', parsedData)
    
//     // Extract text and replace placeholders
//     // let updatedText = parsedData.text;
//     // for (const [key, value] of Object.entries(replacements)) {
//     //     updatedText = updatedText.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
//     // }
//     // console.log('updatedText:', updatedText)
    
//     // Load the original PDF to modify it
//     // const pdfBuffer = fs.readFileSync(inputPath);
//     // // const parsedData = await pdfParse(pdfBuffer);
//     // const pdfDoc = await PDFDocument.load(pdfBuffer);
//     // console.log('pdfDoc:', pdfDoc)
//     // const pages = pdfDoc.getPages();
//     // console.log('pages:', pages)
//     // const firstPage = pages[0];

//     // // Embed a standard font
//     // const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
//     // const fontSize = 12;

//     // // Clear previous text (optional) and add updated text
//     // firstPage.drawText(updatedText, { x: 50, y: 700, font, size: fontSize });

//     // // Save modified PDF
//     // const updatedPdfBytes = await pdfDoc.save();
//     const existingPdfBytes = fs.readFileSync(inputPath);
//     const pdfDoc = await PDFDocument.load(existingPdfBytes);
//     const form = pdfDoc.getForm();

//     Object.entries(replacements).forEach(([key, value]) => {
//         const field = form.getTextField(key);
//         if (field) field.setText(value);
//     });

//     const pdfBytes = await pdfDoc.save();
//     fs.writeFileSync(outputPath, pdfBytes);
//     console.log('✅ PDF updated:', outputPath);
//     return outputPath;
// }


// async function replacePlaceholders(inputPath, outputPath, replacements) {

//     const existingPdfBytes = await fs.readFileSync(inputPath);
//     const pdfDoc = await PDFDocument.load(existingPdfBytes);
//     const form = pdfDoc.getForm();

//     const employeeName = form.getTextField('EMPLOYEE_NAME')
//     const employeeEmail = form.getTextField('EMPLOYEE_EMAIL')
//     const employeeContactNumber = form.getTextField('EMPLOYEE_CONTACT_NUMBER')
//     const jobTitle = form.getTextField('JOB_TITLE')
//     const jobRole = form.getTextField('JOB_ROLE')
//     const weeklyHours = form.getTextField('WEEKLY_HOURS')
//     const annualSalary = form.getTextField('ANNUAL_SALARY')
//     const companyName = form.getTextField('COMPANY_NAME')

//     employeeName.setText(replacements.EMPLOYEE_NAME)
//     employeeEmail.setText(replacements.EMPLOYEE_EMAIL)
//     employeeContactNumber.setText(replacements.EMPLOYEE_CONTACT_NUMBER)
//     jobTitle.setText(replacements.JOB_TITLE)
//     jobRole.setText(replacements.JOB_ROLE)
//     weeklyHours.setText(replacements.WEEKLY_HOURS)
//     annualSalary.setText(replacements.ANNUAL_SALARY)
//     companyName.setText(replacements.COMPANY_NAME)

//     const pdfBytes = await pdfDoc.save();

//     await fs.writeFileSync(outputPath, pdfBytes);
//     console.log('✅ PDF updated:', outputPath);
//     return outputPath;
// }

// async function processPDF(cloudinaryUrl, replacements) {
//     // const downloadedPDF = await downloadPDF(cloudinaryUrl, 'downloaded.pdf');
//     // const updatedPDF = await replacePlaceholders(downloadedPDF, 'updated.pdf', replacements);
//     // // const uploadedURL = await uploadToCloudinary(updatedPDF);
//     // console.log('✅ Final Updated PDF URL:', updatedPDF);
//     const timestamp = Date.now();
//     const downloadedPath = `downloaded-${timestamp}.pdf`;
//     const updatedPath = `updated-${timestamp}.pdf`;
    
//     const downloadedPDF = await downloadPDF(cloudinaryUrl, downloadedPath);
//     const updatedPDF = await replacePlaceholders(downloadedPDF, updatedPath, replacements);
    
//     // Clean up temporary files
//     try {
//         await fs.unlink(downloadedPath);
//         await fs.unlink(updatedPath);
//     } catch (cleanupError) {
//         console.warn('Could not clean up temp files:', cleanupError);
//     }
    
//     return updatedPDF;
// }


// pending work
exports.generateContractForEmployee = async (req, res) => {
    // // try {
    // //     const { userId, contractId } = req.body;

    // //     const user = await User.findById(userId);
    // //     if (!user) return res.status(404).json({ message: "User not found" });

    // //     const contract = await Contract.findById(contractId);
    // //     if (!contract) return res.status(404).json({ message: "Contract template not found" });       

    // //     // await downloadPDF(contract?.contract, 'downloaded.pdf')

    // //     const downloadedPdf = 'downloaded.pdf';
    // //     const updatedPdf = 'updated.pdf';

    // //     const userData = {
    // //         '{EMPLOYEE_NAME}': `${user.personalDetails.firstName + " " + user.personalDetails.lastName}`,
    // //         '{EMPLOYEE_EMAIL}': user.personalDetails.email,
    // //         '{EMPLOYEE_CONTACT_NUMBER}': user.personalDetails.phone,
    // //         '{JOB_TITLE}': user.jobDetails[0].jobTitle,
    // //         '{JOB_ROLE}': user.jobDetails[0].role,
    // //         '{WEEKLY_HOURS}': user.jobDetails[0].weeklyWorkingHours.toString(),
    // //         '{ANNUAL_SALARY}': user.jobDetails[0].annualSalary.toString(),
    // //         '{COMPANY_NAME}': 'this is company name',
    // //     }

    // //     await downloadPDF(contract?.contract, downloadedPdf);

    // //     await fillPDF(downloadedPdf, userData, updatedPdf);

    // //     return res.send({status:200,messgae:'SUCCESS'})
    // // } catch (error) {
    // //     console.error('Error occurred while generating employee contract:', error, 'MESSAGE:', error.message)
    // //     res.send({ message: 'Error occurred while generating employee contract!' })
    // // }
    // try {
    //     const { userId, contractId } = req.body;

    //     const user = await User.findById(userId);
    //     if (!user) return res.status(404).json({ message: "User not found" });

    //     const contract = await Contract.findById(contractId);
    //     if (!contract) return res.status(404).json({ message: "Contract template not found" });       

    //     // await downloadPDF(contract?.contract, 'downloaded.pdf')

    //     const userData = {
    //         '{EMPLOYEE_NAME}': `${user.personalDetails.firstName + " " + user.personalDetails.lastName}`,
    //         '{EMPLOYEE_EMAIL}': user.personalDetails.email,
    //         '{EMPLOYEE_CONTACT_NUMBER}': user.personalDetails.phone,
    //         '{JOB_TITLE}': user.jobDetails[0].jobTitle,
    //         '{JOB_ROLE}': user.jobDetails[0].role,
    //         '{WEEKLY_HOURS}': user.jobDetails[0].weeklyWorkingHours.toString(),
    //         '{ANNUAL_SALARY}': user.jobDetails[0].annualSalary.toString(),
    //         '{COMPANY_NAME}': 'this is company name',
    //     }

    //     // await processPDF(contract?.contract, userData)

    //     async function modifyPDF() {
    //         try {
    //           // Read the PDF file
    //           const pdfBytes = fs.readFileSync("sample.pdf");
          
    //           // Extract text from the PDF
    //           const data = await pdfParse(pdfBytes);
    //           let extractedText = data.text;
          
    //           console.log("Extracted Text:\n", extractedText); // Debugging: Check text content
          
    //           // Define placeholders and values from database
    //           const replacements = {
    //             '{EMPLOYEE_NAME}': `${user.personalDetails.firstName + " " + user.personalDetails.lastName}`,
    //             '{EMPLOYEE_EMAIL}': user.personalDetails.email,
    //             '{JOB_TITLE}': user.jobDetails[0].jobTitle,
    //           };
          
    //           // Replace placeholders with actual values
    //           for (let key in replacements) {
    //             extractedText = extractedText.replace(new RegExp(key, "g"), replacements[key]);
    //           }
          
    //           // Load original PDF
    //           const pdfDoc = await PDFDocument.load(pdfBytes);
    //           const page = pdfDoc.getPages()[0];
          
    //           // Draw updated text (modify x, y positions accordingly)
    //           page.drawText(extractedText, { x: 50, y: 500, size: 12, color: rgb(0, 0, 0) });
          
    //           // Save the modified PDF
    //           const newPdfBytes = await pdfDoc.save();
    //           fs.writeFileSync("output.pdf", newPdfBytes);
          
    //           console.log("✅ PDF updated successfully! Check 'output.pdf'");
    //         } catch (error) {
    //           console.error("❌ Error:", error);
    //         }
    //     }
    //     await modifyPDF()

    //     return res.send('SUCCESS')
    // } catch (error) {
    //     console.error('Error occurred while generating employee contract:', error, 'MESSAGE:', error.message)
    //     res.send({ message: 'Error occurred while generating employee contract!' })
    // }
}
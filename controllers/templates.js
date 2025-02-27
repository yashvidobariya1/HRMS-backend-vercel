const Template = require('../models/template');
const User = require('../models/user');
const Company = require('../models/company');
const cloudinary = require('../utils/cloudinary');
const axios = require("axios");
const moment = require('moment');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const streamifier = require('streamifier')
// const ImageModule = require('open-docxtemplater-image-module')
// // const { PDFDocument, rgb } = require('pdf-lib');
// const { Document, Packer, Paragraph, ImageRun } = require("docx");
// const docx4js = require("docx4js");
// const { PassThrough } = require("stream");
// const { imageSize } = require("image-size");
// const fs = require("fs");
// const mammoth = require("mammoth");

exports.addTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin']
        if(allowedRoles.includes(req.user.role)){
            let {
                templateName,
                template,
                // companyId,
                templateFileName
            } = req.body

            // const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            // if(!company){
            //     return res.send({ status: 404, message: 'Company not found.' })
            // }

            if (!templateName || !template) {
                return res.send({ status: 400, message: "Template name and template are required." })
            }

            if (templateName) {
                const existingTemplate = await Template.findOne({ templateName, isDeleted: { $ne: true } });
                if (existingTemplate) {
                    return res.send({ status: 409, message: `A template with the name ${templateName} already exists.` });
                }
            }

            if (template) {
                const document = template;

                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing template document');
                    return res.send({ status: 400, message: "Invalid or missing template document." });
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "Templates",
                    });
                    // console.log('Cloudinary response:', element);
                    template = element.secure_url
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const { firstName, lastName } = req.user?.personalDetails;
            const name = [firstName, lastName].filter(Boolean).join(" ");
            const templateForm = {
                templateName,
                template,
                templateFileName,
                creatorId: req.user._id,
                createdRole: req.user.role,
                uploadBy: name,
                // companyId: companyId,
                // companyName: company?.companyDetails?.businessName
            }
            // console.log('new templateForm', templateForm)
            let newTemplate = await Template.create(templateForm)

            return res.send({ status: 200, message: `Template form created successfully.`, newTemplate })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while creating template form:', error)
        res.send({ message: 'Error occurred while creating templates form!' })
    }
}

exports.getTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const templateId = req.params.id

            if (!templateId || templateId == 'undefined' || templateId == 'null') {
                return res.send({ status: 404, message: 'Template not found' })
            }

            const template = await Template.findOne({
                _id: templateId,
                isDeleted: false
            });

            if (!template) {
                return res.send({ status: 404, message: 'Template not found' })
            }

            return res.send({ status: 200, message: 'Template fetched successfully.', template })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.log('Error occurred while fetching template:', error)
        res.send({ message: 'Error occurred while fetching template!' })
    }
}

exports.getAllTemplates = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            const templates = await Template.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
            const totalTemplates = await Template.find({ isDeleted: { $ne: true } }).countDocuments()

            return res.send({
                status: 200,
                message: 'Templates fetched successfully.',
                templates,
                totalTemplates,
                totalPages: Math.ceil(totalTemplates / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.log('Error occurred while fetching templates:', error)
        res.send({ message: 'Error occurred while fetching templates!' })
    }
}

exports.updateTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const templateId = req.params.id

            const isExist = await Template.findOne({
                _id: templateId,
                isDeleted: false
            });

            if (!isExist) {
                return res.send({ status: 404, message: 'Template not found' })
            }

            let {
                templateName,
                template,
                templateFileName
            } = req.body

            if (templateName && isExist.templateName != templateName) {
                const existingTemplate = await Template.findOne({ templateName, isDeleted: { $ne: true } });
                if (existingTemplate) {
                    return res.send({ status: 409, message: `A template with the name "${templateName}" already exists.` });
                }
            }

            if (template && template.startsWith('data:')) {
                const document = template
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing template document')
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "Templates",
                    });
                    // console.log('Cloudinary response:', element);
                    template = element.secure_url
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to Cloudinary:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            } else {
                template = isExist?.template
            }

            const updatedTemplate = await Template.findByIdAndUpdate(
                { _id: templateId },
                {
                    $set: {
                        templateName,
                        template,
                        templateFileName,
                        updatedAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: `Template details updated successfully.`, updatedTemplate })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while updating template details:", error);
        res.send({ message: "Something went wrong while updating template details!" })
    }
}

exports.deleteTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const templateId = req.params.id

            const isExist = await Template.findOne({
                _id: templateId,
                isDeleted: { $ne: true },
            });
            if (!isExist) {
                return res.send({ status: 404, message: 'Template not found' })
            }

            const deletedTemplate = await Template.findByIdAndUpdate(
                { _id: templateId, isDeleted: { $ne: true } },
                { 
                    $set: { 
                        isDeleted: true,
                        cancelAt: moment().toDate()
                    }
                }
            )

            return res.send({ status: 200, message: 'Template deleted successfully.', deletedTemplate })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing template:", error);
        res.send({ message: "Something went wrong while removing template!" })
    }
}

const generateTemplateForUser = async (userData, templateId) => {
    try {       
        const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } })
       
        const response = await axios.get(template?.template, { responseType: 'arraybuffer' })
        const content = response.data

        const zip = new PizZip(content)
        const doc = new Docxtemplater(zip)

        doc.render(userData)

        const modifiedDoc = doc.getZip().generate({ type: 'nodebuffer' })

        return modifiedDoc
    } catch (error) {
        console.error('Error occurred while generating template:', error)
        return { message: 'Error occurred while generating template:' }
    }
}


// async function convertDocxToPdfAndUpload(docxBuffer, base64Image) {
//     try {

//         const uploadDocx = await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 { resource_type: 'raw', format: 'docx', folder: 'documents' },
//                 (error, result) => {
//                     if (error) return reject(error);
//                     resolve(result.secure_url);
//                 }
//             );
//             streamifier.createReadStream(docxBuffer).pipe(uploadStream);
//         });

//         console.log("Cloudinary DOCX URL:", uploadDocx);

//         const docxPublicId = uploadDocx.split('/').pop().replace('.docx', '');
//         const pdfConversion = await cloudinary.uploader.explicit(docxPublicId, {
//             type: 'upload',
//             resource_type: 'raw',
//             format: 'pdf',
//         });

//         if (!pdfConversion.secure_url) {
//             throw new Error("Cloudinary PDF conversion failed");
//         }

//         console.log("Cloudinary PDF URL:", pdfConversion.secure_url);

//         const pdfResponse = await axios.get(pdfConversion.secure_url, { responseType: 'arraybuffer' });

//         if (!pdfResponse.headers['content-type'].includes('pdf')) {
//             throw new Error("Downloaded file is not a valid PDF");
//         }

//         const pdfBuffer = pdfResponse.data;

//         const pdfDoc = await PDFDocument.load(pdfBuffer);

//         if (base64Image) {
//             const imageBytes = Buffer.from(base64Image, 'base64');

//             let embeddedImage;
//             if (base64Image.startsWith("iVBORw0KGg")) {
//                 embeddedImage = await pdfDoc.embedPng(imageBytes);
//             } else {
//                 embeddedImage = await pdfDoc.embedJpg(imageBytes);
//             }

//             const page = pdfDoc.getPages()[0];
//             page.drawImage(embeddedImage, {
//                 x: 50,
//                 y: 600,
//                 width: 200,
//                 height: 200,
//             });
//         }

//         const modifiedPdf = await pdfDoc.save();

//         const uploadPdf = await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 { resource_type: 'raw', format: 'pdf', folder: 'documents' },
//                 (error, result) => {
//                     if (error) return reject(error);
//                     resolve(result.secure_url);
//                 }
//             );
//             streamifier.createReadStream(modifiedPdf).pipe(uploadStream);
//         });

//         console.log("Final Cloudinary PDF URL:", uploadPdf);
//         return uploadPdf;


//         // // 1️⃣ Create a new PDF document
//         // const pdfDoc = await PDFDocument.create();
//         // const page = pdfDoc.addPage([600, 800]); // Adjust size as needed

//         // // 2️⃣ Add a placeholder text (DOCX content cannot be extracted easily)
//         // page.drawText("This is a placeholder for DOCX content", { x: 50, y: 750 });

//         // // 3️⃣ Add Image (if provided)
//         // if (base64Image) {
//         //     const imageBytes = Buffer.from(base64Image, 'base64');

//         //     let embeddedImage;
//         //     if (base64Image.startsWith("iVBORw0KGg")) {
//         //         // It's a PNG image
//         //         embeddedImage = await pdfDoc.embedPng(imageBytes);
//         //     } else {
//         //         // Assume it's a JPEG image
//         //         embeddedImage = await pdfDoc.embedJpg(imageBytes);
//         //     }
//         //     page.drawImage(embeddedImage, {
//         //         x: 50,
//         //         y: 600,
//         //         width: 200,
//         //         height: 200,
//         //     });
//         // }

//         // // 4️⃣ Save PDF to Buffer
//         // const pdfBuffer = await pdfDoc.save();

//         // // 5️⃣ Upload PDF to Cloudinary
//         // const uploadPdf = await new Promise((resolve, reject) => {
//         //     const uploadStream = cloudinary.uploader.upload_stream(
//         //         { resource_type: 'raw', format: 'pdf', folder: 'documents' },
//         //         (error, result) => {
//         //             if (error) return reject(error);
//         //             resolve(result.secure_url);
//         //         }
//         //     );
//         //     streamifier.createReadStream(pdfBuffer).pipe(uploadStream);
//         // });

//         // console.log("Cloudinary PDF URL:", uploadPdf);
//         // return uploadPdf;
//     } catch (error) {
//         console.error("Error converting DOCX to PDF:", error);
//         throw error;
//     }
// }
// async function convertDocxToPdfAndUpload(docxBuffer, base64Image) {
//     try {

//         // 1️⃣ Upload DOCX to Cloudinary (raw format)
//         const uploadDocx = await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 { resource_type: 'raw', format: 'docx', folder: 'documents' },
//                 (error, result) => {
//                     if (error) return reject(error);
//                     resolve(result);
//                 }
//             );
//             streamifier.createReadStream(docxBuffer).pipe(uploadStream);
//         });

//         if (!uploadDocx.secure_url || !uploadDocx.public_id) {
//             throw new Error("Cloudinary DOCX upload failed");
//         }

//         console.log("Cloudinary DOCX URL:", uploadDocx.secure_url);
//         console.log("Cloudinary DOCX Public ID:", uploadDocx.public_id);

//         // // 2️⃣ Convert DOCX to PDF using Cloudinary
//         // const pdfConversion = await cloudinary.uploader.explicit(uploadDocx.public_id, {
//         //     type: 'upload',
//         //     resource_type: 'raw',
//         //     format: 'pdf',
//         // });

//         // if (!pdfConversion.secure_url) {
//         //     throw new Error("Cloudinary PDF conversion failed");
//         // }

//         // console.log("Cloudinary PDF URL:", pdfConversion.secure_url);

//         // 3️⃣ Download Converted PDF
//         const pdfResponse = await axios.get(uploadDocx.secure_url, { responseType: 'arraybuffer' });

//         if (!pdfResponse.headers['content-type'].includes('pdf')) {
//             throw new Error("Downloaded file is not a valid PDF");
//         }

//         const pdfBuffer = pdfResponse.data;

//         // 4️⃣ Load PDF and Add Image
//         const pdfDoc = await PDFDocument.load(pdfBuffer);

//         if (base64Image) {
//             const imageBytes = Buffer.from(base64Image, 'base64');

//             let embeddedImage;
//             if (base64Image.startsWith("iVBORw0KGg")) {
//                 embeddedImage = await pdfDoc.embedPng(imageBytes);
//             } else {
//                 embeddedImage = await pdfDoc.embedJpg(imageBytes);
//             }

//             const page = pdfDoc.getPages()[0];
//             page.drawImage(embeddedImage, {
//                 x: 50,
//                 y: 600,
//                 width: 200,
//                 height: 200,
//             });
//         }

//         // 5️⃣ Save Modified PDF
//         const modifiedPdf = await pdfDoc.save();

//         // 6️⃣ Upload Final PDF to Cloudinary
//         const uploadPdf = await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 { resource_type: 'raw', format: 'pdf', folder: 'documents' },
//                 (error, result) => {
//                     if (error) return reject(error);
//                     resolve(result.secure_url);
//                 }
//             );
//             streamifier.createReadStream(modifiedPdf).pipe(uploadStream);
//         });

//         console.log("Final Cloudinary PDF URL:", uploadPdf);
//         return uploadPdf;
//     } catch (error) {
//         console.error("Error converting DOCX to PDF:", error);
//         throw error;
//     }
// }

exports.generateEmployeeTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { jobId } = req.body
            const userId = req.user._id

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            const company = await Company.findOne({ _id: existUser?.companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            let jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const templateId = (jobDetail?.templateId).toString()
            const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } })
            if(!template){
                return res.send({ status: 404, message: 'Template not found' })
            }

            let userData = {
                EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
                EMPLOYEE_EMAIL: existUser?.personalDetails?.email,
                EMPLOYEE_CONTACT_NUMBER: existUser?.personalDetails?.phone,
                JOB_START_DATE: 'START_DATE',
                EMPLOYEE_JOB_TITLE: 'JOB_TITLE',
                WEEKLY_HOURS: 'WEEKLY_HOURS',
                ANNUAL_SALARY: 'ANNUAL_SALARY',
                COMPANY_NAME: company?.companyDetails?.businessName,
                SIGNATURE: '{%SIGNATURE}'
            }

            const generatedTemp = await generateTemplateForUser(userData, templateId)

            const docxBuffer = Buffer.from(generatedTemp, 'base64');

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

            const uploadDocx = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: 'raw', format: 'docx', folder: 'documents' },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                streamifier.createReadStream(docxBuffer).pipe(uploadStream);
            });

            return res.send({ status: 200, message: 'URL generated success', URL: uploadDocx.secure_url})

//==========================================================================Pending=================================================================================

            // // Convert base64 image to buffer
            // const imageBuffer = Buffer.from(image, 'base64')

            // // Load the DOCX file from buffer
            // const zip = new PizZip(Buffer.from(generatedTemp, 'base64')) // Convert base64 DOCX to buffer
            // // const doc = new Docxtemplater(zip, {
            // //     modules: [
            // //         new ImageModule({
            // //             getImage: () => imageBuffer,
            // //             getSize: () => [200, 200] // Set the size of the image
            // //         })
            // //     ]
            // // })

            // const imageModule = new ImageModule({
            //     getImage(tagValue) {
            //         return imageBuffer // Returns image buffer
            //     },
            //     getSize() {
            //         return [300, 300] // Set the size of the image (width, height)
            //     }
            // })
            // const doc = new Docxtemplater(zip, { modules: [imageModule] })

            // // doc.setData({
            // //     SIGNATURE: image // This should match the placeholder in your DOCX template
            // // })
            // // doc.setOptions({ data: { SIGNATURE: image } });
            // // doc.setData({ SIGNATURE: image });


            // doc.render({SIGNATURE: image})
            // const modifiedDoc = doc.getZip().generate({ type: 'nodebuffer' })



            // // const uploadStream = cloudinary.uploader.upload_stream(
            // //     { resource_type: 'raw', folder: 'documents' },
            // //     (error, result) => {
            // //         if (error) {
            // //             console.error('Error uploading document:', error)
            // //             return res.status(500).json({ message: 'Error uploading document' })
            // //         }
            // //         res.json({ url: result.secure_url }) // Return Cloudinary URL
            // //     }
            // // )
            // const uploadStream = cloudinary.uploader.upload_stream(
            //     { resource_type: 'raw', folder: 'documents' },
            //     (error, result) => {
            //         if (error) {
            //             console.error('Error uploading document:', error)
            //             if (!res.headersSent) {
            //                 return res.status(500).json({ message: 'Error uploading document' })
            //             }
            //         } else {
            //             if (!res.headersSent) {
            //                 return res.json({ url: result.secure_url })
            //             }
            //         }
            //     }
            // )
    
            // streamifier.createReadStream(modifiedDoc).pipe(uploadStream)
            // // const URL = streamifier.createReadStream(modifiedDoc).pipe(uploadStream)



            // // return res.send({ status: 200, URL })
            // // return res.send({ status: 200, modifiedDoc })

            // // Load the DOCX file from base64
            // const zip = new PizZip(Buffer.from(generatedTemp, 'base64'));
            // const doc = new Docxtemplater(zip);

            // // Replace placeholders
            // doc.render();

            // // Generate final DOCX buffer
            // const finalDoc = doc.getZip().generate({ type: 'nodebuffer' });

            // const uploadDocx = await new Promise((resolve, reject) => {
            //     const uploadStream = cloudinary.uploader.upload_stream(
            //         { resource_type: 'auto', folder: 'documents', format: 'pdf' },
            //         (error, result) => {
            //             if (error) return reject(error);
            //             resolve(result.secure_url);
            //         }
            //     );
            //     streamifier.createReadStream(finalDoc).pipe(uploadStream);
            // });

            // if (!uploadDocx) {
            //     return res.status(500).json({ message: "Cloudinary upload failed" });
            // }
    
            // console.log("Cloudinary PDF URL:", uploadDocx);

            // // ✅ Download PDF from Cloudinary
            // const pdfResponse = await axios.get(uploadDocx, { responseType: 'arraybuffer' });
            // if (!pdfResponse.headers['content-type'].includes('pdf')) {
            //     throw new Error("Downloaded file is not a PDF");
            // }
            // const pdfBuffer = pdfResponse.data;

            // // ✅ Insert Image into PDF
            // const pdfDoc = await PDFDocument.load(pdfBuffer);
            // const imageBytes = Buffer.from(base64Image, 'base64');
            // const imageUpload = await pdfDoc.embedPng(imageBytes);

            // const page = pdfDoc.getPages()[0];
            // page.drawImage(imageUpload, {
            //     x: 50,
            //     y: page.getHeight() - 300, // Adjust position
            //     width: 200,
            //     height: 200
            // });

            // // ✅ Save final modified PDF
            // const modifiedPdf = await pdfDoc.save();

            // const uploadPdf = await new Promise((resolve, reject) => {
            //     const uploadStream = cloudinary.uploader.upload_stream(
            //         { resource_type: 'auto', format: 'pdf', folder: 'documents' },
            //         (error, result) => {
            //             if (error) return reject(error);
            //             resolve(result.secure_url);
            //         }
            //     );
            //     streamifier.createReadStream(modifiedPdf).pipe(uploadStream);
            // });
    
            // return res.json({ url: uploadPdf });


            // const docxBuffer = Buffer.from(generatedTemp, 'base64');
            // ✅ Check if the file is a valid DOCX
            // let zip;
            // try {
            //     zip = new PizZip(docxBuffer);
            // } catch (error) {
            //     return res.status(400).json({ message: "Invalid DOCX format" });
            // }
            // const doc = new Docxtemplater(zip);
            // doc.render()
            // const finalDoc = doc.getZip().generate({ type: 'nodebuffer' });
            // const uploadDocx = await new Promise((resolve, reject) => {
            //     const uploadStream = cloudinary.uploader.upload_stream(
            //         { resource_type: 'raw', format: 'docx', folder: 'documents' }, // Use 'raw' for DOCX
            //         (error, result) => {
            //             if (error) return reject(error);
            //             resolve(result);
            //         }
            //     );
            //     streamifier.createReadStream(finalDoc).pipe(uploadStream);
            // });
            // if (!uploadDocx) {
            //     return res.status(500).json({ message: "Cloudinary upload failed" });
            // }
    
            // console.log("Cloudinary DOCX URL:", uploadDocx);

            // // till step is right 

            // const publicId = uploadDocx.public_id
            // console.log('public id:', publicId)

            // const finalpdfURL = await convertDocxToPdfAndUpload(docxBuffer, image)

            // return finalpdfURL

            // // ✅ Convert DOCX to PDF via Cloudinary API
            // const pdfConversion = await cloudinary.uploader.explicit(publicId, {
            //     type: "upload",
            //     resource_type: "raw",
            //     format: "pdf"
            // });

            // if (!pdfConversion.secure_url) {
            //     return res.status(500).json({ message: "Cloudinary PDF conversion failed" });
            // }

            // const pdfUrl = pdfConversion.secure_url;
            // console.log("Cloudinary PDF URL:", pdfUrl);
            // const pdfResponse = await axios.get(pdfUrl, { responseType: "arraybuffer" });

            // if (!pdfResponse.headers["content-type"].includes("pdf")) {
            //     throw new Error("Downloaded file is not a PDF");
            // }

            // const pdfBuffer = pdfResponse.data;
            // const pdfDoc = await PDFDocument.load(pdfBuffer);
            // const imageBytes = Buffer.from(base64Image, "base64");
            // const imageUpload = await pdfDoc.embedPng(imageBytes);

            // const page = pdfDoc.getPages()[0];
            // page.drawImage(imageUpload, {
            //     x: 50,
            //     y: page.getHeight() - 300,
            //     width: 200,
            //     height: 200
            // });
            // const modifiedPdf = await pdfDoc.save();
            // const uploadPdf = await new Promise((resolve, reject) => {
            //     const uploadStream = cloudinary.uploader.upload_stream(
            //         { resource_type: "auto", format: "pdf", folder: "documents" },
            //         (error, result) => {
            //             if (error) return reject(error);
            //             console.log("Cloudinary Upload Response:", result);
            //             resolve(result.secure_url);
            //         }
            //     );
            //     streamifier.createReadStream(modifiedPdf).pipe(uploadStream);
            // });

            // return res.json({ url: uploadPdf });

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while generating employee template:', error)
        res.send({ message: 'Error occurred while generating employee template!' })
    }
}

// exports.saveTemplateWithSignature = async (req, res) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee']
//         if(allowedRoles.includes(req.user.role)){
//             const { URL, image } = req.body

//             const userId = req.user._id

//             const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
//             if(!existUser){
//                 return res.send({ status: 404, message: 'User not found' })
//             }

//             const company = await Company.findOne({ _id: existUser?.companyId, isDeleted: { $ne: true } })
//             if(!company){
//                 return res.send({ status: 404, message: 'Company not found' })
//             }

//             if(!image){
//                 return res.send({ status: 400, message: 'Sign is required!' })
//             }

//             // Step 1: Fetch the existing DOCX file from the given URL
//             const response = await axios({
//                 url: URL,
//                 method: "GET",
//                 responseType: "arraybuffer",
//             })
//             const docxBuffer = response.data

//             // Step 2: Load DOCX file
//             const zip = new PizZip(docxBuffer);
//             const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

//             // Step 3: Convert Base64 Image to Buffer
//             const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
//             const imageBuffer = Buffer.from(base64Data, "base64");

//             doc.render({
//                 EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
//                 EMPLOYEE_EMAIL: existUser?.personalDetails?.email,
//                 EMPLOYEE_CONTACT_NUMBER: existUser?.personalDetails?.phone,
//                 JOB_START_DATE: 'START_DATE',
//                 EMPLOYEE_JOB_TITLE: 'JOB_TITLE',
//                 WEEKLY_HOURS: 'WEEKLY_HOURS',
//                 ANNUAL_SALARY: 'ANNUAL_SALARY',
//                 COMPANY_NAME: company?.companyDetails?.businessName,
//                 SIGNATURE: image, // Base64 image placeholder
//             });

//             // Step 4: Generate the updated DOCX buffer
//             const updatedBuffer = doc.getZip().generate({ type: "nodebuffer" });

//             // Step 5: Upload the modified DOCX file to Cloudinary
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 {
//                 resource_type: "raw",
//                 folder: "documents",
//                 public_id: `signed_document_${Date.now()}.docx`,
//                 },
//                 (error, result) => {
//                 if (error) {
//                     console.error("Cloudinary Upload Error:", error);
//                     return res.status(500).json({ message: "Error uploading to Cloudinary" });
//                 }
//                 return res.status(200).json({
//                     message: "Template updated successfully!",
//                     newURL: result.secure_url,
//                 });
//                 }
//             );

//             function bufferToStream(buffer) {
//                 const stream = new PassThrough();
//                 stream.end(buffer);
//                 return stream;
//             }
        
//             // Convert buffer to stream and upload
//             bufferToStream(updatedBuffer).pipe(uploadStream);            

//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.log('Error occurred while saving template:', error)
//         res.send({ message: 'Error occurred while saving template!' })
//     }
// }

// async function downloadDocx(url) {
//     const response = await axios.get(url, { responseType: "arraybuffer" });
//     return Buffer.from(response.data);
// }

// async function addSignatureToDoc(url, base64Image) {
//     try {
//         // Step 1: Download existing DOCX
//         const docxBuffer = await downloadDocx(url);

//         // Step 2: Extract text (optional, if you need text)
//         const extractedText = await mammoth.extractRawText({ buffer: docxBuffer });
//         console.log("Extracted Text:", extractedText.value);

//         // Step 3: Prepare base64 image
//         const base64Data = base64Image.split(";base64,").pop();
//         const imageBuffer = Buffer.from(base64Data, "base64");

//         // Step 4: Create a new DOCX document with existing content + signature
//         const doc = new Document({
//             sections: [
//                 {
//                     children: [
//                         new Paragraph(extractedText.value), // Add existing content
//                         new Paragraph({ text: "" }), // Spacer
//                         new Paragraph({
//                             children: [
//                                 new ImageRun({
//                                     data: imageBuffer,
//                                     transformation: { width: 200, height: 100 }, // Adjust signature size
//                                 }),
//                             ],
//                         }),
//                     ],
//                 },
//             ],
//         });

//         // Step 5: Save the updated DOCX file
//         const buffer = await Packer.toBuffer(doc);
//         fs.writeFileSync("updated_output.docx", buffer);
//         console.log("DOCX file updated with signature!");
//     } catch (error) {
//         console.error("Error processing DOCX:", error);
//     }
// }


// exports.saveTemplateWithSignature = async (req, res) => {
//     try {
//         const allowedRoles = ["Administrator", "Manager", "Employee"];
//         if (!allowedRoles.includes(req.user.role)) {
//             return res.status(403).json({ message: "Access denied" });
//         }

//         const { image, jobId } = req.body;
//         const userId = req.user._id;

//         const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
//         if (!existUser) return res.status(404).json({ message: "User not found" });

//         const company = await Company.findOne({ _id: existUser?.companyId, isDeleted: { $ne: true } });
//         if (!company) return res.status(404).json({ message: "Company not found" });

//         const jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId);
//         if (!jobDetail) return res.status(404).json({ message: "JobTitle not found" });

//         const templateId = jobDetail?.templateId;
//         const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } });

//         console.log("🔗 Template URL:", template?.template);

//         // 🔹 Convert Base64 Image to Buffer
//         const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
//         const imageBuffer = Buffer.from(base64Image, "base64");

//         let userData = {
//             EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
//             EMPLOYEE_EMAIL: existUser?.personalDetails?.email,
//             EMPLOYEE_CONTACT_NUMBER: existUser?.personalDetails?.phone,
//             JOB_START_DATE: "START_DATE",
//             EMPLOYEE_JOB_TITLE: "JOB_TITLE",
//             WEEKLY_HOURS: "WEEKLY_HOURS",
//             ANNUAL_SALARY: "ANNUAL_SALARY",
//             COMPANY_NAME: company?.companyDetails?.businessName,
//             SIGNATURE: "%SIGNATURE" // 🔹 This must match the template placeholder
//         };

//         const generatedTemp = await generateTemplateForUser(userData, templateId);
//         const docxBuffer = Buffer.from(generatedTemp, "binary");

//         // 🔹 Debugging Image Module
//         const imageModule = new ImageModule({
//             getImage(tag) {
//                 console.log("🔍 Checking tag:", tag)
//                 if (tag === "%SIGNATURE") {
//                     console.log("✅ Image module triggered! Returning image...");
//                     return imageBuffer;
//                 }
//                 throw new Error(`❌ Unknown image tag: ${tag}`);
//             },
//             getSize() {
//                 console.log("📏 Setting image size...");
//                 return [200, 100];
//             }
//         });

//         // 🔹 Load Template & Attach Image Module
//         const zip = new PizZip(docxBuffer);
//         const doc = new Docxtemplater(zip, { modules: [imageModule] });

//         console.log("📝 Rendering document with data...");
//         doc.render(userData);

//         const docText = doc.getFullText();
//         console.log("📄 DOCX Content:", docText);

//         const modifiedDocxBuffer = doc.getZip().generate({ type: "nodebuffer" });

//         // 🔹 Upload to Cloudinary
//         const uploadDocx = await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 { resource_type: "raw", format: "docx", folder: "documents" },
//                 (error, result) => {
//                     if (error) return reject(error);
//                     resolve(result);
//                 }
//             );
//             streamifier.createReadStream(modifiedDocxBuffer).pipe(uploadStream);
//         });

//         console.log("📄 New Document URL:", uploadDocx.secure_url);

//         return res.json({ message: "SUCCESS", url: uploadDocx.secure_url });
//     } catch (error) {
//         console.error("❌ Error occurred while saving template:", error);
//         res.status(500).json({ message: "Error occurred while saving template!" });
//     }
// };

// exports.saveTemplateWithSignature = async (req, res) => {
//     try {
//         const allowedRoles = ['Administrator', 'Manager', 'Employee'];
//         if (!allowedRoles.includes(req.user.role)) {
//             return res.status(403).json({ message: 'Access denied' });
//         }

//         const { image, jobId } = req.body;
//         const userId = req.user._id;

//         const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
//         if(!existUser){
//             return res.send({ status: 404, message: 'User not found' })
//         }

//         const company = await Company.findOne({ _id: existUser?.companyId, isDeleted: { $ne: true } })
//         if(!company){
//             return res.send({ status: 404, message: 'Company not found' })
//         }

//         const jobDetail = existUser?.jobDetails.find(job => job._id.toString() === jobId)
//         if(!jobDetail){
//             return res.send({ status: 404, message: 'JobTitle not found' })
//         }

//         const templateId = jobDetail?.templateId
//         const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } })
//         console.log('URL:', template?.template)

//         const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
//         const imageBuffer = Buffer.from(base64Image, "base64");

//         let userData = {
//             EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
//             EMPLOYEE_EMAIL: existUser?.personalDetails?.email,
//             EMPLOYEE_CONTACT_NUMBER: existUser?.personalDetails?.phone,
//             JOB_START_DATE: 'START_DATE',
//             EMPLOYEE_JOB_TITLE: 'JOB_TITLE',
//             WEEKLY_HOURS: 'WEEKLY_HOURS',
//             ANNUAL_SALARY: 'ANNUAL_SALARY',
//             COMPANY_NAME: company?.companyDetails?.businessName,
//             SIGNATURE_IMAGE: "SIGNATURE_IMAGE"
//         }

//         const generatedTemp = await generateTemplateForUser(userData, templateId)
//         const docxBuffer = Buffer.from(generatedTemp, 'base64');

//         const imageModule = new ImageModule({
//             getImage(tag) {
//                 console.log("Image Tag:", tag);  // Debugging
//                 if (tag === "SIGNATURE_IMAGE") {
//                     console.log("Image module triggered! Returning image...");
//                     return imageBuffer;
//                 }
//                 throw new Error(`Unknown image tag: ${tag}`);
//             },
//             getSize() {
//                 return [200, 100]; // Width & Height in pixels
//             }
//         });

//         const zip = new PizZip(docxBuffer);
//         const doc = new Docxtemplater(zip, { modules: [imageModule] });

//         // const imageBuffer = Buffer.from(image, 'base64')

//         console.log('Base64 Image:', image.substring(0, 50))
//         console.log('User Data:', userData)
//         doc.render(userData)

//         const modifiedDocxBuffer = doc.getZip().generate({ type: "nodebuffer" })

//         const uploadDocx = await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 { resource_type: 'raw', format: 'docx', folder: 'documents' },
//                 (error, result) => {
//                     if (error) return reject(error);
//                     resolve(result);
//                 }
//             );
//             streamifier.createReadStream(modifiedDocxBuffer).pipe(uploadStream);
//         });

//         console.log('New Document URL:', uploadDocx.secure_url);

//         // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

//         // const uploadDocx = await new Promise((resolve, reject) => {
//         //     const uploadStream = cloudinary.uploader.upload_stream(
//         //         { resource_type: 'raw', format: 'docx', folder: 'documents' },
//         //         (error, result) => {
//         //             if (error) return reject(error);
//         //             resolve(result);
//         //         }
//         //     );
//         //     streamifier.createReadStream(docxBuffer).pipe(uploadStream);
//         // });
//         // console.log('Generated URL:', uploadDocx.secure_url)

//         return res.send('SUCCESS')

//     } catch (error) {
//         console.error('Error occurred while saving template:', error)
//         res.send({ message: 'Error occurred while saving template!' })
//     }
// }

// exports.saveTemplateWithSignature = async (req, res) => {
//     try {
//         const allowedRoles = ["Administrator", "Manager", "Employee"];
//         if (!allowedRoles.includes(req.user.role)) {
//             return res.status(403).json({ message: "Access denied" });
//         }

//         const { image, jobId } = req.body;
//         const userId = req.user._id;

//         const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
//         if (!existUser) return res.status(404).json({ message: "User not found" });

//         const company = await Company.findOne({ _id: existUser?.companyId, isDeleted: { $ne: true } });
//         if (!company) return res.status(404).json({ message: "Company not found" });

//         const jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId);
//         if (!jobDetail) return res.status(404).json({ message: "JobTitle not found" });

//         const templateId = jobDetail?.templateId;
//         const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } });

//         console.log("🔗 Template URL:", template?.template);

//         // 🔹 Convert Base64 Image to Buffer
//         const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
//         const imageBuffer = Buffer.from(base64Image, "base64");
//         // console.log("🖼️ Image Buffer:", imageBuffer);

//         // 🔹 Debugging Image Module
//         const imageModule = new ImageModule({
//             getImage(tag) {
//                 console.log("🔍 Checking tag:", tag);
//                 if (tag === "SIGNATURE") {
//                     console.log("✅ Image module triggered! Returning image...");
//                     return imageBuffer;
//                 }
//                 console.log("❌ Unknown image tag:", tag);
//                 throw new Error(`Unknown image tag: ${tag}`);
//             },
//             getSize() {
//                 console.log("📏 Setting image size...");
//                 return [200, 100];
//             }
//         });

//         let userData = {
//             EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
//             EMPLOYEE_EMAIL: existUser?.personalDetails?.email,
//             EMPLOYEE_CONTACT_NUMBER: existUser?.personalDetails?.phone,
//             JOB_START_DATE: "START_DATE",
//             EMPLOYEE_JOB_TITLE: "JOB_TITLE",
//             WEEKLY_HOURS: "WEEKLY_HOURS",
//             ANNUAL_SALARY: "ANNUAL_SALARY",
//             COMPANY_NAME: company?.companyDetails?.businessName,
//             SIGNATURE: imageModule // 🔹 This must match the template placeholder
//         };
//         console.log('SIGNATURE:', userData.SIGNATURE)

//         const generatedTemp = await generateTemplateForUser(userData, templateId);
//         const docxBuffer = Buffer.from(generatedTemp, "base64");

//         const zip = new PizZip(docxBuffer);
//         const doc = new Docxtemplater(zip);

//         try {
//             console.log("📝 Rendering document with data...");
//             doc.render(userData);
//         } catch (error) {
//             console.error("❌ Error rendering document:", error);
//             throw error;
//         }

//         const docText = doc.getFullText();
//         console.log("📄 DOCX Content:", docText);

//         const modifiedDocxBuffer = doc.getZip().generate({ type: "nodebuffer" });

//         // 🔹 Upload to Cloudinary
//         const uploadDocx = await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 { resource_type: "raw", format: "docx", folder: "documents" },
//                 (error, result) => {
//                     if (error) return reject(error);
//                     resolve(result);
//                 }
//             );
//             streamifier.createReadStream(modifiedDocxBuffer).pipe(uploadStream);
//         });

//         console.log("📄 New Document URL:", uploadDocx.secure_url);

//         return res.json({ message: "SUCCESS", url: uploadDocx.secure_url });
//     } catch (error) {
//         console.error("❌ Error occurred while saving template:", error);
//         res.status(500).json({ message: "Error occurred while saving template!" });
//     }
// };

exports.saveTemplateWithSignature = async (req, res) => {
    // try {
    //     const allowedRoles = ["Administrator", "Manager", "Employee"];
    //     if (!allowedRoles.includes(req.user.role)) {
    //         return res.status(403).json({ message: "Access denied" });
    //     }

    //     const { image, jobId } = req.body;
    //     const userId = req.user._id;

    //     const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
    //     if (!existUser) return res.status(404).json({ message: "User not found" });

    //     const company = await Company.findOne({ _id: existUser?.companyId, isDeleted: { $ne: true } });
    //     if (!company) return res.status(404).json({ message: "Company not found" });

    //     const jobDetail = existUser?.jobDetails.find((job) => job._id.toString() === jobId);
    //     if (!jobDetail) return res.status(404).json({ message: "JobTitle not found" });

    //     const templateId = jobDetail?.templateId;
    //     const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } });

    //     if (!template) return res.status(404).json({ message: "Template not found" });

    //     console.log("🔗 Template URL:", template?.template);

    //     // Convert Base64 Image to Buffer
    //     const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
    //     const imageBuffer = Buffer.from(base64Image, "base64");

    //     // Initialize Image Module
    //     const imageModule = new ImageModule({
    //         centered: true,
    //         getImage(tag) {
    //             console.log('checking tag name')
    //             if (tag === "SIGNATURE") {
    //                 return imageBuffer;
    //             }
    //             throw new Error(`Unknown image tag: ${tag}`);
    //         },
    //         getSize() {
    //             return [200, 100];
    //         }
    //     });

    //     const userData = {
    //         EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
    //         EMPLOYEE_EMAIL: existUser?.personalDetails?.email,
    //         EMPLOYEE_CONTACT_NUMBER: existUser?.personalDetails?.phone,
    //         JOB_START_DATE: "START_DATE",
    //         EMPLOYEE_JOB_TITLE: "JOB_TITLE",
    //         WEEKLY_HOURS: "WEEKLY_HOURS",
    //         ANNUAL_SALARY: "ANNUAL_SALARY",
    //         COMPANY_NAME: company?.companyDetails?.businessName,
    //         SIGNATURE: "SIGNATURE" // The tag should match the one inside the DOCX template
    //     };

    //     // Load Template
    //     const generatedTemp = await generateTemplateForUser(userData, templateId);
    //     const docxBuffer = Buffer.from(generatedTemp, "base64");

    //     const zip = new PizZip(docxBuffer);
    //     const doc = new Docxtemplater(zip, {
    //         modules: [imageModule] // Register Image Module
    //     }, { paragraphLoop: true, linebreaks: true });
    //     doc.compile();

    //     // Populate Template Data
        

    //     console.log("📄 Replacing placeholders in template...");
    //     doc.render({ SIGNATURE: image });

    //     // Generate the final DOCX buffer
    //     const modifiedDocxBuffer = doc.getZip().generate({ type: "nodebuffer" });

    //     // Upload to Cloudinary
    //     const uploadDocx = await new Promise((resolve, reject) => {
    //         const uploadStream = cloudinary.uploader.upload_stream(
    //             { resource_type: "raw", format: "docx", folder: "documents" },
    //             (error, result) => {
    //                 if (error) return reject(error);
    //                 resolve(result);
    //             }
    //         );
    //         streamifier.createReadStream(modifiedDocxBuffer).pipe(uploadStream);
    //     });

    //     console.log("📄 New Document URL:", uploadDocx.secure_url);

    //     return res.json({ message: "SUCCESS", url: uploadDocx.secure_url });
    // } catch (error) {
    //     console.error("❌ Error occurred while saving template:", error);
    //     res.status(500).json({ message: "Error occurred while saving template!" });
    // }
};
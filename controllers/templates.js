const Template = require('../models/template');
const User = require('../models/user');
const Company = require('../models/company');
const cloudinary = require('../utils/cloudinary');
const moment = require('moment');
const { default: axios } = require("axios");
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free')
const streamifier = require('streamifier')

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

exports.generateEmployeeTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { jobId, image } = req.body
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
                COMPANY_NAME: company?.companyDetails?.businessName
            }

            const generatedTemp = await generateTemplateForUser(userData, templateId)

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            return res.send(generatedTemp)

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

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while generating employee template:', error)
        res.send({ message: 'Error occurred while generating employee template!' })
    }
}

exports.saveTemplateWithSignature = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { generatedDoc, image } = req.body
            if(!image){
                return res.send({ status: 400, message: 'Sign is required!' })
            }

            // Convert base64 image to buffer
            const imageBuffer = Buffer.from(image, 'base64')

            // Load the DOCX file from buffer
            const zip = new PizZip(Buffer.from(generatedDoc, 'base64')) // Convert base64 DOCX to buffer
            const doc = new Docxtemplater(zip, {
                modules: [
                    new ImageModule({
                        getImage: () => imageBuffer,
                        getSize: () => [200, 200] // Set the size of the image
                    })
                ]
            })

            doc.render()
            const modifiedDoc = doc.getZip().generate({ type: 'nodebuffer' })

            return modifiedDoc


        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.log('Error occurred while saving template:', error)
        res.send({ message: 'Error occurred while saving template!' })
    }
}
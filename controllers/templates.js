const Template = require('../models/template');
const cloudinary = require('../utils/cloudinary');
const moment = require('moment');

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
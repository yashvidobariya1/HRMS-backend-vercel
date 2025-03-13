const Template = require('../models/template');
const User = require('../models/user');
const Company = require('../models/company');
const cloudinary = require('../utils/cloudinary');
const axios = require("axios");
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
                        format: "docx"
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

exports.previewTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { jobId } = req.body
            const userId = req.user._id

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            const company = await Company.findOne({ _id: existUser?.companyId.toString(), isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            const jobDetail = existUser?.jobDetails.find(job => job?._id.toString() == jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const templateId = jobDetail?.templateId
            const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } })
            if(!template){
                return res.send({ status: 404, message: 'Template not found' })
            }

            const templateUrl = template?.template
            const userData = {
                EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
                EMPLOYEE_EMAIL: `${existUser?.personalDetails?.email}`,
                EMPLOYEE_CONTACT_NUMBER: `${existUser?.personalDetails?.phone}`,
                JOB_START_DATE: `${jobDetail?.joiningDate}`,
                EMPLOYEE_JOB_TITLE: `${jobDetail?.jobTitle}`,
                EMPLOYEE_JOB_ROLE: `${jobDetail?.role}`,
                WEEKLY_HOURS: `${jobDetail?.weeklyWorkingHours}`,
                ANNUAL_SALARY: `${jobDetail?.annualSalary}`,
                COMPANY_NAME: `${company?.companyDetails?.businessName}`
            }

            return res.send({ status: 200, templateUrl, userData })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while showing template:', error)
        res.send({ message: 'Error occurred while showing template!' })
    }
}

exports.saveTemplateWithSignature = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { jobId, base64OfTemplate } = req.body
            const userId = req.user._id

            if(!base64OfTemplate){
                return res.send({ status: 400, message: 'Please upload the template!' })
            }

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            const jobDetail = existUser.jobDetails.find(job => job._id.toString() === jobId)
            if(!jobDetail){
                return res.send({ status: 404, message: 'JobTitle not found' })
            }

            const result = await cloudinary.uploader.upload(base64OfTemplate, {
                resource_type: "auto",
                folder: 'userTemplates',
                format: "docx"
            })

            existUser?.jobDetails.map(job => {
                if(job._id.toString() === jobId){
                    job.signedTemplateURL = result?.secure_url
                }
            })

            await existUser.save()

            return res.send({ status: 200, message: 'Signed template saved successfully', URL: result?.secure_url })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while saving signature:', error)
        res.send('Error occurred while saving signature!')
    }
}
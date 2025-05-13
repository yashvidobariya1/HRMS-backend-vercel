const Template = require('../models/template');
const User = require('../models/user');
const Company = require('../models/company');
const moment = require('moment');
const mammoth = require('mammoth');
const { uploadToS3, unique_Id } = require('../utils/AWS_S3');
const axios = require('axios');
const path = require('path');
const pdfParse = require('pdf-parse');
const textract = require('textract');

const extractPlaceholders = (text) => {
    const placeholderRegex = /{(.*?)}/g
    let matches = text.match(placeholderRegex)
    return matches ? matches.map(match => match.replace(/{{|}}/g, '').trim()) : []
};

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
    
            const requiredKeys = process.env.REQUIRED_KEY_FOR_TEMPLATE.split(',')
                .map(key => key.replace(/^{|}$/g, '').trim().toUpperCase())
    
            let extractedKeys = []

            const document = template

            if(template.startsWith('data:')){
                template = template.split(',')[1]
            }

            if (templateFileName.endsWith('.pdf')) {
                try {
                    const pdfBuffer = Buffer.from(template, 'base64')
                    const pdfData = await pdfParse(pdfBuffer)
                    
                    if (!pdfData || !pdfData.text) {
                        throw new Error("PDF extraction failed: No text found.")
                    }

                    extractedKeys = extractPlaceholders(pdfData.text).map(key => key.replace(/^{|}$/g, '').trim().toUpperCase())

                    if (pdfData.text.includes('SIGNATURE')) {
                        extractedKeys.push('SIGNATURE');
                    }    
                } catch (pdfError) {
                    console.error("PDF Parsing Error:", pdfError)
                    return res.send({ status: 400, message: "Error parsing the PDF file. Ensure it contains selectable text." })
                }
            } else if (templateFileName.endsWith('.docx') || templateFileName.endsWith('.doc')) {
                try {
                    console.log('in')
                    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(template, 'base64') })
                    console.log('value:', value)
                    if (!value) {
                        throw new Error("DOCX extraction failed: No text found.")
                    }
    
                    extractedKeys = extractPlaceholders(value).map(key => key.replace(/^{|}$/g, '').trim().toUpperCase())
    
                    if (value.includes('SIGNATURE')) {
                        extractedKeys.push('SIGNATURE')
                    }    
                } catch (docxError) {
                    console.error("DOCX Parsing Error:", docxError)
                    return res.send({ status: 400, message: "Error parsing the DOCX file. Ensure it is a valid document." })
                }
            }

            if(templateFileName.endsWith('.pdf') || templateFileName.endsWith('.docx')){
                extractedKeys = [...new Set(extractedKeys)]
        
                const missingKeys = requiredKeys.filter(key => !extractedKeys.includes(key))
                // console.log('missingKeys:', missingKeys)
                const extraKeys = extractedKeys.filter(key => !requiredKeys.includes(key))
                // console.log('extraKeys:', extraKeys)

                if (missingKeys.length > 0 || extraKeys.length > 0) {
                // if (extraKeys.length > 0) {
                    return res.send({
                        status: 400,
                        message: `Template file contains invalid placeholders.` +
                            (missingKeys.length > 0 ? ` Missing keys: ${missingKeys.join(", ")}.` : '') +
                            (extraKeys.length > 0 ? ` Extra keys: ${extraKeys.join(", ")}.` : '')
                    })
                }
            }

            let documentURL
            if (template) {
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing template document');
                    return res.send({ status: 400, message: "Invalid or missing template document." });
                }
                try {
                    const fileName = unique_Id()
                    let element = await uploadToS3(document, 'Templates', fileName)
                    documentURL = element?.fileUrl
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to AWS:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const { firstName, lastName } = req.user?.personalDetails;
            const name = [firstName, lastName].filter(Boolean).join(" ");
            const templateForm = {
                templateName,
                template: documentURL,
                templateFileName,
                creatorId: req.user._id,
                createdRole: req.user.role,
                uploadBy: name,
                // companyId: companyId,
                // companyName: company?.companyDetails?.businessName
            }
            // console.log('new templateForm', templateForm)
            const newTemplate = await Template.create(templateForm)

            return res.send({ status: 200, message: `Template form created successfully.`, newTemplate })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while creating template form:', error)
        return res.send({ status: 500, message: 'Error occurred while creating templates form!' })
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
        return res.send({ status: 500, message: 'Error occurred while fetching template!' })
    }
}

exports.getAllTemplates = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if(searchQuery){
                baseQuery['templateName'] = { $regex: searchQuery, $options: "i" }
            }

            const templates = await Template.find(baseQuery).skip(skip).limit(limit)
            const totalTemplates = await Template.find(baseQuery).countDocuments()

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
        return res.send({ status: 500, message: 'Error occurred while fetching templates!' })
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

            const requiredKeys = process.env.REQUIRED_KEY_FOR_TEMPLATE.split(',').map(key => key.trim())
            let extractedKeys = []

            let documentURL = isExist?.template;

            if (template && template.startsWith('data:')) {
                const document = template
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing template document')
                    return res.send({ status: 400, message: "Invalid or missing template document." })
                }

                const base64Data = template.split(',')[1]
                const buffer = Buffer.from(base64Data, 'base64')

                if (templateFileName.endsWith('.pdf')) {
                    try {
                        const pdfData = await pdfParse(buffer)
                        if (!pdfData || !pdfData.text) {
                            throw new Error("PDF extraction failed: No text found.")
                        }
                        extractedKeys = extractPlaceholders(pdfData.text)
                    } catch (pdfError) {
                        console.error("PDF Parsing Error:", pdfError)
                        return res.send({ status: 400, message: "Error parsing the PDF file. Ensure it contains selectable text." })
                    }
                } else if (templateFileName.endsWith('.docx')) {
                    try {
                        const { value } = await mammoth.extractRawText({ buffer })
                        if (!value) {
                            throw new Error("DOCX extraction failed: No text found.")
                        }
                        extractedKeys = extractPlaceholders(value)
                    } catch (docxError) {
                        console.error("DOCX Parsing Error:", docxError)
                        return res.send({ status: 400, message: "Error parsing the DOCX file. Ensure it is a valid document." })
                    }
                } else {
                    return res.send({ status: 400, message: "Unsupported file format. Only PDF and DOCX are allowed." })
                }

                const missingKeys = requiredKeys.filter(key => !extractedKeys.includes(key))
                const extraKeys = extractedKeys.filter(key => !requiredKeys.includes(key))

                if (missingKeys.length > 0 || extraKeys.length > 0) {
                    return res.send({
                        status: 400,
                        message: `Template file contains invalid placeholders. ${missingKeys.length > 0 ? `Missing keys: ${missingKeys.join(", ")}` : ''} ${extraKeys.length > 0 ? `Extra keys: ${extraKeys.join(", ")}` : ''}`,
                    })
                }

                try {
                    const fileName = unique_Id()
                    let element = await uploadToS3(document, 'Templates', fileName)

                    documentURL = element?.fileUrl
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to AWS:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const updatedTemplate = await Template.findByIdAndUpdate(
                { _id: templateId },
                {
                    $set: {
                        templateName,
                        template: documentURL,
                        templateFileName,
                        updatedAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: `Template details updated successfully.`, updatedTemplate })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while updating template details:", error);
        return res.send({ status: 500, message: "Something went wrong while updating template details!" })
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
                        canceledAt: moment().toDate()
                    }
                }
            )

            return res.send({ status: 200, message: 'Template deleted successfully.', deletedTemplate })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing template:", error);
        return res.send({ status: 500, message: "Something went wrong while removing template!" })
    }
}

// async function checkPlaceholdersInTemplate(url, placeholders) {
//     const response = await axios.get(url, { responseType: 'arraybuffer' });
//     const buffer = Buffer.from(response.data);
//     const ext = path.extname(url).toLowerCase();
  
//     let text = '';
  
//     if (ext === '.docx') {
//         const result = await mammoth.extractRawText({ buffer });
//         text = result.value;
//     } else if (ext === '.pdf') {
//         const result = await pdfParse(buffer);
//         text = result.text;
//     } else {
//         throw new Error('Unsupported file format');
//     }

//     const result = {};
//     placeholders.forEach(key => {
//         if (key === 'Signature') {
//             result.isSignatureRequired = text.includes(key);
//             console.log(`Signature ${result.isSignatureRequired ? 'found' : 'not found'} in template`);
//         } else {
//             result[key] = text.includes(key);
//         }
//     })
  
//     return result;
// }

exports.previewTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { jobId, templateId } = req.body
            const userId = req.user._id

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            const existTemplate = existUser?.templates.find(temp => temp?.templateId.toString() == templateId)


            const company = await Company.findOne({ _id: existUser?.companyId.toString(), isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            // const jobDetail = existUser?.jobDetails.find(job => job?._id.toString() == jobId)
            // if(!jobDetail){
            //     return res.send({ status: 404, message: 'JobTitle not found' })
            // }

            // const templateId = jobDetail?.templateId
            const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } })
            if(!template){
                return res.send({ status: 404, message: 'Template not found' })
            }

            const templateUrl = template?.template
            const userData = {
                EMPLOYEE_NAME: `${existUser?.personalDetails?.firstName} ${existUser?.personalDetails?.lastName}`,
                EMPLOYEE_EMAIL: `${existUser?.personalDetails?.email}`,
                EMPLOYEE_CONTACT_NUMBER: `${existUser?.personalDetails?.phone}`,
                // JOB_START_DATE: `${jobDetail?.joiningDate}`,
                // EMPLOYEE_JOB_TITLE: `${jobDetail?.jobTitle}`,
                // EMPLOYEE_JOB_ROLE: `${jobDetail?.role}`,
                // WEEKLY_HOURS: `${jobDetail?.weeklyWorkingHours}`,
                // ANNUAL_SALARY: `${jobDetail?.annualSalary}`,
                COMPANY_NAME: `${company?.companyDetails?.businessName}`
            }
            
            return res.send({
                status: 200,
                templateUrl,
                userData,
                isSignActionRequired: existTemplate?.isSignRequired,
                isTemplateReadActionRequired: existTemplate?.isReadRequired
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while showing template:', error)
        return res.send({ status: 500, message: 'Error occurred while showing template!' })
    }
}

exports.readTemplate = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { templateId } = req.body

            const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } })
            if(!template){
                return res.send({ status: 404, message:' Template not found' })
            }

            const existUser = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } }).select('templates')
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            existUser?.templates.map(temp => {
                if(temp.templateId.toString() == templateId){
                    temp.isTemplateVerify = true
                }
            })

            await existUser.save()

            return res.send({ status: 200, message: 'Template read successfully.', existUser })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while reading template:', error)
        return res.send({ status: 500, message: 'Error occurred while reading template!' })
    }
}

exports.saveTemplateWithSignature = async (req, res) => {
    try {
        const allowedRoles = ['Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const { templateId, base64OfTemplate } = req.body
            const userId = req.user._id

            if(!base64OfTemplate){
                return res.send({ status: 400, message: 'Please upload the template!' })
            }

            const existUser = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
            if(!existUser){
                return res.send({ status: 404, message: 'User not found' })
            }

            const template = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } })
            if(!template){
                return res.send({ status: 404, message: 'Template not found' })
            }

            // const jobDetail = existUser.jobDetails.find(job => job._id.toString() === jobId)
            // if(!jobDetail){
            //     return res.send({ status: 404, message: 'JobTitle not found' })
            // }

            const filename = unique_Id()
            const result = await uploadToS3(base64OfTemplate, 'userTemplates', filename)

            // existUser?.jobDetails.map(job => {
            //     if(job._id.toString() === jobId){
            //         job.isTemplateSigned = true
            //         job.signedTemplateURL = result?.fileUrl
            //     }
            // })

            existUser?.templates.map(temp => {
                if(templateId == temp?.templateId){
                    temp.isTemplateVerify = true
                    temp.templateURL = result?.fileUrl
                }
            })

            await existUser.save()

            return res.send({ status: 200, message: 'Signed template saved successfully', URL: result?.fileUrl })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while saving signature:', error)
        return res.send({ status: 500, message: 'Error occurred while saving signature!' })
    }
}

exports.assignTemplateToUsers = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administartor']
        if(allowedRoles.includes(req.user.role)){
            const { templateId, userIds, signatureRequired } = req.body

            if (!templateId) {
                return res.send({ status: 400, message: 'Template ID and User IDs are required.' })
            }

            if(!Array.isArray(userIds) || userIds.length === 0){
                return res.send({ status: 400, message: 'Atleast select one user for assigned template.' })
            }

            const existTemplate = await Template.findOne({ _id: templateId, isDeleted: { $ne: true } })
            if(!existTemplate){
                return res.send({ status: 404, message: 'Template not found' })
            }

            const usersWithTemplate = await User.find({
                _id: { $in: userIds },
                templates: { $elemMatch: { templateId: templateId } }
            }).select('_id')

            const userIdsWithTemplate = usersWithTemplate.map(user => user._id.toString())

            const usersToAssign = userIds.filter(id => !userIdsWithTemplate.includes(id))

            if (usersToAssign.length > 0) {
                await User.updateMany(
                    { _id: { $in: usersToAssign } },
                    {
                        $addToSet: {
                            templates: {
                                templateId: templateId,
                                templateURL: existTemplate?.template,
                                isSignRequired: signatureRequired,
                                isReadRequired: signatureRequired == true ? false : true,
                                isTemplateVerify: false,
                            }
                        }
                    }
                )
            }

            return res.send({ status: 200, message: 'Template assigned successfully to users.' })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while assigning template:', error)
        return res.send({ status: 500, message: 'Error occurred while assigning template!' })
    }
}
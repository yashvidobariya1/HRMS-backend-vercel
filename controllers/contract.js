const Company = require("../models/company");
const Contract = require("../models/contract");
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const moment = require('moment');
const User = require("../models/user");
const { unique_Id, uploadToS3 } = require("../utils/AWS_S3");

// const User = require("../models/user");
// const axios = require('axios');
// const fs = require('fs');
// const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// const pdfform = require('pdfform.js');

const extractPlaceholders = (text) => {
    const placeholderRegex = /{(.*?)}/g
    let matches = text.match(placeholderRegex)
    return matches ? matches.map(match => match.replace(/{{|}}/g, '').trim()) : []
};

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

            const requiredKeys = process.env.REQUIRED_KEY_FOR_CONTRACT.split(',').map(key => key.trim())
            let extractedKeys = []

            const document = contract

            if(contract.startsWith('data:')){
                contract = contract.split(',')[1]
            }

            if (contractFileName.endsWith('.pdf')) {
                try {
                    const pdfBuffer = Buffer.from(contract, 'base64')
                    const pdfData = await pdfParse(pdfBuffer)
                    
                    if (!pdfData || !pdfData.text) {
                        throw new Error("PDF extraction failed: No text found.")
                    }

                    extractedKeys = extractPlaceholders(pdfData.text)
                } catch (pdfError) {
                    console.error("PDF Parsing Error:", pdfError)
                    return res.send({ status: 400, message: "Error parsing the PDF file. Ensure it contains selectable text." })
                }
            } else if (contractFileName.endsWith('.docx')) {
                try {
                    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(contract, 'base64') })
                    
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

            // const missingKeys = requiredKeys.filter(key => !extractedKeys.includes(key));
            // console.log('requiredKeys:', requiredKeys)
            const extraKeys = extractedKeys.filter(key => !requiredKeys.includes(key))
            // console.log('extraKeys:', extraKeys)

            // if (missingKeys.length > 0 || extraKeys.length > 0) {
            if (extraKeys.length > 0) {
                return res.send({
                    status: 400,
                    message: "Contract file contains invalid placeholders.",
                    // missingKeys: missingKeys.length > 0 ? `Missing keys: ${missingKeys.join(", ")}` : null,
                    extraKeys: extraKeys.length > 0 ? `Extra keys: ${extraKeys.join(", ")}` : null
                })
            }

            let documentURL
            if (contract) {
                if (!document || typeof document !== 'string') {
                    console.log('Invalid or missing contract document');
                    return res.send({ status: 400, message: "Invalid or missing contract document." });
                }
                try {
                    const fileName = unique_Id()

                    let element = await uploadToS3(document, 'contracts', fileName)
                    documentURL = element?.fileUrl
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to AWS:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const { firstName, lastName } = req.user.personalDetails;
            const name = [firstName, lastName].filter(Boolean).join(" ");
            const contractForm = {
                contractName,
                contract: documentURL,
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
        return res.send({ status: 500, message: "Something went wrong while adding contract form!" })
    }
}

exports.getAllContract = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if(req.user.role === 'Administrator' || req.user.role === 'Manager'){
                baseQuery.companyId = req.user.companyId
            }

            if (searchQuery) {
                baseQuery["contractName"] = { $regex: searchQuery, $options: "i" }
            }

            // const [result] = await Contract.aggregate([
            //     { $match: baseQuery },
            //     {
            //         $facet: {
            //             contract: [
            //                 { $skip: skip },
            //                 { $limit: limit },
            //                 {
            //                     $project: {
            //                         _id: 1,
            //                         'contractName': 1,
            //                         'contractFileName': 1,
            //                         'companyName': 1,
            //                         'uploadBy': 1,
            //                         'updatedAt': 1,
            //                     }
            //                 }
            //             ],
            //             total: [
            //                 { $count: "total" }
            //             ]
            //         }
            //     }
            // ])

            const allContracts = await Contract.find(baseQuery).skip(skip).limit(limit)

            const filteredData = await Promise.all(
                allContracts.map(async contract => {
                    const company = await Company.findOne({ _id: contract?.companyId, isDeleted: { $ne: true } }).select('companyDetails.businessName').lean()
                    const uploadBy = await User.findOne({ _id: contract?.creatorId, isDeleted: { $ne: true } }).select('personalDetails.firstName personalDetails.lastName').lean()
                    return {
                        _id: contract?._id,
                        contractName: contract?.contractName,
                        contractFileName: contract?.contractFileName,
                        contract: contract?.contract,
                        companyName: company?.companyDetails?.businessName,
                        uploadBy: `${uploadBy?.personalDetails?.lastName ? `${uploadBy?.personalDetails?.firstName} ${uploadBy?.personalDetails?.lastName}` : `${uploadBy?.personalDetails?.firstName}`}`,
                        updatedAt: contract?.updatedAt
                    }
                })
            )
            const contracts = filteredData.slice(skip, skip + limit)
            const totalContracts = filteredData.length

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
        return res.send({ status: 500, message: "Something went wrong while fetching contract form!" })
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50

    //         const skip = (page - 1) * limit

    //         let contracts
    //         let totalContracts
    //         if(req.user.role === 'Superadmin'){
    //             contracts = await Contract.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
    //             totalContracts = await Contract.find({ isDeleted: { $ne: true } }).countDocuments()
    //         } else {
    //             contracts = await Contract.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
    //             totalContracts = await Contract.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).countDocuments()
    //         }

    //         return res.send({
    //             status: 200,
    //             message: 'Contracts fetched successfully.',
    //             contracts,
    //             totalContracts,
    //             totalPages: Math.ceil(totalContracts / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while fetching contract form:", error);
    //     return res.send({ status: 500, message: "Something went wrong while fetching contract form!" })
    // }
}

exports.getAllContractOfCompany = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit
            const companyId = req.body.companyId || req.user.companyId
            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            let baseQuery = { companyId, isDeleted: { $ne: true } }

            if (searchQuery) {
                baseQuery["contractName"] = { $regex: searchQuery, $options: "i" }
            }

            const contracts = await Contract.find(baseQuery).skip(skip).limit(limit)

            const totalContracts = await Contract.find(baseQuery).countDocuments()

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
        return res.send({ status: 500, message: "Something went wrong while fetching contract form!" })
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
        return res.send({ status: 500, message: "Something went wrong while fetching Contract!" })
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
                    const fileName = unique_Id()
                    let element = await uploadToS3(document, 'contracts', fileName)
                    contract = element?.fileUrl
                } catch (uploadError) {
                    console.error("Error occurred while uploading file to AWS:", uploadError);
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
        return res.send({ status: 500, message: "Something went wrong while updating contract details!" })
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
        return res.send({ status: 500, message: "Something went wrong while removing contract!" })
    }
}

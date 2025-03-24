const Company = require("../models/company");
const Contract = require("../models/contract");
const cloudinary = require('../utils/cloudinary');
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
  
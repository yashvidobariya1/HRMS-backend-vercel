const Company = require("../models/company");
const Location = require("../models/location");
const cloudinary = require('../utils/cloudinary')
const moment = require('moment')

exports.addCompany = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            let {
                companyDetails,
                employeeSettings,
                contractDetails
            } = req.body

            let companyLogoImg
            if(companyDetails.companyLogo){
                const document = companyDetails.companyLogo
                if (!document || typeof document !== 'string') {
                    console.log(`Invalid or missing document for item`)
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "companyLogos",
                    });
                    // console.log('Cloudinary response:', element);
                    companyLogoImg = element?.secure_url
                } catch (uploadError) {
                    console.error("Error occurred while uploading file:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const newCompany = {
                companyDetails: {
                    ...companyDetails,
                    companyLogo: companyLogoImg
                },
                employeeSettings,
                contractDetails
            }

            // console.log('new company', newCompany)
            const company = await Company.create(newCompany)
            // console.log('company/...', company)

            const newLocation = {
                companyId: company._id,
                payeReferenceNumber: company?.companyDetails?.payeReferenceNumber,
                locationName: company?.companyDetails?.locationName || "Head Office",
                latitude: "",
                longitude: "",
                radius: "",
                address: company?.companyDetails?.address,
                addressLine2: company?.companyDetails?.addressLine2,
                city: company?.companyDetails?.city,
                postcode: company?.companyDetails?.postCode,
                country: company?.companyDetails?.country
            }
            // console.log('location:', newLocation)
            await Location.create(newLocation)

            return res.send({ status: 200, message: 'Company created successfully.', company })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while adding company:", error);
        res.send({ message: "Something went wrong while adding company!" })
    }
}

exports.getCompany = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const companyId = req.params.id
            if (!companyId || companyId == 'undefined' || companyId == 'null') {
                return res.send({ status: 404, message: 'Company not found' })
            }
            const company = await Company.findOne({
                _id: companyId,
                isDeleted: { $ne: true }
            });

            if (!company) {
                return res.send({ status: 404, message: 'Company not found' })
            }

            return res.send({ status: 200, message: 'Company fetched successfully.', company })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching company:", error);
        res.send({ message: "Something went wrong while fetching company!" })
    }
}

exports.getAllCompany = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            // const companies = await Company.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
            // const totalCompanies = await Company.find({ isDeleted: { $ne: true } }).countDocuments()

            let companies
            let totalCompanies

            if(req.user.role == 'Superadmin'){
                companies = await Company.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalCompanies = await Company.find({ isDeleted: { $ne: true } }).countDocuments()
            } else if(req.user.role == 'Administrator'){
                companies = await Company.find({ _id: req.user.companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalCompanies = await Company.find({ _id: req.user.companyId, isDeleted: { $ne: true } }).countDocuments()
            }

            return res.send({
                status: 200,
                message: 'Companines fetched successfully.',
                companies,
                totalCompanies,
                totalPages: Math.ceil(totalCompanies / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching companies:", error);
        res.send({ message: "Something went wrong while fetching companies!" })
    }
}

exports.updateCompanyDetails = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const companyId = req.params.id

            const company = await Company.findOne({
                _id: companyId,
                isDeleted: { $ne: true }
            });

            if (!company) {
                return res.send({ status: 404, message: 'Company not found' })
            }

            let {
                companyDetails,
                employeeSettings,
                contractDetails
            } = req.body

            let companyLogoImg
            if(companyDetails.companyLogo){
                const document = companyDetails.companyLogo
                if (!document || typeof document !== 'string') {
                    console.log(`Invalid or missing document for item`)
                }
                try {
                    if(document.startsWith('data:')){
                        let element = await cloudinary.uploader.upload(document, {
                            resource_type: "auto",
                            folder: "companyLogos",
                        });
                        // console.log('Cloudinary response:', element);
                        companyLogoImg = element?.secure_url
                    } else {
                        companyLogoImg = document
                    }
                } catch (uploadError) {
                    console.error("Error occurred while uploading file:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            let updatedCompany = await Company.findByIdAndUpdate(
                { _id: companyId },
                {
                    $set: {
                        companyDetails: {
                            ...companyDetails,
                            companyLogo: companyLogoImg
                        },
                        employeeSettings,
                        contractDetails,
                        updatedAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Company details updated successfully.', updatedCompany })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while updating company details:", error);
        res.send({ message: "Something went wrong while updating company details!" })
    }
}

exports.deleteCompany = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const companyId = req.params.id

            const company = await Company.findOne({
                _id: companyId,
                isDeleted: { $ne: true }
            });

            if (!company) {
                return res.send({ status: 404, message: 'Company not found' })
            }

            let deletedCompany = await Company.findByIdAndUpdate(companyId, {
                $set: {
                    isDeleted: true,
                    canceledAt: moment().toDate()
                }
            })

            return res.send({ status: 200, message: 'Company deleted successfully.', deletedCompany })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing company:", error);
        res.send({ message: "Something went wrong while removing company!" })
    }
}
const Company = require("../models/company");
const Location = require("../models/location");
const moment = require('moment')
const sharp = require('sharp')
const { uploadToS3, unique_Id } = require('../utils/AWS_S3');
const User = require("../models/user");

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
                    const matches = document.match(/^data:(image\/\w+);base64,(.+)$/)
                    if (!matches || matches.length !== 3) {
                        return res.send({ status: 400, message: 'Invalid Image Format!' })
                    }

                    const imageBuffer = Buffer.from(matches[2], 'base64')

                    const compressedBuffer = await sharp(imageBuffer)
                        .toFormat("jpeg", { quality: 70 })
                        .toBuffer()

                    const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`

                    const fileName = unique_Id()

                    const element = await uploadToS3(compressedBase64, 'companyLogos', fileName)
                    // console.log('AWS response:', element)
                    companyLogoImg = element?.fileUrl
                } catch (uploadError) {
                    console.error("Error occurred while uploading file:", uploadError);
                    return res.send({ status: 500, message: "Error occurred while uploading file. Please try again." });
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
        return res.send({ status: 500, message: "Something went wrong while adding company!" })
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

            const admins = await User.find({ companyId, role: 'Administrator', isDeleted: { $ne: true } })
            const formattedAdmins = admins.map(admin => ({
                _id: admin._id,
                name: admin?.personalDetails?.lastName ? `${admin?.personalDetails?.firstName} ${admin?.personalDetails?.lastName}` : `${admin?.personalDetails?.firstName}`
            }))

            const company = await Company.findOne({
                _id: companyId,
                isDeleted: { $ne: true }
            });

            if (!company) {
                return res.send({ status: 404, message: 'Company not found' })
            }

            return res.send({ status: 200, message: 'Company fetched successfully.', company, companyAdmins: formattedAdmins.length > 0 ? formattedAdmins : [] })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching company:", error);
        return res.send({ status: 500, message: "Something went wrong while fetching company!" })
    }
}

exports.getAllCompany = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if (req.user.role !== 'Superadmin') {
                baseQuery._id = req.user.companyId
            }

            if (searchQuery) {
                baseQuery["companyDetails.businessName"] = { $regex: searchQuery, $options: "i" }
            }

            const [result] = await Company.aggregate([
                { $match: baseQuery },
                {
                    $facet: {
                        companies: [
                            { $skip: skip },
                            { $limit: limit },
                            {
                                $project: {
                                    _id: 1,
                                    'companyDetails.businessName': 1,
                                    'companyDetails.companyCode': 1,
                                    'companyDetails.city': 1,
                                }
                            }
                        ],
                        total: [
                            { $count: 'count' }
                        ]
                    }
                }
            ])
        
            const companies = result.companies || []
            const totalCompanies = result.total.length > 0 ? result.total[0].count : 0

            return res.send({
                status: 200,
                message: 'Companies fetched successfully.',
                companies,
                totalCompanies,
                totalPages: Math.ceil(totalCompanies / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching companies:", error);
        return res.send({ status: 500, message: "Something went wrong while fetching companies!" })
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50

    //         const skip = (page - 1) * limit

    //         // const companies = await Company.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
    //         // const totalCompanies = await Company.find({ isDeleted: { $ne: true } }).countDocuments()

    //         let companies
    //         let totalCompanies

    //         if(req.user.role == 'Superadmin'){
    //             companies = await Company.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
    //             totalCompanies = await Company.find({ isDeleted: { $ne: true } }).countDocuments()
    //         } else if(req.user.role == 'Administrator'){
    //             companies = await Company.find({ _id: req.user.companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
    //             totalCompanies = await Company.find({ _id: req.user.companyId, isDeleted: { $ne: true } }).countDocuments()
    //         }

    //         return res.send({
    //             status: 200,
    //             message: 'Companies fetched successfully.',
    //             companies,
    //             totalCompanies,
    //             totalPages: Math.ceil(totalCompanies / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while fetching companies:", error);
    //     return res.send({ status: 500, message: "Something went wrong while fetching companies!" })
    // }
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
                        const matches = document.match(/^data:(image\/\w+);base64,(.+)$/)
                        if (!matches || matches.length !== 3) {
                            return res.send({ status: 400, message: 'Invalid Image Format!' })
                        }

                        const imageBuffer = Buffer.from(matches[2], 'base64')

                        const compressedBuffer = await sharp(imageBuffer)
                            .toFormat("jpeg", { quality: 70 })
                            .toBuffer()

                        const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`

                        const fileName = unique_Id()

                        const element = await uploadToS3(compressedBase64, 'companyLogos', fileName)
                        // console.log('AWS response:', element)
                        companyLogoImg = element?.fileUrl
                    } else {
                        companyLogoImg = document
                    }
                } catch (uploadError) {
                    console.error("Error occurred while uploading file:", uploadError);
                    return res.send({ status: 500, message: "Error occurred while uploading file. Please try again." });
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
        return res.send({ status: 500, message: "Something went wrong while updating company details!" })
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

            await Location.updateMany(
                { companyId, isDeleted: { $ne: true } },
                { $set: { isDeleted: true } }
            )

            await User.updateMany(
                { companyId, isDeleted: { $ne: true } },
                { $set: { isDeleted: true } }
            )

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
        return res.send({ status: 500, message: "Something went wrong while removing company!" })
    }
}
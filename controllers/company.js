const Company = require("../models/company")
const cloudinary = require('../utils/cloudinary')

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
                const isValidImage = document.startsWith("data:image/png;base64,") || document.startsWith("data:image/jpeg;base64,");
                if (!isValidImage) {
                    console.error("Invalid image format. Only PNG and JPEG are allowed.");
                    return res.send({ status: 400, message: "Invalid image format. Only PNG and JPEG are allowed." });
                }
                try {
                    let element = await cloudinary.uploader.upload(contract, {
                        resource_type: "auto",
                        folder: "contracts",
                    });
                    // console.log('Cloudinary response:', element);
                    companyLogoImg = {
                        fileId: element?.public_id,
                        fileURL: element?.secure_url,
                        fileName: companyDetails?.fileName,
                    };
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

            return res.send({ status: 200, message: 'Company get successfully.', company })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting company:", error);
        res.send({ message: "Something went wrong while getting company!" })
    }
}

exports.getAllCompany = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {

            const companies = await Company.find({ isDeleted: { $ne: true } })

            return res.send({ status: 200, message: 'Company all get successfully.', companies })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting companies:", error);
        res.send({ message: "Something went wrong while getting companies!" })
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

            let updatedCompany = await Company.findByIdAndUpdate(
                { _id: companyId },
                {
                    $set: {
                        companyDetails,
                        employeeSettings,
                        contractDetails,
                        updatedAt: new Date()
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
                    canceledAt: new Date()
                }
            })

            return res.send({ status: 200, message: 'Company deleted successfully.', deletedCompany })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing company:", error);
        res.send({ message: "Something went wrong while removing company!" })
    }
}
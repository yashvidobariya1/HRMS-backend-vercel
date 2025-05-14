const Client = require('../models/client')
const Company = require('../models/company')
const Location = require('../models/location')
const RecruitmentJob = require('../models/recruitmentJob')
const { uploadToS3, unique_Id } = require('../utils/AWS_S3')
const crypto = require('crypto')
const moment = require('moment')
const sharp = require('sharp')

exports.createJobPost = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const {
                jobPhoto,
                jobTitle,
                jobDescription,
                jobCategory,
                jobApplyTo,
                companyWebSite,
                email,
                companyId,
                clientId,
            } = req.body

            let client
            let company

            if (companyId && companyId !== 'allCompany') {
                company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            } else if (req.user.role !== 'Superadmin') {
                company = await Company.findOne({ _id: req.user.companyId.toString(), isDeleted: { $ne: true } })
            } else {
                return res.send({ status: 400, message: 'Kindly select a specific company.' })
            }

            if(clientId){
                client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if(!client){
                    return res.send({ status: 404, message: 'Client not found' })
                }
                company = await Company.findOne({ _id: client?.companyId.toString(), isDeleted: { $ne: true } })
            }
            
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            let uniqueId;
            let isUnique = false;

            const generateUniqueId = (length = 8) => {
                const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
                let uniqueId = ''
                
                for (let i = 0; i < length; i++) {
                    const randomIndex = crypto.randomInt(0, characters.length)
                    uniqueId += characters[randomIndex]
                }
            
                return uniqueId
            }

            if (!isUnique) {
                uniqueId = generateUniqueId();
                const existingJob = await RecruitmentJob.findOne({ jobPostedLink: `${process.env.FRONTEND_URL}/applyJob?key=${uniqueId}` });
                if (!existingJob) isUnique = true;
            }

            const generatedUrl = `${process.env.FRONTEND_URL}/applyJob?key=${uniqueId}`

            let jobPostImg
            if(jobPhoto){
                const document = jobPhoto
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
                    let element = await uploadToS3(compressedBase64, 'jobPostImages', fileName)
                    
                    jobPostImg = element?.fileUrl
                } catch (uploadError) {
                    console.error("Error occurred while uploading file:", uploadError);
                    return res.send({ status: 500, message: "Error occurred while uploading file. Please try again." });
                }
            }
            
            const newJobPost = {
                jobPhoto: jobPostImg,
                jobTitle,
                jobDescription,
                jobLocation: clientId !== "" ? `${ client?.addressLine2 ? `${client?.address} ${client?.addressLine2}` : `${client?.address}` }` : "",
                jobCategory,
                jobApplyTo,
                companyId: company?._id,
                clientId,
                companyWebSite,
                companyEmail: company?.contactPersonEmail,
                email,
                jobPostedLink: generatedUrl,
                jobUniqueKey: uniqueId,
                creatorId: req.user._id,
            }

            const jobPost = await RecruitmentJob.create(newJobPost)
            return res.send({ status: 200, message: 'Job post created successfully', jobPost })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while creating job post:', error)
        return res.send({ status: 500, message: 'Error occurred while creating job post!' })
    }
}

exports.getJobPost = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const jobPostId = req.params.id

            const jobPost = await RecruitmentJob.findOne({ _id: jobPostId, isDeleted: { $ne: true } })
            if(!jobPost){
                return res.send({ status: 404, message: 'Job post not found' })
            }

            return res.send({ status: 200, message: 'Job post fetched successfully', jobPost })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching job post:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching job post!' })
    }
}

exports.getJobPostForPublic = async (req, res) => {
    try {
        const jobPostKey = req.query.key

        const jobPost = await RecruitmentJob.findOne({ jobUniqueKey: jobPostKey, isDeleted: { $ne: true } })
        if(!jobPost){
            return res.send({ status: 404, message: 'Job post not found' })
        }

        let client

        if(jobPost?.clientId){
            client = await Client.findOne({ _id: jobPost?.clientId, isDeleted: { $ne: true } })
            if(!client){
                return res.send({ status: 404, message: 'Client not found' })
            }
        }

        const todaysDate = moment().format('YYYY-MM-DD')
        if(moment(todaysDate).isAfter(jobPost?.jobApplyTo)){
            return res.send({ status: 410, message: 'This application has expired and is no longer available.' })
        }

        const jobDetails = {
            jobPhoto: jobPost?.jobPhoto,
            jobTitle: jobPost?.jobTitle,
            jobDescription: jobPost?.jobDescription,
            jobLocation: `${ client ? client?.addressLine2 ? `${client?.address} ${client?.addressLine2}` : `${client?.address}` : '' }`,
            jobCategory: jobPost?.jobCategory,
            jobApplyTo: jobPost?.jobApplyTo,
            companyWebSite: jobPost?.companyWebSite,
            companyEmail: jobPost?.companyEmail,
            email: jobPost?.email,
        }

        return res.send({ status: 200, message: 'Job details fetched successfully', jobDetails })
    } catch (error) {
        console.error('Error occurred while fetching job details:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching job details!' })
    }
}

exports.getAllJobPosts = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''
            const companyId = req.query.companyId

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if(companyId && companyId !== 'allCompany'){
                baseQuery.companyId = companyId
            } else if(req.user.role !== 'Superadmin'){
                baseQuery.companyId = req.user.companyId
            }

            if (searchQuery) {
                baseQuery["jobTitle"] = { $regex: searchQuery, $options: "i" }
            }

            const jobPost = await RecruitmentJob.find(baseQuery).skip(skip).limit(limit)
            const totalJobPost = await RecruitmentJob.find(baseQuery).countDocuments()

            let filteredData = await Promise.all(
                (jobPost || []).map(async (JP) => {
                    let client
                    if(JP?.clientId){
                        client = await Client.findOne({ _id: JP.clientId, isDeleted: { $ne: true } })
                    }
        
                    return {
                        _id: JP?._id,
                        jobTitle: JP?.jobTitle,
                        jobDescription: JP?.jobDescription,
                        clientName: client?.clientName || '',
                        email: JP?.email || '',
                        jobCategory: JP?.jobCategory,
                        jobApplyTo: JP?.jobApplyTo,
                        email: JP?.email,
                        jobPostedLink: JP?.jobPostedLink,
                    }
                })
            );

            return res.send({
                status: 200,
                message: 'All job post fetched successfully',
                jobPost: filteredData,
                totalJobPost,
                totalPages: Math.ceil(totalJobPost / limit) || 1,
                currentPage: page
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching job posts:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching job posts!' })
    }
}

exports.updateJobPost = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const jobPostId = req.params.id
            const {
                jobPhoto,
                jobTitle,
                jobDescription,
                jobCategory,
                jobApplyTo,
                email,
                clientId,
                companyWebSite,
            } = req.body

            const jobPost = await RecruitmentJob.findOne({ _id: jobPostId, isDeleted: { $ne: true } })
            if(!jobPost){
                return res.send({ status: 404, message: 'Job post not found' })
            }

            let client

            if(clientId){
                client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if(!client){
                    return res.send({ status: 404, message: 'Client not found' })
                }
            }

            let jobPostImg
            if(jobPhoto){
                const document = jobPhoto
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
                        let element = await uploadToS3(compressedBase64, 'jobPostImages', fileName)
                        
                        jobPostImg = element?.fileUrl
                    } else {
                        jobPostImg = document
                    }
                } catch (uploadError) {
                    console.error("Error occurred while uploading file:", uploadError);
                    return res.send({ status: 500, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const updatedJobPost = await RecruitmentJob.findOneAndUpdate(
                { _id: jobPostId, isDeleted: { $ne: true } },
                {
                    $set: {
                        jobPhoto: jobPostImg,
                        jobTitle,
                        jobLocation: `${ client ? client?.addressLine2 ? `${client?.address} ${client?.addressLine2}` : `${client?.address}` : '' }`,
                        jobDescription,
                        jobCategory,
                        jobApplyTo,
                        email,
                        clientId,
                        companyWebSite,
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Job post details updated successfully', updatedJobPost })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating job post:', error)
        return res.send({ status: 500, message: 'Error occurred while updating job post!' })
    }
}

exports.deleteJobPost = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const jobPostId = req.params.id

            const jobPost = await RecruitmentJob.findOne({ _id: jobPostId, isDeleted: { $ne: true } })
            if(!jobPost){
                return res.send({ status: 404, message: 'Job post not found' })
            }

            const deletedJobPost = await RecruitmentJob.findOneAndUpdate(
                { _id: jobPostId, isDeleted: { $ne: true } },
                {
                    $set: {
                        isDeleted: true,
                        canceledAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Job post deleted successfully', deletedJobPost })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deleting job post:', error)
        return res.send({ status: 500, message: 'Error occurred while deleting job post!' })
    }
}

exports.getCompanyLocationsForJobPost = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.query.companyId

            let baseQuery = { isDeleted: { $ne: true } }

            if(companyId && companyId !== 'allCompany'){
                baseQuery.companyId = companyId
            } else if(req.user.role !== 'Superadmin'){
                baseQuery.companyId = req.user.companyId.toString()
            } else {
                return res.send({ status: 404, message: 'Kindly select a specific company' })
            }

            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            // if(req.user.role !== 'Superadmin'){
            //     baseQuery.companyId = req.user.companyId.toString()
            // }
            
            const locations = await Location.find(baseQuery).populate('companyId', 'companyDetails.businessName')

            const formattedLocations = locations.map(loc => ({
                _id: loc._id,
                locationName: `${loc.locationName} (${loc.companyId?.companyDetails?.businessName})`
            }))

            const clients = await Client.find(baseQuery)

            const formattedClients = clients.map(client => ({
                _id: client?._id,
                clientName: client?.clientName
            }))

            return res.send({
                status: 200,
                message: "Company's locations fetched successfully.",
                locations: formattedLocations,
                clients: formattedClients,
            });
        } else return res.send({ status: 403, message: "Access denied" });
    } catch (error) {
        console.error("Error occurred while fetching locations and clients:", error);
        return res.send({ status: 500, message: "Something went wrong while fetching locations and clients!" });
    }
}
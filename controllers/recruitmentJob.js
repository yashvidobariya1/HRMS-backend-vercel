const Company = require('../models/company')
const Location = require('../models/location')
const RecruitmentJob = require('../models/recruitmentJob')
const cloudinary = require('../utils/cloudinary')
const crypto = require('crypto')
const moment = require('moment')

exports.createJobPost = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const {
                jobPhoto,
                jobTitle,
                jobDescription,
                jobLocation,
                jobCategory,
                jobApplyTo,
                jobStatus,
                locationId,
                companyWebSite,
                companyEmail,
                companyContactNumber,
            } = req.body

            const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
            if(!location){
                return res.send({ status: 404, message: 'Location not found' })
            }

            const companyId = location?.companyId.toString()
            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
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
                const existingJob = await RecruitmentJob.findOne({ jobPostedLink: `${process.env.FRONTEND_URL}/job?key=${uniqueId}` });
                if (!existingJob) isUnique = true;
            }

            const generatedUrl = `${process.env.FRONTEND_URL}/job?key=${uniqueId}`

            let jobPostImg
            if(jobPhoto){
                const document = jobPhoto
                if (!document || typeof document !== 'string') {
                    console.log(`Invalid or missing document for item`)
                }
                try {
                    let element = await cloudinary.uploader.upload(document, {
                        resource_type: "auto",
                        folder: "jobPostImage",
                    });
                    // console.log('Cloudinary response:', element);
                    jobPostImg = element?.secure_url
                } catch (uploadError) {
                    console.error("Error occurred while uploading file:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }
            
            const newJobPost = {
                jobPhoto: jobPostImg,
                jobTitle,
                jobDescription,
                jobLocation,
                jobCategory,
                jobApplyTo,
                jobStatus,
                companyId,
                locationId,
                companyWebSite,
                companyEmail,
                companyContactNumber,
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

        const jobDetails = {
            jobPhoto: jobPost?.jobPhoto,
            jobTitle: jobPost?.jobTitle,
            jobDescription: jobPost?.jobDescription,
            jobLocation: jobPost?.jobLocation,
            jobCategory: jobPost?.jobCategory,
            jobApplyTo: jobPost?.jobApplyTo,
            jobStatus: jobPost?.jobStatus,
            companyWebSite: jobPost?.companyWebSite,
            companyEmail: jobPost?.companyEmail,
            companyContactNumber: jobPost?.companyContactNumber,
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

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if(req.user.role !== 'Superadmin'){
                baseQuery.companyId = req.user.companyId
                baseQuery.locationId = { $in: req.user.locationId }
            }

            const jobPost = await RecruitmentJob.find(baseQuery).skip(skip).limit(limit)
            const totalJobPost = await RecruitmentJob.find(baseQuery).countDocuments()

            return res.send({
                status: 200,
                message: 'All job post fetched successfully',
                jobPost,
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
                jobLocation,
                jobCategory,
                jobApplyTo,
                jobStatus,
                locationId,
                companyWebSite,
                companyEmail,
                companyContactNumber,
            } = req.body

            const jobPost = await RecruitmentJob.findOne({ _id: jobPostId, isDeleted: { $ne: true } })
            if(!jobPost){
                return res.send({ status: 404, message: 'Job post not found' })
            }

            let jobPostImg
            if(jobPhoto){
                const document = jobPhoto
                if (!document || typeof document !== 'string') {
                    console.log(`Invalid or missing document for item`)
                }
                try {
                    if(document.startsWith('data:')){
                        let element = await cloudinary.uploader.upload(document, {
                            resource_type: "auto",
                            folder: "jobPostImage",
                        });
                        // console.log('Cloudinary response:', element);
                        jobPostImg = element?.secure_url
                    } else {
                        jobPostImg = document
                    }
                } catch (uploadError) {
                    console.error("Error occurred while uploading file:", uploadError);
                    return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
                }
            }

            const updatedJobPost = await RecruitmentJob.findOneAndUpdate(
                { _id: jobPostId, isDeleted: { $ne: true } },
                {
                    $set: {
                        jobPhoto: jobPostImg,
                        jobTitle,
                        jobDescription,
                        jobLocation,
                        jobCategory,
                        jobApplyTo,
                        jobStatus,
                        locationId,
                        companyWebSite,
                        companyEmail,
                        companyContactNumber,
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
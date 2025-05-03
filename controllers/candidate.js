const Candidate = require('../models/candidate')
const RecruitmentJob = require('../models/recruitmentJob')
const { uploadToS3, unique_Id } = require('../utils/AWS_S3')
const mongoose = require('mongoose')
const moment = require('moment')

exports.applyForJob = async (req, res) => {
    try {
        const jobPostKey = req.params.key
        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            resume,
        } = req.body

        const jobPost = await RecruitmentJob.findOne({ jobUniqueKey: jobPostKey, isDeleted: { $ne: true } })
        if (!jobPost) {
            return res.send({ status: 404, message: "Job post not found" })
        }

        const existCandidate = await Candidate.findOne({ email, isDeleted: { $ne: true } })
        if(existCandidate){
            return res.send({ status: 202, message: "You've already applied for this position. We appreciate your interest!" })
        }

        const todaysDate = moment().format('YYYY-MM-DD')
        if(moment(todaysDate).isAfter(jobPost?.jobApplyTo)){
            return res.send({ status: 410, message: 'This application has expired and is no longer available.' })
        }

        let uploadedResume
        if(resume){
            const document = resume
            if (!document || typeof document !== 'string') {
                console.log(`Invalid or missing document for item`)
            }
            try {
                let fileName = unique_Id()

                let element = await uploadToS3(document, 'candidateResume', fileName)
                // console.log('AWS response:', element)
                uploadedResume = element?.fileUrl
            } catch (uploadError) {
                console.error("Error occurred while uploading file:", uploadError);
                return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
            }
        }

        const newCandidate = {
            jobPostId: jobPost?._id,
            firstName,
            lastName,
            email,
            phoneNumber,
            candidateResume: uploadedResume,
        }

        jobPost.totalApplicants += 1
        await jobPost.save()

        const candidate = await Candidate.create(newCandidate)

        return res.send({ status: 200, message: 'Your application submit successfully', candidate })
    } catch (error) {
        console.error('Error occurred while applying job:', error)
        return res.send({ status: 500, message: ' Error occurred while appliying job!' })
    }
}

exports.getCandidateDetails = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const candidateId = req.params.id

            const candidate = await Candidate.findOne({ _id: candidateId, isDeleted: { $ne: true } })
            if(!candidate){
                return res.send({ status: 404, message: 'Candidate not found' })
            }

            return res.send({ status: 200, message: 'Candidate fetched successfully', candidate })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching candidate:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching candidate!' })
    }
}

exports.getAllCandidates = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''
            const companyId = req.query.companyId

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if(req.user.role === 'Superadmin' && companyId && companyId !== 'allCompany'){
                baseQuery['jobPost.companyId'] = new mongoose.Types.ObjectId(String(companyId))
            } else if(req.user.role !== 'Superadmin'){
                baseQuery['jobPost.companyId'] = new mongoose.Types.ObjectId(String(req.user.companyId))
                baseQuery['jobPost.locationId'] = { $in: req.user.locationId.map(id => new mongoose.Types.ObjectId(String(id))) }
            }

            // if (req.user.role !== 'Superadmin') {
            //     baseQuery['jobPost.companyId'] = new mongoose.Types.ObjectId(String(req.user.companyId))
            //     baseQuery['jobPost.locationId'] = { $in: req.user.locationId.map(id => new mongoose.Types.ObjectId(String(id))) }
            // }

            if (searchQuery) {
                baseQuery['$or'] = [
                    { firstName: { $regex: searchQuery, $options: 'i' } },
                    { lastName: { $regex: searchQuery, $options: 'i' } }
                ]
            }

            const candidates = await Candidate.aggregate([
                {
                    $lookup: {
                        from: 'recruitmentjobs',
                        localField: 'jobPostId',
                        foreignField: '_id',
                        as: 'jobPost'
                    }
                },
                { $unwind: '$jobPost' },
                { $match: baseQuery },
                {
                    $project: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        phoneNumber: 1,
                        candidateResume: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        jobPostId: '$jobPost._id'
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ])

            const totalCandidates = candidates.length

            return res.send({
                status: 200,
                message: 'Candidates fetched successfully',
                candidates,
                totalCandidates,
                totalPages: Math.ceil(totalCandidates / limit) || 1,
                currentPage: page
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching candidates:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching candidates!' })
    }
}
const Candidate = require('../models/candidate')
const RecruitmentJob = require('../models/recruitmentJob')
const cloudinary = require('../utils/cloudinary')
const mongoose = require('mongoose')

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

        let uploadedResume
        if(resume){
            const document = resume
            if (!document || typeof document !== 'string') {
                console.log(`Invalid or missing document for item`)
            }
            try {
                let element = await cloudinary.uploader.upload(document, {
                    resource_type: "auto",
                    folder: "candidateResume",
                });
                // console.log('Cloudinary response:', element);
                uploadedResume = element?.secure_url
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
        res.send({ message: ' Error occurred while appliying job!' })
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
        return res.send({ message: 'Error occurred while fetching candidate!' })
    }
}

exports.getAllCandidates = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if (req.user.role !== 'Superadmin') {
                baseQuery['jobPost.companyId'] = new mongoose.Types.ObjectId(String(req.user.companyId))
                baseQuery['jobPost.locationId'] = { $in: req.user.locationId.map(id => new mongoose.Types.ObjectId(String(id))) }
            }

            if (searchQuery) {
                baseQuery['candidates.firstName'] = { $regex: searchQuery, $options: 'i' }
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

            return res.status(200).json({
                message: 'Candidates fetched successfully',
                candidates,
                totalCandidates,
                totalPages: Math.ceil((totalCandidates.length ? totalCandidates[0].total : 0) / limit) || 1,
                currentPage: page
            })
        } else return res.status(403).json({ message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching candidates:', error)
        return res.status(500).json({ message: 'Error occurred while fetching candidates!' })
    }
}
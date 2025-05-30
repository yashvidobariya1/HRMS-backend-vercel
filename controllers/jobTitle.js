const JobTitles = require('../models/jobTitle')
const moment = require('moment')

exports.createJobTitle = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const {
                name,
                // status
            } = req.body

            const sameName = await JobTitles.findOne({ name, isDeleted: { $ne: true } })
            if(sameName){
                return res.send({ status: 409, message: `${name} job title already exist. Please try a different name.` })
            }

            const newJobTitle = {
                name,
                // status
            }

            const jobTitle = await JobTitles.create(newJobTitle)

            return res.send({ status: 200, message: 'Job Title created successfully.', jobTitle })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while creating job title:', error)
        return res.send({ status: 500, message: 'Error occurred while creating job title!' })
    }
}

exports.getJobTitle = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const jobTitleId = req.params.id

            const jobTitle = await JobTitles.findOne({ _id: jobTitleId, isDeleted: { $ne: true } })
            if(!jobTitle){
                return res.send({ status: 404, message: 'Job Title not found' })
            }

            return res.send({ status: 200, message: 'Job Title fetched successfully.', jobTitle })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching job title:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching job title!' })
    }
}

exports.getAllJobTitles = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''
            const skip = (page - 1) * limit

            let matchStage = { isDeleted: { $ne: true } }

            if (searchQuery) {
                matchStage.name = { $regex: searchQuery, $options: 'i' }
            }

            const pipeline = [
                { $match: matchStage },
                {
                    $facet: {
                        data: [
                            { $skip: skip },
                            { $limit: limit }
                        ],
                        totalCount: [
                            { $count: 'count' }
                        ]
                    }
                }
            ]

            const result = await JobTitles.aggregate(pipeline)

            const jobTitles = result[0].data
            const totalJobTitles = result[0].totalCount[0]?.count || 0

            return res.send({
                status: 200,
                message: 'Job Title fetched successfully.',
                jobTitles,
                totalJobTitles,
                totalPages: Math.ceil(totalJobTitles / limit) || 1,
                currentPage: page
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching all job titles:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching all job titles!' })
    }
}

exports.updateJobTitle = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const jobTitleId = req.params.id

            const jobTitle = await JobTitles.findOne({ _id: jobTitleId, isDeleted: { $ne: true } })
            if(!jobTitle){
                return res.send({ status: 404, message: 'Job Title not found' })
            }

            const {
                name,
                // status
            } = req.body

            const duplicateName = await JobTitles.findOne({ _id: { $ne: jobTitleId }, name: name, isDeleted: { $ne: true } })
            if (duplicateName) {
                return res.send({ status: 409, message: `${name} job title already exists. Please try a different name.` })
            }

            const updatedJobTitle = await JobTitles.findOneAndUpdate(
                { _id: jobTitleId, isDeleted: { $ne: true } },
                {
                    $set: {
                        name,
                        // status
                    }
                },
                { new: true }
            )

            return res.send({ status: 200, message: 'Job Title updated successfully.', updatedJobTitle })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating job title:', error)
        return res.send({ status: 500, message: 'Error occurred while updating job title!' })
    }
}

exports.activeInactiveJobTitle = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const { jobTitleId } = req.query

            const jobTitle = await JobTitles.findOne({ _id: jobTitleId, isDeleted: { $ne: true } })
            if(!jobTitle){
                return res.send({ status: 404, message: 'Job title not found' })
            }

            if(jobTitle.isActive){
                jobTitle.isActive = false
                await jobTitle.save()
                return res.send({ status: 200, message: 'Job title deactivate successfully' })
            } else {
                jobTitle.isActive = true
                await jobTitle.save()
                return res.send({ status: 200, message: 'Job title activate successfully' })
            }
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while Active/Inactive job title:', error)
        return res.send({ status: 500, message: 'Error occurred while Active/Inactive job title!' })
    }
}

exports.deleteJobTitle = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const jobTitleId = req.params.id

            const jobTitle = await JobTitles.findOne({ _id: jobTitleId, isDeleted: { $ne: true } })
            if (!jobTitle) {
                return res.send({ status: 404, message: 'Job Title not found' })
            }

            let deleteJobTitle = await JobTitles.findByIdAndUpdate(
                { _id: jobTitleId },
                {
                    $set: {
                        isDeleted: true,
                        canceledAt: moment().toDate()
                    }
                }
            )
            
            return res.send({ status: 200, message: 'Job Title deleted successfully.', deleteJobTitle })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deleting job title:', error)
        return res.send({ status: 500, message: 'Error occurred while deleting job title!' })
    }
}
const Location = require("../models/location")
const Company = require("../models/company")
const Holiday = require("../models/holiday")
const moment = require('moment')

exports.addHoliday = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const { date, occasion } = req.body
            const locationId = req.body.locationId || req.user.locationId[0]

            if(!date || !occasion){
                return res.send({ status: 400, message: 'Date and occasion are required!' })
            }
            
            const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
            if(!location){
                return res.send({ status: 404, message: 'Location not found.' })
            }

            const companyId = location?.companyId
            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            let newHoliday
            let existHoliday
            
            if(req.user.role === 'Administrator'){
                newHoliday = {
                    date,
                    occasion,
                    companyId: req.user.companyId,
                    locationId
                }
                existHoliday = await Holiday.findOne({ companyId: newHoliday.companyId, locationId, date, isDeleted: { $ne: true } })
            } else if(req.user.role === 'Superadmin'){
                const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
                if(!company){
                    return res.send({ status: 404, message: 'Company not found.' })
                }

                newHoliday = {
                    date,
                    occasion,
                    companyId,
                    locationId
                }
                existHoliday = await Holiday.findOne({ companyId, locationId, date, isDeleted: { $ne: true } })
            }

            if(existHoliday){
                return res.send({ status: 400, message: 'Holiday already exist.' })
            }
            
            const holiday = await Holiday.create(newHoliday)
            return res.send({ status: 200, message: 'Holiday added successfully.', holiday })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while adding holiday:', error)
        res.send({ message: 'Error occurred while adding holiday!' })
    }
}

exports.getHoliday = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const holidayId = req.params.id

            const holiday = await Holiday.findOne({ _id: holidayId, isDeleted: { $ne: true } })
            if(!holiday){
                return res.send({ status: 404, message: 'Holiday not found' })
            }

            return res.send({ status: 200, message: 'Holiday fetched successfully.', holiday })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching holiday:', error)
        res.send({ message: 'Error occurred while fetching holiday!' })
    }
}

exports.getAllHolidays = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page)
            const limit = parseInt(req.query.limit)
            const year = req.query.year || moment().format('YYYY')
            // console.log('year:', year)

            const skip = (page - 1) * limit

            let holidays
            let totalHolidays

            let filter = { isDeleted: { $ne: true } }

            if (year) {
                filter.date = new RegExp(`^${year}-`, 'i')
            }

            if(req.user.role === 'Superadmin'){

                const locationId = req.query.locationId
                const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
                if(!location){
                    return res.send({ status: 404, message: 'Location not found' })
                }

                const companyId = location?.companyId
                const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
                if(!company){
                    return res.send({ status: 404, message: 'Company not found' })
                }

                filter.companyId = companyId
                filter.locationId = locationId
            } else {
                filter.companyId = req.user.companyId
                filter.locationId = { $in: req.user.locationId }
            }

            holidays = await Holiday.find(filter).sort({ date: 1 }).skip(skip).limit(limit)

            totalHolidays = await Holiday.countDocuments(filter)

            return res.send({
                status: 200,
                message: 'All holidays fetched successfully.',
                holidays: holidays ? holidays : [],
                totalHolidays,
                totalPages: Math.ceil(totalHolidays / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching holidays:', error)
        res.send({ message: 'Error occurred while fetching holidays!' })
    }
}

exports.updateHoliday = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const holidayId = req.params.id

            const existHoliday = await Holiday.findOne({ _id: holidayId, isDeleted: { $ne: true } })
            if(!existHoliday){
                return res.send({ status: 404, message: 'Holiday not found' })
            }

            let updatedHoliday
            if(req.user.role === 'Superadmin'){
                updatedHoliday = await Holiday.findOneAndUpdate(
                    { _id: holidayId, isDeleted: { $ne: true } },
                    {
                        $set: {
                            date: req.body.date,
                            occasion: req.body.occasion,
                            updatedAt: moment().toDate()
                        }
                    }, { new: true }
                )
            } else if(req.user.role === 'Administrator'){
                updatedHoliday = await Holiday.findOneAndUpdate(
                    { _id: holidayId, isDeleted: { $ne: true } },
                    {
                        $set: {
                            date: req.body.date,
                            occasion: req.body.occasion,
                            updatedAt: moment().toDate()
                        }
                    }, { new: true }
                )
            }
            return res.send({ status: 200, message: 'Holiday details updated successfully', updatedHoliday })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while updating holiday details:', error)
        res.send({ message: 'Error occurred while updating holiday details!' })
    }
}

exports.deleteHoliday = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const holidayId = req.params.id

            const existHoliday = await Holiday.findOne({ _id: holidayId, isDeleted: { $ne: true } })
            if(!existHoliday){
                return res.send({ status: 404, message: 'Holiday not found' })
            }

            const deletedHoliday = await Holiday.findOneAndUpdate(
                { _id: holidayId, isDeleted: { $ne: true } },
                {
                    $set: {
                        isDeleted: true,
                        canceledAt: moment().toDate()
                    }
                }, { new: true }
            )
            return res.send({ status: 200, message: 'Holiday deleted successfully', deletedHoliday })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while deleting holiday:', error)
        res.send({ message: 'Error occurred while deleting holiday!' })
    }
}
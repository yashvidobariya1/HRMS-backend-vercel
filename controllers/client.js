const Client = require("../models/client")
const Company = require("../models/company")
const Location = require("../models/location")


exports.addClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.query.companyId || req.user.companyId
            const { clientName, contectNumber, email, address, addressLine2, city, country, postCode } = req.body

            // const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
            // if(!location){
            //     return res.send({ status: 404, message: 'Location not found' })
            // }
            // const companyId = location?.companyId

            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            let newClient = {
                clientName,
                contectNumber,
                email,
                address,
                addressLine2,
                city,
                country,
                postCode,
                companyId,
                // locationId,
                creatorId: req.user._id,
                createdBy: req.user.role
            }

            const client = await Client.create(newClient)

            return res.send({ status: 200, message: 'Client created successfully', client })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while adding client:', error)
        res.send({ message: 'Error occurred while adding client!' })
    }
}

exports.getClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const clientId = req.params.id
            const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
            if(!client){
                return res.send({ status: 404, message: 'Client not found' })
            }
            return res.send({ status: 200, message: 'Client fetched successfully', client })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching client:', error)
        res.send({ message: 'Error occurred while fetching client!' })
    }
}

exports.getAllClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            let clients
            let totalClients = 0
            if(req.user.role == 'Superadmin'){
                clients = await Client.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalClients = await Client.find({ isDeleted: { $ne: true } }).countDocuments()
            } else if(req.user.role == 'Administrator'){
                // clients = await Client.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                // totalClients = await Client.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()
                clients = await Client.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalClients = await Client.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).countDocuments()
            }
            return res.send({
                status: 200,
                message: 'Clients fetched successfully',
                clients,
                totalClients,
                totalPages: Math.ceil(totalClients / limit),
                currentPage: page
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching clients:', error)
        res.send({ message: 'Error occurred while fetching clients!' })
    }
}

exports.updateClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const clientId = req.params.id
            const { clientName, contectNumber, email, address, addressLine2, city, country, postCode } = req.body

            const existClient = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
            if(!existClient){
                return res.send({ status: 404, message: 'Client not found' })
            }

            const updatedClient = await Client.findOneAndUpdate(
                { _id: clientId, isDeleted: { $ne: true } },
                {
                    $set: {
                        clientName,
                        contectNumber,
                        email,
                        address,
                        addressLine2,
                        city,
                        country,
                        postCode
                    }
                }, { new: true }
            )
            return res.send({ status: 200, message: 'Client details update successfully', updatedClient })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        conosle.error("Error occurred while updating client's details!", error)
        res.send({ message: "Error occurred while updating client's details!" })
    }
}

exports.deleteClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const clientId = req.params.id
            const existClient = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
            if(!existClient){
                return res.send({ status: 404, messgae:'Client not found' })
            }

            const deletedClient = await Client.findOneAndUpdate(
                { _id: clientId, isDeleted: { $ne: true } },
                {
                    $set: {
                        isDeleted: true,
                        canceledAt: new Date()
                    }
                }, { new: true }
            )
            return res.send({ status: 200, message: 'Client delete successfully', deletedClient })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        conosle.error('Error occurred while deleting client:', error)
        res.send({ message: 'Error occurred while deleting client!' })
    }
}
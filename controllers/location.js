const { default: mongoose } = require("mongoose");
const Company = require("../models/company");
const Location = require("../models/location");
const User = require("../models/user");
const Client = require("../models/client");
const contract = require("../models/contract");

exports.addLocation = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {

            const { companyId, payeReferenceNumber, locationName, address, addressLine2, city, postcode, country, ukviApproved, latitude, longitude, radius } = req.body

            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found.' })
            }
            const locations = await Location.find({ companyId: companyId })
            // console.log('locations/...', locations)
            if (Array.isArray(locations)) {
                for (const loc of locations) {
                    if (loc.locationName == locationName) {
                        return res.send({ status: 409, message: `The location name '${locationName}' already exists. Please choose a different name.` })
                    }
                }
            }

            const newLocation = {
                companyId,
                payeReferenceNumber,
                locationName,
                latitude,
                longitude,
                radius,
                address,
                addressLine2,
                city,
                postcode,
                country,
                ukviApproved,
            }

            // console.log('new Location', newLocation)
            const location = await Location.create(newLocation)

            return res.send({ status: 200, message: 'Location created successfully.', location })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while adding location:", error);
        res.send({ message: "Something went wrong while adding location!" })
    }
}

exports.getLocation = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const locationId = req.params.id
            if (!locationId || locationId == 'undefined' || locationId == 'null') {
                return res.send({ status: 404, message: 'Location not found' })
            }
            const location = await Location.findOne({
                _id: locationId,
                isDeleted: { $ne: true }
            });

            if (!location) {
                return res.send({ status: 404, message: 'Location not found' })
            }

            return res.send({ status: 200, message: 'Location get successfully.', location })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting location:", error);
        res.send({ message: "Something went wrong while getting location!" })
    }
}

exports.getAllLocation = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            const locations = await Location.find({ isDeleted: { $ne: true } }).skip(skip).limit(limit)

            const totalLocations = await Location.find({ isDeleted: { $ne: true } }).countDocuments()

            return res.send({
                status: 200,
                message: 'Location all get successfully.',
                locations: locations ? locations : [],
                totalLocations,
                totalPages: Math.ceil(totalClients / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting locations:", error);
        res.send({ message: "Something went wrong while getting locations!" })
    }
}

exports.getCompanyLocations = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.query.companyId || req.user.companyId

            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found!' })
            }

            const clients = await Client.find({ companyId, isDeleted: { $ne: true } })
            const formattedClients = clients.map(client => ({
                _id: client._id,
                name: client.clientName
            }))

            const companysContract = await contract.find({ companyId, isDeleted: { $ne: true } })
            const formattedContract = companysContract.map(contract => ({
                _id: contract._id,
                contractType: contract.contractName,
                contractDocument: contract.contractFileName
            }))

            let superadmin = {}
            if(req.user.role === 'Superadmin'){
                const existSuperadmin = await User.findOne({ _id: req.user._id, isDeleted: { $ne: true } })
                superadmin._id = existSuperadmin?._id
                superadmin.name = `${existSuperadmin?.personalDetails?.firstName} ${existSuperadmin?.personalDetails?.lastName}`
                superadmin.role = req.user.role
            }
            
            const locations = await Location.find({ companyId, isDeleted: { $ne: true } })

            const companiesAllLocations = await Promise.all(
                locations.map(async (loc) => {
                    let assignee = []

                    const allManagers = await User.find({
                        companyId,
                        locationId: { $in: [new mongoose.Types.ObjectId(loc._id)] },
                        role: 'Manager',
                        isDeleted: false,
                    }).then((managers) =>
                        managers.map((manager) => ({
                            _id: manager._id,
                            name: `${manager.personalDetails.firstName} ${manager.personalDetails.lastName}`,
                            role: manager.role
                        }))
                    )        

                    const administrators = await User.find({
                        companyId,
                        locationId: { $in: [new mongoose.Types.ObjectId(loc._id)] },
                        role: 'Administrator',
                        isDeleted: false,
                    })
                    // console.log('administrators:', administrators)
                    .then((admins) =>
                        admins.map((admin) => ({
                            _id: admin._id,
                            name: `${admin.personalDetails.firstName} ${admin.personalDetails.lastName}`,
                            role: admin.role
                        }))
                    )

                    if (req.user.role === 'Superadmin') {
                        if (allManagers.length > 0) assignee.push(...allManagers)
                        if (administrators.length > 0) assignee.push(...administrators)
                        assignee.push(superadmin)
                    } else if (req.user.role === 'Administrator') {
                        if (allManagers.length > 0) assignee.push(...allManagers)
                        if(administrators.length > 0) assignee.push(...administrators) 
                    } else if (req.user.role === 'Manager') {
                        if (allManagers.length > 0) assignee.push(...allManagers)
                    }
                    

                    return {
                        _id: loc._id,
                        locationName: `${loc?.locationName} (${company?.companyDetails?.businessName})`,
                        assignee,
                    }
                })
            )

            let filteredLocations

            if(req.user.role === 'Superadmin'){
                filteredLocations = companiesAllLocations.filter((loc) => loc !== null)
            } else if(req.user.role == 'Administrator'){
                filteredLocations = companiesAllLocations.filter((loc) => {
                    const allowedLocation = req.user?.locationId
                    if(allowedLocation.includes(loc._id)){
                        return loc
                    }
                })
            } else if(req.user.role === 'Manager'){
                filteredLocations = companiesAllLocations.filter((loc) => {
                    const allowedLocation = req.user?.locationId
                    if(allowedLocation.includes(loc._id)){
                        return loc
                    }
                })
            }

            return res.send({
                status: 200,
                message: 'Locations fetched successfully.',
                companyId,
                companiesAllLocations: filteredLocations,
                clients: formattedClients,
                contracts: formattedContract
            });
        } else return res.send({ status: 403, message: "Access denied" });
    } catch (error) {
        console.error("Error occurred while getting location:", error);
        res.send({ message: "Something went wrong while getting location!" });
    }
}

exports.updateLocationDetails = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const locationId = req.params.id

            const location = await Location.findOne({
                _id: locationId,
                isDeleted: { $ne: true }
            });

            if (!location) {
                return res.send({ status: 404, message: 'Location not found' })
            }

            let updatedLocation = await Location.findByIdAndUpdate(
                { _id: locationId },
                {
                    $set: {
                        companyId: req.body.companyId,
                        payeReferenceNumber: req.body.payeReferenceNumber,
                        locationName: req.body.locationName,
                        latitude: req.body.latitude,
                        longitude: req.body.longitude,
                        radius: req.body.radius,
                        address: req.body.address,
                        addressLine2: req.body.addressLine2,
                        city: req.body.city,
                        postcode: req.body.postcode,
                        country: req.body.country,
                        ukviApproved: req.body.ukviApproved,
                        updatedAt: new Date()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Location details updated successfully.', updatedLocation })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while updating location details:", error);
        res.send({ message: "Something went wrong while updating location details!" })
    }
}

exports.deleteLocation = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const locationId = req.params.id

            const location = await Location.findOne({
                _id: locationId,
                isDeleted: { $ne: true }
            });

            if (!location) {
                return res.send({ status: 404, message: 'Location not found' })
            }

            let deletedLocation = await Location.findByIdAndUpdate(
                { _id: locationId },
                {
                    $set: {
                        isDeleted: true,
                        canceledAt: new Date()
                    }
                })

            return res.send({ status: 200, message: 'Location deleted successfully.', deletedLocation })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing location:", error);
        res.send({ message: "Something went wrong while removing location!" })
    }
}
const Company = require("../models/company");
const Location = require("../models/location");
const User = require("../models/user");

exports.addLocation = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {

            const { companyId, payeReferenceNumber, locationName, address, addressLine2, city, postcode, country, ukviApproved } = req.body

            const company = await Company.findById(companyId)
            if(!company){
                return res.send({ status: 404, message: 'Company not found.' })
            }
            const locations = await Location.find({ companyId: companyId })
            console.log('locations/...', locations)
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

            const totalLocations = await Location.countDocuments({ isDeleted: { $ne: true } })

            if (!locations) {
                return res.send({ status: 404, message: 'Locations not found' })
            }

            return res.send({
                status: 200,
                message: 'Location all get successfully.',
                locations,
                totalLocations,
                totalPages: Math.ceil(totalLocations / limit),
                currentPage: page
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting locations:", error);
        res.send({ message: "Something went wrong while getting locations!" })
    }
}

exports.getCompanyLocations = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administartor', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.params.id
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit

            const locations = await Location.find({ companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)

            const totalCompanyLocations = await Location.countDocuments({ companyId, isDeleted: { $ne: true } })

            if (!locations || locations.length === 0) {
                return res.send({ status: 404, message: 'Location not found' })
            }

            const companiesAllLocations = await Promise.all(
                locations.map(async (loc) => {
                    const allManagers = await User.find({
                        companyId,
                        locationId: loc._id,
                        role: 'Manager',
                        isDeleted: false,
                    }).then((managers) =>
                        managers.map((manager) => ({
                            _id: manager._id,
                            managerName: `${manager.personalDetails.firstName} ${manager.personalDetails.lastName}`,
                        }))
                    )        
                    return {
                        _id: loc._id,
                        locationName: loc.locationName,
                        managers: allManagers,
                    }
                })
            )
        
            return res.send({
                status:200,
                message: 'Location getted successfully.',
                companiesAllLocations,
                totalCompanyLocations,
                totalPages: Math.ceil(totalCompanyLocations / limit),
                currentPage: page,
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting location:", error);
        res.send({ message: "Something went wrong while getting location!" })
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
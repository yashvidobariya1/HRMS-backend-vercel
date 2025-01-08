const Location = require("../models/location")

exports.addLocation = async (req, res) => {
    try {
        if (req.user.role == 'Superadmin') {
            const newLocation = {
                companyName: req.body.companyName,
                payeReferenceNumber: req.body.payeReferenceNumber,
                locationName: req.body.locationName,
                address: req.body.address,
                addressLine2: req.body.addressLine2,
                city: req.body.city,
                postcode: req.body.postcode,
                country: req.body.country,
                ukviApproved: req.body.ukviApproved,
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
        if (req.user.role == 'Superadmin') {
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
        if (req.user.role == 'Superadmin') {

            const location = await Location.find({ isDeleted: { $ne: true } })

            if (!location) {
                return res.send({ status: 404, message: 'Location not found' })
            }

            return res.send({ status: 200, message: 'Location all get successfully.', location })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while getting locations:", error);
        res.send({ message: "Something went wrong while getting locations!" })
    }
}

exports.updateLocationDetails = async (req, res) => {
    try {
        if (req.user.role == 'Superadmin') {
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
                        companyName: req.body.companyName,
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
        if (req.user.role == 'Superadmin') {
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
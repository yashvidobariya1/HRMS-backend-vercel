const Location = require("../models/location")

exports.addLocation = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
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

        return res.status(200).send({ message: 'Location created successfully.', location })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getLocation = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
        const locationId = req.params.id
        if (!locationId || locationId == 'undefined' || locationId == 'null') {
            return res.status(404).send({ message: 'Location not found' })
        }
        const location = await Location.findOne({
            _id: locationId,
            isDeleted: { $ne: true }
        });

        if (!location) {
            return res.status(404).send({ message: 'Location not found' })
        }

        return res.status(200).send({ message: 'Location get successfully.', location })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getAllLocation = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {

        const location = await Location.find({ isDeleted: { $ne: true } })

        if (!location) {
            return res.status(404).send({ message: 'Location not found' })
        }

        return res.status(200).send({ message: 'Location all get successfully.', location })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.updateLocationDetails = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
        const locationId = req.params.id

        const location = await Location.findOne({
            _id: locationId,
            isDeleted: { $ne: true }
        });

        if (!location) {
            return res.status(404).send({ message: 'Location not found' })
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

        return res.status(200).send({ message: 'Location details updated successfully.', updatedLocation })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.deleteLocation = async (req, res) => {
    try {
        // if(req.user.role == 'Superadmin') {
        const locationId = req.params.id

        const location = await Location.findOne({
            _id: locationId,
            isDeleted: { $ne: true }
        });

        if (!location) {
            return res.status(404).send({ message: 'Location not found' })
        }

        let deletedLocation = await Location.findByIdAndUpdate(
            { _id: locationId },
            {
                $set: {
                    isDeleted: true,
                    canceledAt: new Date()
                }
            })

        return res.status(200).send({ message: 'Location deleted successfully.', deletedLocation })
        // } else return res.status(401).send({ message: 'You can not authorize for this action.' })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}
const { default: mongoose } = require("mongoose");
const Company = require("../models/company");
const Location = require("../models/location");
const User = require("../models/user");
const Client = require("../models/client");
const Contract = require("../models/contract");
const Template = require("../models/template");
const moment = require("moment");

exports.addLocation = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {

            const { companyId, payeReferenceNumber, locationName, address, addressLine2, city, postcode, country, ukviApproved, latitude, longitude, radius, breakTime, graceTime } = req.body

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
                breakTime,
                graceTime,
            }

            // console.log('new Location', newLocation)
            const location = await Location.create(newLocation)

            return res.send({ status: 200, message: 'Location created successfully.', location })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while creating location:", error);
        return res.send({ status: 500, message: "Something went wrong while creating location!" })
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

            return res.send({ status: 200, message: 'Location fetched successfully.', location })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching location:", error);
        return res.send({ status: 500, message: "Something went wrong while fetching location!" })
    }
}

exports.getAllLocation = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin'];
        if (allowedRoles.includes(req.user.role)) {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''
            const companyId = req.query.companyId

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if(companyId && companyId !== 'allCompany'){ 
                baseQuery.companyId = new mongoose.Types.ObjectId(companyId);
            }

            if(searchQuery){
                baseQuery.locationName = { $regex: searchQuery, $options: 'i' }
            }

            const [result] = await Location.aggregate([
                { $match: baseQuery },
                {
                    $lookup: {
                        from: 'companies',
                        localField: 'companyId',
                        foreignField: '_id',
                        as: 'companyInfo'
                    }
                },
                { $unwind: { path: '$companyInfo', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'qrcodes',
                        let: { locationId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$locationId', '$$locationId'] },
                                    isLocationQR: true
                                }
                            },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 },
                            { $project: { _id: 0, qrURL: 1 } }
                        ],
                        as: 'latestQRCode'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        locationName: 1,
                        address: 1,
                        city: 1,
                        postcode: 1,
                        'qrValue': {
                            $concat: [
                                '$locationName',
                                '-',
                                { $ifNull: ['$companyInfo.companyDetails.businessName', ''] }
                            ]
                        },
                        companyName: '$companyInfo.companyDetails.businessName',
                        latestQRCode: {
                            $cond: {
                                if: { $gt: [{ $size: '$latestQRCode' }, 0] },
                                then: { $arrayElemAt: ['$latestQRCode.qrURL', 0] },
                                else: ''
                            }
                        }
                    }
                },
                {
                    $facet: {
                        locations: [
                            { $skip: skip },
                            { $limit: limit }
                        ],
                        total: [
                            { $count: 'count' }
                        ]
                    }
                }
            ])

            const locations = result.locations || []
            const totalLocations = result.total.length > 0 ? result.total[0].count : 0

            const formattedLocations = locations.map(loc => ({
                ...loc,
                locationName: `${loc.locationName} (${loc.companyName || ''})`
            }))

            return res.send({
                status: 200,
                message: 'Locations fetched successfully.',
                locations: formattedLocations,
                totalLocations,
                totalPages: Math.ceil(totalLocations / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while fetching locations:", error);
        return res.send({ status: 500, message: "Something went wrong while fetching locations!" })
    }
    // try {
    //     const allowedRoles = ['Superadmin'];
    //     if (allowedRoles.includes(req.user.role)) {
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50
    //         const searchQuery = req.query.search ? req.query.search.trim() : ''
    //         const companyId = req.query.companyId

    //         const skip = (page - 1) * limit

    //         let baseQuery = { isDeleted: { $ne: true } }

    //         if(companyId && companyId !== 'allCompany'){ 
    //             baseQuery.companyId = companyId
    //         }

    //         if(searchQuery){
    //             baseQuery['locationName'] = { $regex: searchQuery, $options: "i" }
    //         }

    //         const locations = await Location.find(baseQuery).populate('companyId', 'companyDetails.businessName')
    //         const totalLocations = await Location.find(baseQuery).countDocuments()

    //         const formattedLocations = locations.map(loc => {
    //             return {
    //                 ...loc.toObject(),
    //                 locationName: `${loc?.locationName} (${loc?.companyId?.companyDetails?.businessName})`
    //             }
    //         }).slice(skip, skip + limit)

    //         return res.send({
    //             status: 200,
    //             message: 'Locations fetched successfully.',
    //             locations: formattedLocations ? formattedLocations : [],
    //             totalLocations,
    //             totalPages: Math.ceil(totalLocations / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: "Access denied" })
    // } catch (error) {
    //     console.error("Error occurred while fetching locations:", error);
    //     return res.send({ status: 500, message: "Something went wrong while fetching locations!" })
    // }
}

exports.getCompanyLocations = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.query.companyId || req.user.companyId

            if(companyId == "allCompany" || companyId == 'undefined' || companyId == 'null'){
                return res.send({ status: 404, message: 'Kindly select a specific company' })
            }

            const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found!' })
            }

            const clients = await Client.find({ companyId, isDeleted: { $ne: true } })
            const formattedClients = clients.map(client => ({
                _id: client._id,
                name: client.clientName
            }))

            const companysContract = await Contract.find({ companyId, isDeleted: { $ne: true } })
            const formattedContract = companysContract.map(contract => ({
                _id: contract._id,
                contractType: contract.contractName,
                contractDocument: contract.contractFileName
            }))

            const templates = await Template.find({ isDeleted: { $ne: true } })
            const formattedTemplates = templates.map(template => ({
                _id: template._id,
                templateName: template?.templateName
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
                message: "Company's locations fetched successfully.",
                companyId,
                companiesAllLocations: filteredLocations,
                clients: formattedClients,
                contracts: formattedContract,
                templates: formattedTemplates
            });
        } else return res.send({ status: 403, message: "Access denied" });
    } catch (error) {
        console.error("Error occurred while fetching locations:", error);
        return res.send({ status: 500, message: "Something went wrong while fetching locations!" });
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
                        breakTime: req.body.breakTime,
                        graceTime: req.body.graceTime,
                        address: req.body.address,
                        addressLine2: req.body.addressLine2,
                        city: req.body.city,
                        postcode: req.body.postcode,
                        country: req.body.country,
                        ukviApproved: req.body.ukviApproved,
                        updatedAt: moment().toDate()
                    }
                }, { new: true }
            )

            return res.send({ status: 200, message: 'Location details updated successfully.', updatedLocation })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while updating location details:", error);
        return res.send({ status: 500, message: "Something went wrong while updating location details!" })
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
                        canceledAt: moment().toDate()
                    }
                })

            return res.send({ status: 200, message: 'Location deleted successfully.', deletedLocation })
        } else return res.send({ status: 403, message: "Access denied" })
    } catch (error) {
        console.error("Error occurred while removing location:", error);
        return res.send({ status: 500, message: "Something went wrong while removing location!" })
    }
}
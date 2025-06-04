const Client = require("../models/client")
const Company = require("../models/company")
const Location = require("../models/location")
const moment = require('moment')
const User = require("../models/user")
const jwt = require('jsonwebtoken')
const { default: axios } = require("axios")
const EmployeeReport = require("../models/employeeReport")
const { transporter } = require("../utils/nodeMailer");
const { default: mongoose } = require("mongoose")
const Timesheet = require("../models/timeSheet")
const { convertToEuropeanTimezone } = require("../utils/timezone")


exports.addClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.query.companyId || req.user.companyId
            const {
                clientName,
                contactNumber,
                email,
                address,
                addressLine2,
                city,
                country,
                postCode,
                latitude,
                longitude,
                radius,
                breakTime,
                graceTime,
                isAutoGenerateReport,
                reportFrequency,
                reportTime,
                weekday,
                monthDate,
            } = req.body

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
                contactNumber,
                email,
                address,
                addressLine2,
                city,
                country,
                postCode,
                companyId,
                // locationId,
                creatorId: req.user._id,
                createdBy: req.user.role,
                latitude,
                longitude,
                radius,
                breakTime,
                graceTime,
                isAutoGenerateReport,
                reportFrequency,
                reportTime,
                weekday,
                monthDate,
            }

            const client = await Client.create(newClient)

            return res.send({ status: 200, message: 'Client created successfully', client })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while adding client:', error)
        return res.send({ status: 500, message: 'Error occurred while adding client!' })
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
        return res.send({ status: 500, message: 'Error occurred while fetching client!' })
    }
}

exports.getAllClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const companyId = req.query.companyId
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit

            let baseQuery = { isDeleted: { $ne: true } }

            if (companyId && companyId !== 'allCompany') {
                // baseQuery.companyId = companyId
                baseQuery.companyId = new mongoose.Types.ObjectId(String(companyId))
            } else if (req.user.role !== 'Superadmin') {
                baseQuery.companyId = req.user.companyId
            }

            if (searchQuery) {
                baseQuery["clientName"] = { $regex: searchQuery, $options: "i" }
            }

            const [result] = await Client.aggregate([
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
                        let: { clientId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$clientId', '$$clientId'] },
                                    isClientQR: true
                                }
                            },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 },
                            {
                                $project: {
                                    _id: 0,
                                    qrURL: 1
                                }
                            }
                        ],
                        as: 'latestQRCode'
                    }
                },
                {
                    $facet: {
                        clients: [
                            { $skip: skip },
                            { $limit: limit },
                            {
                                $project: {
                                    _id: 1,
                                    'clientName': 1,
                                    'contactNumber': 1,
                                    'email': 1,
                                    'city': 1,
                                    'qrValue': {
                                        $concat: [
                                            '$clientName',
                                            '-',
                                            { $ifNull: ['$companyInfo.companyDetails.businessName', ''] }
                                        ]
                                    },
                                    'latestQRCode': {
                                        $cond: {
                                            if: { $gt: [{ $size: '$latestQRCode' }, 0] },
                                            then: { $arrayElemAt: ['$latestQRCode.qrURL', 0] },
                                            else: ''
                                        }
                                    }
                                }
                            }
                        ],
                        total: [
                            { $count: 'count' }
                        ]
                    }
                }
            ])
        
            const clients = result.clients || []
            const totalClients = result.total.length > 0 ? result.total[0].count : 0

            return res.send({
                status: 200,
                message: 'Clients fetched successfully',
                clients,
                totalClients,
                totalPages: Math.ceil(totalClients / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching clients:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching clients!' })
    }
    // try {
    //     const allowedRoles = ['Superadmin', 'Administrator']
    //     if(allowedRoles.includes(req.user.role)){
    //         const page = parseInt(req.query.page) || 1
    //         const limit = parseInt(req.query.limit) || 50
    //         const companyId = req.query.companyId
    //         const searchQuery = req.query.search

    //         const skip = (page - 1) * limit

    //         let clients
    //         let totalClients = 0
    //         if(req.user.role == 'Superadmin'){
    //             clients = await Client.find({ companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
    //             totalClients = await Client.find({ companyId, isDeleted: { $ne: true } }).countDocuments()
    //         } else if(req.user.role == 'Administrator'){
    //             // clients = await Client.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).skip(skip).limit(limit)
    //             // totalClients = await Client.find({ companyId: req.user.companyId, locationId: { $in: req.user.locationId }, isDeleted: { $ne: true } }).countDocuments()
    //             clients = await Client.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
    //             totalClients = await Client.find({ companyId: req.user.companyId, isDeleted: { $ne: true } }).countDocuments()
    //         }
    //         return res.send({
    //             status: 200,
    //             message: 'Clients fetched successfully',
    //             clients,
    //             totalClients,
    //             totalPages: Math.ceil(totalClients / limit) || 1,
    //             currentPage: page || 1
    //         })
    //     } else return res.send({ status: 403, message: 'Access denied' })
    // } catch (error) {
    //     console.error('Error occurred while fetching clients:', error)
    //     return res.send({ status: 500, message: 'Error occurred while fetching clients!' })
    // }
}

// for get all client with latest generated qrcode, this API is not working right now
// exports.getAllClient = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator', 'Manager']
//         if (!allowedRoles.includes(req.user.role)) {
//             return res.send({ status: 403, message: 'Access denied' })
//         }

//         const page = parseInt(req.query.page) || 1
//         const limit = parseInt(req.query.limit) || 50
//         const companyId = req.query.companyId
//         const searchQuery = req.query.search ? req.query.search.trim() : ''
//         const skip = (page - 1) * limit

//         let baseMatch = { isDeleted: { $ne: true } }

//         if (companyId && companyId !== 'allCompany') {
//             baseMatch.companyId = new mongoose.Types.ObjectId(companyId)
//         } else if (req.user.role !== 'Superadmin') {
//             baseMatch.companyId = req.user.companyId
//         }

//         if (searchQuery) {
//             baseMatch.clientName = { $regex: searchQuery, $options: "i" }
//         }

//         const [result] = await Client.aggregate([
//             { $match: baseMatch },
//             {
//                 $facet: {
//                     clients: [
//                         { $skip: skip },
//                         { $limit: limit },
//                         {
//                             $lookup: {
//                                 from: "QRCodes", // collection name for QR codes
//                                 let: { clientId: "$_id", companyId: "$companyId" },
//                                 pipeline: [
//                                     { $match: {
//                                         $expr: {
//                                             $and: [
//                                                 { $eq: ["$clientId", "$$clientId"] },
//                                                 { $eq: ["$companyId", "$$companyId"] },
//                                                 { $ne: ["$isActive", false] }
//                                             ]
//                                         }
//                                     }},
//                                     { $sort: { createdAt: -1 } },
//                                     { $limit: 1 }
//                                 ],
//                                 as: "latestQRCode"
//                             }
//                         },
//                         {
//                             $project: {
//                                 _id: 1,
//                                 clientName: 1,
//                                 contactNumber: 1,
//                                 email: 1,
//                                 city: 1,
//                                 latestQRCode: { $arrayElemAt: ["$latestQRCode", 0] }
//                             }
//                         }
//                     ],
//                     total: [
//                         { $match: baseMatch },
//                         { $count: 'count' }
//                     ]
//                 }
//             }
//         ])

//         const clients = result.clients || []
//         const totalClients = result.total.length > 0 ? result.total[0].count : 0

//         return res.send({
//             status: 200,
//             message: 'Clients and their latest QR code fetched successfully',
//             clients,
//             totalClients,
//             totalPages: Math.ceil(totalClients / limit) || 1,
//             currentPage: page
//         })

//     } catch (error) {
//         console.error('Error occurred while fetching clients and QR codes:', error)
//         return res.send({ status: 500, message: 'Error occurred while fetching clients and QR codes' })
//     }
// }

exports.getCompanyClients = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50

            const skip = (page - 1) * limit
            const companyId = req.query.companyId || req.user.companyId

            const clients = await Client.find({ companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
            const totalClients = await Client.find({ companyId, isDeleted: { $ne: true } }).countDocuments()

            return res.send({
                status: 200,
                message: "Company's clients fetched successfully",
                clients,
                totalClients,
                totalPages: Math.ceil(totalClients / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching clients:',error)
        return res.send({ status: 500, message: 'Error occurred while fetching clients!' })
    }
}

exports.updateClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const clientId = req.params.id
            const {
                clientName,
                contactNumber,
                email,
                address,
                addressLine2,
                city,
                country,
                postCode,
                latitude,
                longitude,
                radius,
                breakTime,
                graceTime,
                isAutoGenerateReport,
                reportFrequency,
                reportTime,
                weekday,
                monthDate,
            } = req.body

            const existClient = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
            if(!existClient){
                return res.send({ status: 404, message: 'Client not found' })
            }

            const updatedClient = await Client.findOneAndUpdate(
                { _id: clientId, isDeleted: { $ne: true } },
                {
                    $set: {
                        clientName,
                        contactNumber,
                        email,
                        address,
                        addressLine2,
                        city,
                        country,
                        postCode,
                        latitude,
                        longitude,
                        radius,
                        breakTime,
                        graceTime,
                        isAutoGenerateReport,
                        reportFrequency,
                        reportTime,
                        weekday,
                        monthDate,
                    }
                }, { new: true }
            )
            return res.send({ status: 200, message: 'Client details updated successfully', updatedClient })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        conosle.error("Error occurred while updating client's details!", error)
        return res.send({ status: 500, message: "Error occurred while updating client's details!" })
    }
}

exports.deleteClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const clientId = req.params.id
            const existClient = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
            if(!existClient){
                return res.send({ status: 404, message:'Client not found' })
            }

            const deletedClient = await Client.findOneAndUpdate(
                { _id: clientId, isDeleted: { $ne: true } },
                {
                    $set: {
                        isDeleted: true,
                        canceledAt: moment().toDate()
                    }
                }, { new: true }
            )
            return res.send({ status: 200, message: 'Client deleted successfully', deletedClient })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        conosle.error('Error occurred while deleting client:', error)
        return res.send({ status: 500, message: 'Error occurred while deleting client!' })
    }
}

exports.generateLinkForClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const clientId = req.body.clientId
            const { startDate, endDate } = req.body

            if(!startDate || !endDate){
                return res.send({ status: 400, message: 'start and end date is required!' })
            }

            const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
            if(!client){
                return res.send({ status: 404, message: 'Client not found' })
            }

            const clientEmails = client?.email
            // console.log('clientEmails:', clientEmails)

            const company = await Company.findOne({ _id: client?.companyId, isDeleted: { $ne: true } })
            if(!company){
                return res.send({ status: 404, message: 'Company not found' })
            }

            const companyId = company?._id

            const report = await EmployeeReport.findOne({
                clientId,
                companyId,
                isDeleted: { $ne: true },
                $or: [
                    { 
                        startDate: { $lte: endDate }, 
                        endDate: { $gte: startDate }
                    }
                ]
            })
            const allReports = await EmployeeReport.find({ clientId, companyId, isDeleted: { $ne: true } })
            if(report){
                return res.send({ status: 400, message: `A report link has already been generated. You should create a new report link starting from ${moment(allReports[allReports.length - 1].endDate).add(1, 'days').format('DD-MM-YYYY')}.` })
            }

            const users = await User.find({ companyId, isDeleted: { $ne: true } })

            let filteredEmployees = []
            users.map(user => {
                user?.jobDetails.map(job => {
                    if(!job?.isWorkFromOffice){
                        job?.assignClient.map(client => {
                            if(client == clientId){
                                filteredEmployees.push({
                                    userId: user?._id,
                                    jobId: job?._id,
                                    jobTitle: job?.jobTitle,
                                    jobRole: job?.role,
                                })
                            }
                        })
                    }
                })
            })

            const new_Report = {
                clientId,
                companyId,
                startDate,
                endDate,
                employees: filteredEmployees,
                // createdBy: `${req.user?.personalDetails?.lastName ? `${req.user?.personalDetails?.firstName} ${req.user?.personalDetails?.lastName}` : `${req.user?.personalDetails?.firstName}`}`,
                creatorId: req.user._id
            }

            const newReport = await EmployeeReport.create(new_Report)

            let emailLinks = [];

            for (const email of clientEmails) {
                const token = jwt.sign(
                    { clientId, companyId, startDate, endDate, reportId: newReport._id, email, role: "Client" },
                    process.env.JWT_SECRET
                );

                const link = `${process.env.FRONTEND_URL}/employeestimesheet?token=${token}`;

                emailLinks.push({ email, link, token });
            }

            // const token = jwt.sign( { clientId, companyId, startDate, endDate, reportId: newReport._id }, process.env.JWT_SECRET )

            // // const encodedToken = Buffer.from(token).toString("base64url");

            // const link = `${process.env.FRONTEND_URL}/employeestimesheet?token=${token}`

            const generatedReport = await EmployeeReport.findOne({ _id: newReport._id, isDeleted: { $ne: true } })

            generatedReport.links = emailLinks

            for (const { email, link } of emailLinks) {
                let mailOptions = {
                    from: process.env.NODEMAILER_EMAIL,
                    to: email,
                    subject: 'Employee Timesheet Report',
                    html:`
                        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                                <div style="background-color: #007bff; color: #ffffff; padding: 20px 30px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px;">Employee Timesheet Report</h1>
                                </div>
                                <div style="padding: 30px;">
                                    <p style="font-size: 16px; color: #333333;">
                                        Hello,
                                    </p>
                                    <p style="font-size: 16px; color: #333333;">
                                        Please click the link below to view the employee timesheet report for the period from 
                                        <strong>${moment(startDate).format('DD-MM-YYYY')}</strong> to 
                                        <strong>${moment(endDate).format('DD-MM-YYYY')}</strong>.
                                    </p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${link}" style="display: inline-block; padding: 12px 25px; font-size: 16px; color: #ffffff; background-color: #28a745; text-decoration: none; border-radius: 5px;">
                                            View Report List
                                        </a>
                                    </div>
                                    <p style="font-size: 14px; color: #777777;">
                                        <strong>Note:</strong> Please ensure that you review and take the necessary action on each report.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                }
                transporter.sendMail(mailOptions, (error, info) => {
                    if(error){
                        if(error.code == 'EENVELOPE'){
                            console.warn('Invalid email address, while sending report link:', email)
                        } else {
                            console.error('Error while sending report link:', error)
                        }
                    }
                    if(info){
                        console.log(`✅ Report link to: ${email}`)
                    }
                })
            }

            await generatedReport.save()

            // const tinyUrlResponse = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`)
            // const shortUrl = tinyUrlResponse.data
            
            return res.send({ status: 200, message: 'Link generated successfully', generatedReport })

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occured while generating link:', error)
        return res.send({ status: 500, message: 'Error occurred while generating link!' })
    }
}

exports.getGeneratedReports = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 50
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit
            const { clientId, companyId } = req.query

            if (!clientId || clientId == 'undefined' || clientId == 'null') {
                return res.send({ status: 400, message: 'Client ID is required' })
            }

            const isAllClients = clientId === 'allClients'
            const isAllCompanies = companyId === 'allCompany'

            let query = { isDeleted: { $ne: true } }

            if (!isAllClients && !isAllCompanies) {
                const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if (!client) return res.send({ status: 404, message: 'Client not found' })

                const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
                if (!company) return res.send({ status: 404, message: 'Company not found' })

                if (client.companyId.toString() !== company._id.toString()) {
                    return res.send({ status: 200, reports: [] })
                }

                query.clientId = client?._id
            } else if (isAllClients && !isAllCompanies) {
                const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
                if (!company) return res.send({ status: 404, message: 'Company not found' })

                const clientIds = await Client.find({ companyId, isDeleted: { $ne: true } }).distinct('_id')
                query.clientId = { $in: clientIds }

            }  else if (!isAllClients && isAllCompanies) {
                const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
                if (!client) return res.send({ status: 404, message: 'Client not found' })

                query.clientId = client?._id
            }

            if (searchQuery) {
                const isDate = !isNaN(Date.parse(searchQuery))
                
                if (isDate) {
                    const startOfDay = moment(searchQuery).format('YYYY-MM-DD')
                    const endOfDay = moment(searchQuery).format('YYYY-MM-DD')

                    query['$or'] = [
                        { startDate: { $gte: startOfDay, $lte: endOfDay } },
                        { endDate: { $gte: startOfDay, $lte: endOfDay } }
                    ]
                } else {
                    query['clientData.clientName'] = { $regex: searchQuery, $options: 'i' }
                }
            }

            const reports = await EmployeeReport.aggregate([
                { $match: {
                    isDeleted: false
                }},
                { $lookup: {
                    from: 'clients', // collection name
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'clientData'
                }},
                { $unwind: '$clientData' },
                { $match: query },
                { $lookup: {
                    from: 'users',
                    localField: 'creatorId',
                    foreignField: '_id',
                    as: 'creatorData'
                }},
                { $unwind: {
                    path: '$creatorData',
                    preserveNullAndEmptyArrays: true
                }},
                { $project: {
                    _id: 1,
                    clientId: '$clientData',
                    creatorId: '$creatorData',
                    startDate: 1,
                    endDate: 1,
                    companyId: 1,
                    employees: 1,
                    links: 1,
                    actionBy: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    reportFrequency: 1,
                    status: 1,
                }},
                { $skip: skip },
                { $limit: limit }
            ])
            // console.log('reports:', reports)
            const totalReports = await EmployeeReport.find(query).countDocuments()


            let filteredReports = []
            reports.map(report => {
                // const hasStatusPending = report?.employees.some(emp => emp.status == 'Pending')
                filteredReports.push({
                    clientName: report?.clientId?.clientName,
                    startDate: report?.startDate,
                    endDate: report?.endDate,
                    createdBy: `${report?.creatorId?.personalDetails?.lastName ? `${report?.creatorId?.personalDetails?.firstName} ${report?.creatorId?.personalDetails?.lastName}` : `${report?.creatorId?.personalDetails?.firstName}`}`,
                    _id: report._id,
                    createdAt: report?.createdAt,
                    actionBy: report?.actionBy || "",
                    status: report?.status,
                    // status: hasStatusPending ? 'Pending' : 'Reviewed',
                })
            })

            // const startDate = moment(filteredReports[filteredReports.length - 1]?.endDate).add(1, 'days').format('YYYY-MM-DD') || moment('2025-01-01').format('YYYY-MM-DD')
            const startDate = filteredReports.length > 0 ? moment(filteredReports[filteredReports.length - 1]?.endDate).add(1, 'days').format('YYYY-MM-DD') : moment('2025-01-01').format('YYYY-MM-DD')

            return res.send({
                status: 200,
                message: 'Reports fetched successfully',
                reports: filteredReports,
                startDate,
                endDate : moment().subtract(1, 'days').format('YYYY-MM-DD'),
                totalReports,
                totalPages: Math.ceil(totalReports / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching reports:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching reports!' })
    }
}

// old method
// exports.getReport = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator']
//         if (allowedRoles.includes(req.user?.role) || req.token?.role === "Client") {
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 10

//             const skip = (page - 1) * limit
//             const reportId = req.params.id || req.token.reportId
//             const companyId = req.query.companyId

//             const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } }).populate('employees.userId', 'personalDetails.firstName personalDetails.lastName')

//             if (!report) {
//                 return res.send({ status: 404, message: 'Report not found' })
//             }

//             if(allowedRoles.includes(req.user?.role)){
//                 const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
//                 if(!company){
//                     return res.send({ status: 404, message: 'Company not found' })
//                 }

//                 if(companyId !== report?.companyId.toString()){
//                     return res.send({ status: 200, report: [] })
//                 }
//             }

//             const formattedEmployees = report.employees.map(emp => ({
//                 userName: `${emp.userId?.personalDetails?.firstName} ${emp.userId?.personalDetails?.lastName}`,
//                 userId: emp.userId?._id,
//                 _id: emp.jobId,
//                 jobTitle: emp.jobTitle,
//                 jobRole: emp.jobRole,
//                 reason: emp.rejectionReason || "",
//                 status: emp.status
//             })).slice(skip, skip + limit)

//             const totalEmployees = report.employees.length

//             return res.send({
//                 status: 200,
//                 message: 'Report fetched successfully',
//                 report: {
//                     ...report.toObject(),
//                     employees: formattedEmployees
//                 },
//                 totalEmployees,
//                 totalPages: Math.ceil(totalEmployees / limit) || 1,
//                 currentPage: page || 1
//             })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while fetching report:', error)
//         return res.send({ status: 500, message: 'Error occurred while fetching report!' })
//     }
// }

// new method
function getStartAndEndDate({ joiningDate, startDate, endDate }) {
    let start, end

    if (startDate && endDate) {
        start = moment(startDate).startOf('day')
        end = moment(endDate).endOf('day')
    } else {
        const now = moment()
        start = now.startOf('month')
        end = now.endOf('month')
    }

    if (joiningDate && start.isBefore(joiningDate)) {
        start = moment(joiningDate).startOf('day')
    }

    return {
        fromDate: start.format('YYYY-MM-DD'),
        toDate: end.format('YYYY-MM-DD')
    }
}

const timeStringToSeconds = (timeStr) => {
    const match = timeStr.match(/(\d+)h\s*(\d+)m\s*(\d+)s/)
    if (!match) return 0
    const [, h, m, s] = match.map(Number)
    return h * 3600 + m * 60 + s
}

const secondsToTimeString = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}h ${minutes}m ${seconds}s`
}

// exports.getReport = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator']
//         if(allowedRoles.includes(req.user?.role) || req.token?.role === 'Client'){            
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 10

//             const skip = (page - 1) * limit
//             const reportId = req.params.id || req.token.reportId
//             const companyId = req.query.companyId

//             const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } }).lean()

//             if(!report){
//                 return res.send({ status: 404, message: 'Report not found' })
//             }

//             if(allowedRoles.includes(req.user?.role) && companyId !== 'allCompany'){
//                 const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
//                 if(!company){
//                     return res.send({ status: 404, message: 'Company not found' })
//                 }

//                 if(companyId !== report?.companyId.toString()){
//                     return res.send({ status: 200, report: [] })
//                 }
//             }

//             const companyIdFromReport = report.companyId.toString()
//             const clientIdFromReport = report.clientId.toString()

//             const employees = await User.aggregate([
//                 { $match: { 
//                     companyId: new mongoose.Types.ObjectId(companyIdFromReport),
//                     isDeleted: { $ne: true } 
//                 }},
//                 { $unwind: '$jobDetails' },
//                 { $match: {
//                     'jobDetails.isWorkFromOffice': false,
//                     'jobDetails.assignClient': { $in: [clientIdFromReport] }
//                 }},
//                 { $project: {
//                     userId: '$_id',
//                     userName: { $concat: [ '$personalDetails.firstName', ' ', '$personalDetails.lastName' ] },
//                     joiningDate: '$jobDetails.joiningDate',
//                     jobId: '$jobDetails._id',
//                     jobTitle: '$jobDetails.jobTitle',
//                     jobRole: '$jobDetails.role'
//                 }}
//             ])

//             const employeeTimesheet = []
//             const today = moment().format('YYYY-MM-DD')

//             for(const emp of employees){
//                 const { fromDate, toDate } = getStartAndEndDate({
//                     joiningDate: emp.joiningDate,
//                     startDate: report.startDate,
//                     endDate: report.endDate
//                 })

//                 const timesheets = await Timesheet.find({ userId : emp.userId,
//                     jobId: emp.jobId,
//                     clientId: clientIdFromReport,
//                     date: { $gte: fromDate, $lte: toDate } 
//                 }).lean()

//                 const byDate = new Map()
//                 timesheets.forEach(ts => {
//                     const dateKey = moment(ts.date).format('YYYY-MM-DD')
//                     if (!byDate.has(dateKey)) byDate.set(dateKey, [])
//                     ts.clockinTime.forEach(slot => byDate.get(dateKey).push(slot))
//                 })

//                 for (let d = moment(fromDate); d.isSameOrBefore(toDate); d.add(1, 'days')) {
//                     const dateStr = d.format('YYYY-MM-DD')
//                     const dayOfWeek = d.day()
//                     const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
//                     const isFuture = d.isAfter(today, 'day')
//                     if (isWeekend || isFuture) continue

//                     const rows = byDate.get(dateStr)

//                     if(rows?.length){
//                         rows.forEach(slot => {
//                             employeeTimesheet.push({
//                                 userName: emp.userName,
//                                 jobTitle: emp.jobTitle,
//                                 jobRole: emp.jobRole,
//                                 date: dateStr,
//                                 clockIn: convertToEuropeanTimezone(slot.clockIn).format("YYYY-MM-DD HH:mm:ss"),
//                                 clockOut: convertToEuropeanTimezone(slot.clockOut).format("YYYY-MM-DD HH:mm:ss"),
//                                 totalTiming: slot.totalTiming,
//                                 overTime: slot.overTime ?? '0h 0m 0s',
//                                 totalHours: slot.totalTiming
//                             })
//                         })
//                     }
//                 }
//                 byDate.clear()
//             }

//             const reports = employeeTimesheet.slice(skip, skip + limit)
//             const totalReports = employeeTimesheet.length

//             const reportData = {
//                 startDate: report?.startDate,
//                 endDate: report?.endDate,
//                 status: report?.status,
//                 employeeTimesheetData: reports
//             }

//             return res.send({
//                 status: 200,
//                 message: 'Timesheet report fetched successfully',
//                 reports: reportData,
//                 totalReports,
//                 totalPages: Math.ceil(totalReports / limit),
//                 currentPage: page
//             })
//         } else return res.send({ status: 403, message: 'Access denied' })

//     } catch (error) {
//             console.error('Error while fetching timesheet report:', error)
//             return res.send({ status: 500, message: 'Error occurred while fetching report!' })
//     }
// }

// API for client which is return paticular one employee and in that object one array of object in thi array employee timesheet

exports.getReport = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user?.role) || req.token?.role === 'Client'){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10
            const searchQuery = req.query.search ? req.query.search.trim() : ''

            const skip = (page - 1) * limit
            const reportId = req.query.reportId || req.token.reportId
            const companyId = req.query.companyId

            const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } }).lean()
            if(!report){
                return res.send({ status: 404, message: 'Report not found' })
            }

            if(allowedRoles.includes(req.user?.role) && companyId !== 'allCompany'){
                const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
                if(!company){
                    return res.send({ status: 404, message: 'Company not found' })
                }

                if(companyId !== report?.companyId.toString()){
                    return res.send({ status: 200, report: [] })
                }
            }

            const companyIdFromReport = report?.companyId?.toString()
            const clientIdFromReport = report?.clientId?.toString()

            let query = {
                companyId: new mongoose.Types.ObjectId(String(companyIdFromReport)),
                isDeleted: { $ne: true },
            }

            if(searchQuery){
                query.$or = [
                    { "personalDetails.firstName": { $regex: searchQuery, $options: "i" } },
                    { "personalDetails.lastName": { $regex: searchQuery, $options: "i" } }
                ]
            }

            const employees = await User.aggregate([
                { $match: query },
                { $unwind: "$jobDetails" },
                { $match: {
                    "jobDetails.isWorkFromOffice": false,
                    "jobDetails.assignClient": { $in: [clientIdFromReport] }
                }},
                {
                    $project: {
                        userId: "$_id",
                        userName: {
                        $concat: [
                                "$personalDetails.firstName",
                                " ",
                                "$personalDetails.lastName"
                            ]
                        },
                        joiningDate: "$jobDetails.joiningDate",
                        jobId: "$jobDetails._id",
                        jobTitle: "$jobDetails.jobTitle",
                        jobRole: "$jobDetails.role"
                    }
                }
            ])

            let employeeTimesheet = []

            for(const emp of employees){

                const { fromDate, toDate } = getStartAndEndDate({ joiningDate: emp?.joiningDate, startDate: report?.startDate, endDate: report?.endDate })

                const timesheets = await Timesheet.find({ userId: emp?.userId, jobId: emp?.jobId, clientId: clientIdFromReport, date: { $gte: fromDate, $lte: toDate }, isDeleted: { $ne: true } }).lean()

                const dateList = [];
                for (let d = moment(fromDate); d.isSameOrBefore(toDate); d.add(1, 'days')) {
                    dateList.push(d.clone().format('YYYY-MM-DD'))
                }

                const timesheetMap = new Map()
                timesheets.map(TS => {
                    const dateKey = TS.date
                    timesheetMap.set(dateKey, TS)
                })

                const today = moment().format('YYYY-MM-DD')

                const allReports = dateList.map(dateObj => {
                    const isFuture = moment(dateObj, 'YYYY-MM-DD').isAfter(today, 'day')
                    const dayOfWeek = moment(dateObj, 'YYYY-MM-DD').day()
                    const isWeekend = dayOfWeek === 6 || dayOfWeek === 0
    
                    if (isWeekend || isFuture) return null
                
                    const timesheetEntries = timesheets.filter(TS => TS.date === dateObj)
                
                    const hasTimesheet = timesheetEntries.length > 0
                    if (!hasTimesheet) return null;
                    // const isAbsent = !hasTimesheet  && !isFuture

                    const convertedTime = Array.isArray(timesheetEntries[0].clockinTime)
                        ? timesheetEntries[0].clockinTime.map(entry => ({
                            ...entry,
                            clockIn: convertToEuropeanTimezone(entry.clockIn).format("YYYY-MM-DD HH:mm:ss"),
                            clockOut: convertToEuropeanTimezone(entry.clockOut).format("YYYY-MM-DD HH:mm:ss"),
                        })) : [];

                    const timesheetData = hasTimesheet ? {
                        // date: timesheetEntries[0]?.date,
                        clockinTime: convertedTime,
                        workingHours: secondsToTimeString(timeStringToSeconds(timesheetEntries[0]?.totalHours) - timeStringToSeconds(timesheetEntries[0]?.overTime)),
                        overTime: timesheetEntries[0]?.overTime,
                        totalHours: timesheetEntries[0]?.totalHours,
                    } : undefined;
                    // console.log('timesheetData:', timesheetData)
                
                    return {
                        date: dateObj,
                        timesheet: hasTimesheet,
                        // absent: isAbsent,
                        timesheetData: timesheetData ? timesheetData : {}
                    }
                }).filter(report => report !== null)

                let totalHoursSeconds = 0
                let overTimeSeconds = 0

                for (const day of allReports) {
                    if (day?.timesheet && day?.timesheetData && typeof day?.timesheetData === 'object') {
                        totalHoursSeconds += timeStringToSeconds(day.timesheetData.totalHours || "0h 0m 0s")
                        overTimeSeconds += timeStringToSeconds(day.timesheetData.overTime || "0h 0m 0s")
                    }
                }

                const totalWorkingHours = secondsToTimeString(totalHoursSeconds - overTimeSeconds)
                const totalHours = secondsToTimeString(totalHoursSeconds)
                const overTime = secondsToTimeString(overTimeSeconds)
                // const overTime = secondsToTimeString(overTimeSeconds)
                if(allReports.length > 0){
                    employeeTimesheet.push({
                        userName: emp?.userName,
                        jobTitle: emp?.jobTitle,
                        jobRole: emp?.jobRole,
                        totalWorkingHours,
                        totalHours,
                        overTime,
                        timesheetData: allReports
                    })
                }
            }

            let empTotalHoursInSecound = 0

            for(const TS of employeeTimesheet){
                if(TS?.totalHours){
                    empTotalHoursInSecound += timeStringToSeconds(TS?.totalHours || "0h 0m 0s")
                }
            }

            const empTotalHours = secondsToTimeString(empTotalHoursInSecound)

            const reports = employeeTimesheet.slice(skip, skip + limit)
            const totalReports = employeeTimesheet.length

            const reportData = {
                rejectionReason: report?.rejectionReason || "",
                actionBy: report?.actionBy,
                totalHoursOfEmployees: empTotalHours,
                startDate: report?.startDate,
                endDate: report?.endDate,
                status: report?.status,
                employeeTimesheetData: reports
            }

            return res.send({
                status: 200,
                message: 'Timesheet report fetched successfully',
                reports: reportData,
                totalReports,
                totalPages: Math.ceil(totalReports / limit),
                currentPage: page
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching timesheet report:', error)
        return res.send({ status: 500, message: 'Error occurred while fetching report!' })
    }
}

exports.getClientUsers = async (req, res) => {
    // try {
    //     const page = parseInt(req.query.page) || 1
    //     const limit = parseInt(req.query.limit) || 50

    //     const skip = (page - 1) * limit

    //     const token = req.query.token
    //     const decoded = jwt.verify(token, process.env.JWT_SECRET)

    //     const { reportId, clientId, companyId, startDate, endDate, email } = decoded

    //     const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
    //     if(!client){
    //         return res.send({ status: 404, message: 'Client not found' })
    //     }
        
    //     const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
    //     if(!company){
    //         return res.send({ status: 404, message: 'Company not found' })
    //     }

    //     const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } })
    //     if(!report){
    //         return res.send({ status: 404, message: 'Report not found' })
    //     }

    //     function removeDuplicates(data) {
    //         return data.filter((item, index, self) =>
    //             index === self.findIndex(t => 
    //                 t.userId === item.userId && t.job?.jobTitle === item.job?.jobTitle
    //             )
    //         );
    //     }

    //     async function getEmployees(report, clientId, companyId, startDate, endDate, reportId) {
    //         let allEmployees = await Promise.all(
    //             (report?.employees || []).map(async (employee) => {
    //                 const emp = await User.findOne({ _id: employee.userId, isDeleted: { $ne: true } });
    //                 if (!emp) return null;
        
    //                 return emp?.jobDetails
    //                     .filter(job => job?.assignClient?.toString() === clientId)
    //                     .map(job => ({
    //                         job,
    //                         userId: emp._id.toString(), // Ensure string comparison
    //                         companyId,
    //                         name: `${emp?.personalDetails?.firstName} ${emp?.personalDetails?.lastName}`,
    //                         email: emp?.personalDetails?.email,
    //                         startDate,
    //                         endDate,
    //                         reportId
    //                     }));
    //             })
    //         );
        
    //         // Flatten, remove null, and remove duplicates
    //         allEmployees = removeDuplicates(allEmployees.flat().filter(Boolean));
        
    //         return allEmployees;
    //     }

    //     const filteredUsers = await getEmployees(report, clientId, companyId, startDate, endDate, reportId)

    //     filteredUsers.slice(skip, skip + limit)
    //     const totalUsers = filteredUsers.length

    //     return res.send({
    //         status: 200,
    //         message: "Client's users fetched successfully",
    //         users: filteredUsers,
    //         totalUsers,
    //         totalPages: Math.ceil(totalUsers / limit) || 1,
    //         currentPage: page || 1
    //     })

    // } catch (error) {
    //     console.error("Error occurred while fetching clinet's users:", error)
    //     return res.send({ status: 500, message: "Error occurred while fetching clinet's users!" })
    // }
}

exports.approveReport = async (req, res) => {
    try {
        if(req.token?.role === 'Client'){
            // const {
            //     reportId,
            //     // userId,
            //     // jobId
            // } = req.body

            // console.log('req.token:', req.token)
            const reportId = req.token?.reportId
            const clientEmail = req.token?.email

            const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } })
            if(!report){
                return res.send({ status: 404, message: 'Report not found' })
            }

            if(report?.status !== 'Pending'){
                return res.send({ status: 400, message: "You've already taken this action, you can't perform it again." })
            }

            const updatedReport = await EmployeeReport.findOneAndUpdate(
                { _id: reportId, isDeleted: { $ne: true } },
                {
                    $set: {
                        status: 'Approved',
                        actionBy: clientEmail,
                    }
                },
                { new: true }
            )

            // report?.employees.map(user => {
            //     // if(user?.userId?.toString() == userId && user?.jobId?.toString() == jobId){
            //     if(user?.jobId?.toString() == jobId){
            //         user.status = "Approved"
            //     }
            // })

            // await report.save()

            // let employeeData
            // report?.employees.map((emp) => {
            //     if(emp?.jobId?.toString() == jobId){
            //         employeeData = emp
            //     }
            // })

            return res.send({ status: 200, message: 'Employee report approved successfully', updatedReport })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.log('Error occurred while processing approval')
        return res.send({ status: 500, message: 'Error occurred while processing approval!' })
    }
}

exports.rejectReport = async (req, res) => {
    try {
        if(req.token?.role === 'Client'){        
            const {
                // reportId,
                // userId,
                // jobId,
                reason
            } = req.body

            const reportId = req.token?.reportId
            const clientEmail = req.token?.email

            const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } })
            if(!report){
                return res.send({ status: 404, message: 'Report not found' })
            }

            if(report?.status !== 'Pending'){
                return res.send({ status: 400, message: "You've already taken this action, you can't perform it again." })
            }

            // if(!reason){
            //     return res.send({ status: 400, message: 'Rejection reason is required!' })
            // }

            const updatedReport = await EmployeeReport.findOneAndUpdate(
                { _id: reportId, isDeleted: { $ne: true } },
                {
                    $set: {
                        status: 'Rejected',
                        rejectionReason: reason,
                        actionBy: clientEmail,
                    }
                },
                { new: true }
            )

            // report?.employees.map(user => {
            //     // if(user?.userId?.toString() == userId && user?.jobId?.toString() == jobId){
            //     if(user?.jobId?.toString() == jobId){
            //         user.status = "Rejected"
            //         user.rejectionReason = reason
            //     }
            // })

            // await report.save()

            // let employeeData
            // report?.employees.map((emp) => {
            //     if(emp?.jobId?.toString() == jobId){
            //         employeeData = emp
            //     }
            // })

            return res.send({ status: 200, message: 'Employee report rejected successfully', updatedReport })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.log('Error occurred while processing rejection')
        return res.send({ status: 500, message: 'Error occurred while processing rejection!' })
    }
}
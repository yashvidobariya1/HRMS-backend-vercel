const Client = require("../models/client")
const Company = require("../models/company")
const Location = require("../models/location")
const moment = require('moment')
const User = require("../models/user")
const jwt = require('jsonwebtoken')
const { default: axios } = require("axios")
const EmployeeReport = require("../models/employeeReport")
const { transporter } = require("../utils/nodeMailer");


exports.addClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const companyId = req.query.companyId || req.user.companyId
            const { clientName, contactNumber, email, address, addressLine2, city, country, postCode } = req.body

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
            const companyId = req.query.companyId

            const skip = (page - 1) * limit

            let clients
            let totalClients = 0
            if(req.user.role == 'Superadmin'){
                clients = await Client.find({ companyId, isDeleted: { $ne: true } }).skip(skip).limit(limit)
                totalClients = await Client.find({ companyId, isDeleted: { $ne: true } }).countDocuments()
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
                totalPages: Math.ceil(totalClients / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching clients:', error)
        res.send({ message: 'Error occurred while fetching clients!' })
    }
}

exports.getCompanyClients = async (req, res) => {
    try {
        const allowedRoles = ['Administrator']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit
            const companyId = req.user.companyId

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
        res.send({ message: 'Error occurred while fetching clients!' })
    }
}

exports.updateClient = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const clientId = req.params.id
            const { clientName, contactNumber, email, address, addressLine2, city, country, postCode } = req.body

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
                        postCode
                    }
                }, { new: true }
            )
            return res.send({ status: 200, message: 'Client details updated successfully', updatedClient })
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
        res.send({ message: 'Error occurred while deleting client!' })
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
            console.log('clientEmails:', clientEmails)

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
                    if(job?.assignClient?.toString() == clientId){
                        filteredEmployees.push({
                            userId: user?._id,
                            jobId: job?._id,
                            jobTitle: job?.jobTitle,
                            jobRole: job?.role,
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
                createdBy: `${req.user?.personalDetails?.lastName ? `${req.user?.personalDetails?.firstName} ${req.user?.personalDetails?.lastName}` : `${req.user?.personalDetails?.firstName}`}`,
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
                        <h1>Employee Timesheet Report</h1>
                        <p>Click <a href="${link}">here</a> to view employee report from ${moment(startDate).format('DD-MM-YYYY')} to ${moment(endDate).format('DD-MM-YYYY')}</p>
                    `
                }
                transporter.sendMail(mailOptions)
            }

            await generatedReport.save()

            // const tinyUrlResponse = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`)
            // const shortUrl = tinyUrlResponse.data
            
            return res.send({ status: 200, message: 'Link generated successfully', generatedReport })

        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occured while generating link:', error)
        res.send({ message: 'Error occurred while generating link!' })
    }
}

exports.getGeneratedReports = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if(allowedRoles.includes(req.user.role)){
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit
            const { clientId } = req.query

            if (!clientId || clientId == 'undefined' || clientId == 'null') {
                return res.send({ status: 400, message: 'Client ID is required' })
            }

            const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
            if(!client){
                return res.send({ status: 404, message: 'Client not found' })
            }

            const reports = await EmployeeReport.find({ clientId, isDeleted: { $ne: true } }).populate('creatorId', 'personalDetails.firstName personalDetails.lastName').skip(skip).limit(limit)
            const totalReports = await EmployeeReport.find({ clientId, isDeleted: { $ne: true } }).countDocuments()

            let filteredReports = []
            reports.map(report => {
                const hasStatusPending = report?.employees.some(emp => emp.status == 'Pending')
                filteredReports.push({
                    startDate: report?.startDate,
                    endDate: report?.endDate,
                    createdBy: `${report?.creatorId?.personalDetails?.lastName ? `${report?.creatorId?.personalDetails?.firstName} ${report?.creatorId?.personalDetails?.lastName}` : `${report?.creatorId?.personalDetails?.firstName}`}`,
                    _id: report._id,
                    createdAt: report?.createdAt,
                    status: hasStatusPending ? 'Pending' : 'Reviewed'
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
        res.send({ message: 'Error occurred while fetching reports!' })
    }
}

exports.getReport = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator']
        if (allowedRoles.includes(req.user?.role) || req.token?.role === "Client") {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10

            const skip = (page - 1) * limit
            const reportId = req.params.id || req.token.reportId

            const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } }).populate('employees.userId', 'personalDetails.firstName personalDetails.lastName')

            if (!report) {
                return res.send({ status: 404, message: 'Report not found' })
            }

            const formattedEmployees = report.employees.map(emp => ({
                userName: `${emp.userId?.personalDetails?.firstName} ${emp.userId?.personalDetails?.lastName}`,
                userId: emp.userId?._id,
                _id: emp.jobId,
                jobTitle: emp.jobTitle,
                jobRole: emp.jobRole,
                status: emp.status
            })).slice(skip, skip + limit)

            const totalEmployees = formattedEmployees.length

            return res.send({
                status: 200,
                message: 'Report fetched successfully',
                report: {
                    ...report.toObject(),
                    employees: formattedEmployees
                },
                totalEmployees,
                totalPages: Math.ceil(totalEmployees / limit) || 1,
                currentPage: page || 1
            })
        } else return res.send({ status: 403, message: 'Access denied' })
    } catch (error) {
        console.error('Error occurred while fetching report:', error)
        res.send({ message: 'Error occurred while fetching report!' })
    }
}

exports.getClientUsers = async (req, res) => {
    // try {
    //     const page = parseInt(req.query.page) || 1
    //     const limit = parseInt(req.query.limit) || 10

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
    //     res.send({ message: "Error occurred while fetching clinet's users!" })
    // }
}

exports.approveReport = async (req, res) => {
    try {
        const {
            reportId,
            // userId,
            jobId
        } = req.body

        const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } })
        if(!report){
            return res.send({ status: 404, message: 'Report not found' })
        }

        report?.employees.map(user => {
            // if(user?.userId?.toString() == userId && user?.jobId?.toString() == jobId){
            if(user?.jobId?.toString() == jobId){
                user.status = "Approved"
            }
        })

        await report.save()

        let employeeData
        report?.employees.map((emp) => {
            if(emp?.jobId?.toString() == jobId){
                employeeData = emp
            }
        })

        return res.send({ status: 200, message: 'Employee report approved successfully', report: employeeData })
    } catch (error) {
        console.log('Error occurred while processing approval')
        res.send({ message: 'Error occurred while processing approval!' })
    }
}

exports.rejectReport = async (req, res) => {
    try {
        const {
            reportId,
            // userId,
            jobId,
            reason
        } = req.body

        const report = await EmployeeReport.findOne({ _id: reportId, isDeleted: { $ne: true } })
        if(!report){
            return res.send({ status: 404, message: 'Report not found' })
        }

        if(!reason){
            return res.send({ status: 400, message: 'Rejection reason is required!' })
        }

        report?.employees.map(user => {
            // if(user?.userId?.toString() == userId && user?.jobId?.toString() == jobId){
            if(user?.jobId?.toString() == jobId){
                user.status = "Rejected"
                user.rejectionReason = reason
            }
        })

        await report.save()

        let employeeData
        report?.employees.map((emp) => {
            if(emp?.jobId?.toString() == jobId){
                employeeData = emp
            }
        })

        return res.send({ status: 200, message: 'Employee report rejected successfully', report: employeeData })
    } catch (error) {
        console.log('Error occurred while processing rejection')
        res.send({ message: 'Error occurred while processing rejection!' })
    }
}
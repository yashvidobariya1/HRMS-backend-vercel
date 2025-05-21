const jwt = require('jsonwebtoken')
const moment = require('moment')
const User = require('../models/user')
const Company = require('../models/company')
const EmployeeReport = require('../models/employeeReport')
const { transporter } = require('../utils/nodeMailer')
const { default: mongoose } = require('mongoose')

exports.generateLinkForClient = async (options) => {
    try {
        const { clientId, companyId, startDate, endDate, clientEmails, reportFrequency } = options

        const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
        if (!company) {
            return { status: 404, message: 'Company not found' };
        }

        let overlapQuery = {}

        if(startDate && endDate && endDate !== ""){
            overlapQuery.startDate = { $lte: endDate },
            overlapQuery.endDate = { $gte: startDate }
        } else if(startDate){
            overlapQuery.startDate = startDate
        }

        const overlap = await EmployeeReport.findOne({
            clientId,
            companyId,
            reportFrequency,
            isDeleted: { $ne: true },
            ...overlapQuery,
        })
        // console.log('overLap:', overlap)

        if (overlap) {
            const allReports = await EmployeeReport.find({
                clientId,
                companyId,
                reportFrequency,
                isDeleted: { $ne: true }
            })
            const last = allReports[allReports.length - 1]
            const nextStart = moment(last.endDate).add(1, 'days').format('DD-MM-YYYY')
            return { status: 400, message: `Report already exists. Create new from ${nextStart}` }
        }

        // const users = await User.aggregate([
        //     { $match: { companyId: new mongoose.Types.ObjectId(String(companyId)), isDeleted: { $ne: true } } },
        //     { $unwind: "$jobDetails" },
        //     { $match: {
        //         "jobDetails.isWorkFromOffice": false,
        //         "jobDetails.assignClient": { $in: [clientId] }
        //     }},
        //     {
        //         $project: {
        //             userId: "$_id",
        //             jobId: "$jobDetails._id",
        //             jobTitle: "$jobDetails.jobTitle",
        //             jobRole: "$jobDetails.role"
        //         }
        //     }
        // ])

        const newReport = await EmployeeReport.create({
            clientId,
            companyId,
            reportFrequency,
            startDate,
            endDate,
            // employees: users,
            // creatorId: creator || null
        })

        // console.log('newReqport:', newReport)

        let emailLinks = []

        for (const email of clientEmails) {
            const token = jwt.sign(
                { clientId, companyId, startDate, endDate, reportId: newReport._id, email, role: "Client" },
                process.env.JWT_SECRET
            )

            const link = `${process.env.FRONTEND_URL}/employeestimesheet?token=${token}`

            emailLinks.push({ email, link, token })
        }
        // console.log('emailLinks:', emailLinks)

        const generatedReport = await EmployeeReport.findOne({ _id: newReport._id, isDeleted: { $ne: true } })
        
        generatedReport.links = emailLinks
        // console.log('generatedReport:', generatedReport)

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
                                    <strong>Note:</strong> Please ensure that you review and take the necessary action on report.
                                </p>
                            </div>
                        </div>
                    </div>
                `
            }
            transporter.sendMail(mailOptions)
        }

        await generatedReport.save()
    } catch (error) {
        console.error('Error occurred while generating report link:', error)
    }
}
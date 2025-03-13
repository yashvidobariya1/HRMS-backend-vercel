const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/user')
const Company = require('../models/company');
const Client = require('../models/client');
const EmployeeReport = require('../models/employeeReport');

jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ messageId: '123' }),
    }),
}))

let mongoServer;
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

let employee;

beforeEach(async () => {
    employee = await User.find()
});

describe('get specific report====================================================', () => {
    describe('Superadmin and Administrator can generated report', () => {
        let token
        let clientId
        let companyId
        let report
        test('Should return 401 for Unauthorization: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingforgeneratereport@gmail.com'
                },
                password: 'Superadmin@Administrator',
                role: 'Superadmin'
            })
            const company = await Company.create({
                companyDetails: {
                    businessName: 'testing Company for generate link'
                }
            })
            companyId = company._id
            const client = await Client.create({
                clientName: 'testing client',
                email: ['client1@example.com', 'client2@example.com', 'client3@example.com'],
                companyId
            })
            clientId = client._id
            const login = await request(app).post('/login').send({ email: 'testingforgeneratereport@gmail.com', password: 'Superadmin@Administrator' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = JSON.parse(login.text).user.token
            const generateReport = await request(app).post('/generateLink').set('Authorization', `Bearer ${token}`).send({ clientId, startDate: "2025-02-13", endDate: "2025-03-12" })
            report = JSON.parse(generateReport.text).generatedReport
            const res = await request(app).get(`/getReport/${report._id}`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 for report not found', async () => {
            await EmployeeReport.findOneAndUpdate({ _id: report._id }, { isDeleted: true })
            const res = await request(app).get(`/getReport/${report._id}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Report not found')
        })
        test('Should return 200 for report get successfully', async () => {
            await EmployeeReport.findOneAndUpdate({ _id: report._id }, { isDeleted: false })
            const res = await request(app).get(`/getReport/${report._id}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Report fetched successfully')
        })
        test('Should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ token }, { role: 'superadmin' })
            const res = await request(app).get(`/getReport/${report._id}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })
    describe('Client get report', () => {
        let token
        let clientId
        let companyId
        let report
        let clientToken
        test('Should return 401 for Unauthorization: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingforgetreport@gmail.com'
                },
                password: 'Superadmin@Administrator',
                role: 'Superadmin'
            })
            const company = await Company.create({
                companyDetails: {
                    businessName: 'testing Company for generate link'
                }
            })
            companyId = company._id
            const client = await Client.create({
                clientName: 'testing client',
                email: ['client1@example.com', 'client2@example.com', 'client3@example.com'],
                companyId
            })
            clientId = client._id
            const login = await request(app).post('/login').send({ email: 'testingforgetreport@gmail.com', password: 'Superadmin@Administrator' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = JSON.parse(login.text).user.token
            const generateReport = await request(app).post('/generateLink').set('Authorization', `Bearer ${token}`).send({ clientId, startDate: "2025-02-13", endDate: "2025-03-12" })
            report = JSON.parse(generateReport.text).generatedReport
            const res = await request(app).get(`/getReport/${report._id}`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 for report not found', async () => {
            clientToken = report.links[0].token
            await EmployeeReport.findOneAndUpdate({ _id: report._id }, { isDeleted: true })
            const res = await request(app).get('/getReportForClient').set('Authorization', `Bearer ${clientToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Report not found')
        })
        test('Should return 200 for report get successfully', async () => {
            await EmployeeReport.findOneAndUpdate({ _id: report._id }, { isDeleted: false })
            const res = await request(app).get('/getReportForClient').set('Authorization', `Bearer ${clientToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Report fetched successfully')
        })
    })
})

describe('Superadmin and administrator can get all generate reports', () => {
    let token
    let clientId
    let companyId
    let report
    test('Should return 401 for Unauthorization: Invalid API key', async () => {
        await User.create({
            personalDetails: {
                email: 'testingforgetgeneratedreports@gmail.com'
            },
            password: 'Superadmin@Administrator',
            role: 'Superadmin'
        })
        const company = await Company.create({
            companyDetails: {
                businessName: 'testing Company for fetch reports'
            }
        })
        companyId = company._id
        const client = await Client.create({
            clientName: 'testing client',
            email: ['client1@example.com', 'client2@example.com', 'client3@example.com'],
            companyId
        })
        clientId = client._id
        const login = await request(app).post('/login').send({ email: 'testingforgetgeneratedreports@gmail.com', password: 'Superadmin@Administrator' })
        expect(JSON.parse(login.text).status).toBe(200)
        token = JSON.parse(login.text).user.token
        const generateReport = await request(app).post('/generateLink').set('Authorization', `Bearer ${token}`).send({ clientId, startDate: "2025-02-13", endDate: "2025-03-12" })
        report = JSON.parse(generateReport.text).generatedReport
        const res = await request(app).get('/getAllReports')
        expect(JSON.parse(res.text).status).toBe(401)
        expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
    })
    test('Should return 200 for report get successfully', async () => {
        const res = await request(app).get('/getAllReports').set('Authorization', `Bearer ${token}`)
        expect(JSON.parse(res.text).status).toBe(200)
    })
    test('Should return 403 for Access denied', async () => {
        await User.findOneAndUpdate({ token }, { role: 'superadmin' })
        const res = await request(app).get('/getAllReports').set('Authorization', `Bearer ${token}`)
        expect(JSON.parse(res.text).status).toBe(403)
        expect(JSON.parse(res.text).message).toBe('Access denied')
    })
})

describe('Client approve and reject employee report', () => {
    describe('approve report', () => {
        let token
        let clientId
        let companyId
        let report
        let clientToken
        let reportId
        let userId
        let jobId
        test('Should return 404 for report not found', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingforapprovereport@gmail.com'
                },
                password: 'Superadmin@Administrator',
                role: 'Superadmin'
            })
            const company = await Company.create({
                companyDetails: {
                    businessName: 'testing Company for generate link'
                }
            })
            companyId = company._id
            const client = await Client.create({
                clientName: 'testing client',
                email: ['client1@example.com', 'client2@example.com', 'client3@example.com'],
                companyId
            })
            clientId = client._id
            const login = await request(app).post('/login').send({ email: 'testingforapprovereport@gmail.com', password: 'Superadmin@Administrator' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = JSON.parse(login.text).user.token
            const generateReport = await request(app).post('/generateLink').set('Authorization', `Bearer ${token}`).send({ clientId, startDate: "2025-02-13", endDate: "2025-03-12" })
            report = JSON.parse(generateReport.text).generatedReport
            clientToken = report.links[0].token
            const res = await request(app).post('/appreveReport').set('Authorization', `Bearer ${clientToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Report not found')
        })
        test('Should return 200 for approve report successfully', async () => {
            reportId = report._id
            userId = report.employees[0]?.userId
            jobId = report.employees[0]?.jobId
            const res = await request(app).post('/appreveReport').set('Authorization', `Bearer ${clientToken}`).send({ reportId, userId, jobId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Report approved successfully')
        })
    })

    describe('reject report', () => {
        let token
        let clientId
        let companyId
        let report
        let clientToken
        let reportId
        let userId
        let jobId
        test('Should return 404 for report not found', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingforapprovereport@gmail.com'
                },
                password: 'Superadmin@Administrator',
                role: 'Superadmin'
            })
            const company = await Company.create({
                companyDetails: {
                    businessName: 'testing Company for generate link'
                }
            })
            companyId = company._id
            const client = await Client.create({
                clientName: 'testing client',
                email: ['client1@example.com', 'client2@example.com', 'client3@example.com'],
                companyId
            })
            clientId = client._id
            const login = await request(app).post('/login').send({ email: 'testingforapprovereport@gmail.com', password: 'Superadmin@Administrator' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = JSON.parse(login.text).user.token
            const generateReport = await request(app).post('/generateLink').set('Authorization', `Bearer ${token}`).send({ clientId, startDate: "2025-02-13", endDate: "2025-03-12" })
            report = JSON.parse(generateReport.text).generatedReport
            clientToken = report.links[0].token
            const res = await request(app).post('/rejectReport').set('Authorization', `Bearer ${clientToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Report not found')
        })
        test('Should return 200 for approve report successfully', async () => {
            reportId = report._id
            userId = report.employees[0]?.userId
            jobId = report.employees[0]?.jobId
            const res = await request(app).post('/appreveReport').set('Authorization', `Bearer ${clientToken}`).send({ reportId, userId, jobId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Report approved successfully')
        })
    })
})
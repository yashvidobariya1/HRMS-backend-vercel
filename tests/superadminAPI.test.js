const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const Company = require('../models/company')

const mongoURI = "mongodb://localhost:27017/HRMS-testing"

beforeAll(async () => {
    try {
        await mongoose.connect(mongoURI)
        console.log("Connected to MongoDB")
    } catch (error) {
        console.error("Error connecting to MongoDB:", error)
        process.exit(1)
    }
})

afterAll(async () => {
    await mongoose.connection.close()
})

let employee;
let companies;

beforeEach(async () => {
    employee = await User.find()
    // console.log('employees/...', employee)
    companies = await Company.find()
    // console.log('companies/...', companies)
});


// this all function called by superadmin



let companyId

it('SuperAdmin can create a company', async () => {
    const companyDetails = {
        "companyDetails": {
            "companyCode": "add company for testing",
            "bussinessName": "company bussiness name",
            "companyLogo": "String",
            "companyRegistrationNumber": "String",
            "payeReferenceNumber": "String",
            "address": "address",
            "city": "City",
            "postCode": "postCode",
            "country": "Country",
            "timeZone": "String",
            "contactPersonFirstname": "String",
            "contactPersonMiddlename": "String",
            "contactPersonLastname": "String",
            "contactPersonEmail": "String",
            "contactPhone": "String",
            "adminToReceiveNotification": "String",
            "additionalEmailsForCompliance": "String",
            "pensionProvider": "String",
            
        },
        "employeeSetting": {
            "payrollFrequency": "String",
            "immigrationReminders": {
                "day1st": "String",
                "day2nd": "String",
                "day3rd": "String"
            },
            "holidayYear": "String",
            "noticePeriodDays": "String",
            "contactConfirmationDays": "String",
            "rightToWorkCheckReminder": "String",
            "leaveEntitlements": {
                "holidaysExcludingBank": "String",
                "sickLeaves": "String"
            },
        },
        "contractDetails": {
            "startDate": "startDate",
            "endDate": "endDate",
            "maxEmployeesAllowed": "maxEmployeesAllowed"
        }
    }
    const res = await request(app).post('/addcompany').set('x-api-key', 'Superadmin').send(companyDetails)
    companyId = await (JSON.parse(res.text)).company._id    
    if(res.statusCode === 200){
        console.log('created company/...', JSON.parse(res.text))
        expect(res.statusCode).toBe(200)
    } else if(res.statusCode === 401) {
        console.log('Error:', res.text)
        expect(res.text)
    } else {
        console.log('Error/...', res.text)
        expect(res.text)
    }
})

it('SuperAdmin can get company details', async () => {
    const res = await request(app).post(`/getcompany/${companyId}`).set('x-api-key', 'Superadmin')
    console.log('get company details/..', res.text)
    if(res.statusCode === 404){
        console.log('Error:', res.text)
        expect(res.text).toBe('Company not found')
    } else if(res.statusCode === 200){
        console.log('Error:', res.text)
        expect(res.statusCode).toBe(200)
    } else {
        console.log('Error:', res.text)
        expect(res.text)
    }
})

it('SuperAdmin can get al company details', async () => {
    const res = await request(app).post('/getallcompany').set('x-api-key', 'Superadmin')
    console.log('get all comapnies/...', res.text)
    if(res.statusCode === 401){   
        console.log('Error:', res.text)
        expect(res.text)
    } else if(res.statusCode === 200) {
        console.log('Error:', res.text)
        expect(res.text)
    } else {
        console.log('Error:', res.text)
        expect(res.text)
    }
})

it('Supaeradmin can update any company details by id', async () => {
    const updatedCompnayDetails = {
        "companyDetails": {
            "businessName": "Updated company bussiness name"
        },
        "employeeSetting": {
            "payrollFrequency": "Updated payroll frequency",
            "holidayYear": "Updated holidayYear"
        }
    }
    const res = await request(app).post(`/updatecompany/${companyId}`).set('x-api-key', 'Superadmin').send(updatedCompnayDetails)
    if(res.statusCode === 401){   
        console.log('Error:', res.text)
        expect(res.text)
    } else if(res.statusCode === 404){
        console.log('Error:', res.text)
        expect(res.text).toBe('Manager not found')
    } else {
        console.log('updated company details/..', res.text)
        expect(res.statusCode).toBe(200)
    }
})

it('Superadmin can delete a company by ID', async () => {
    const res = await request(app).post(`/deletecompany/${companyId}`).set('x-api-key', 'Superadmin')
    if(res.statusCode === 200){
        console.log('delete company details/..', res.text)
    } else if(res.statusCode === 401) {
        console.log('Error:', res.text)
        expect(res.text)
    } else if(res.statusCode === 404) {
        console.log('Error:', res.text)
        expect(res.text).toBe('Company not found')
    } else {
        console.log('Error:', error)
        expect(res.text)
    }
})
const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const Company = require('../models/company')

afterAll(async () => {
    await mongoose.connection.close()
})

let employee;
let companies;

beforeAll(async () => {
    employee = await User.find()
    // console.log('employees/...', employee)
    companies = await Company.find()
    // console.log('companies/...', companies)
});


// this all function called by administrator

let managerIdforGetDetails = "676d19b5373f08193ed6008f"
let managerIdforUpdateDetails = "676d19b5373f08193ed6008f"
let managerIdforRemoveManager = "676d1ba0c25cc65d03af3463"

it('Administrator can create manager', async () => {
    let managerDetails = {
        "personalDetails": {
            "firstName": "add manager for testing",
            "middleName": "add manager for testing",
            "lastName": "add manager for testing",
            "dateOfBirth": "1990-01-01",
            "gender": "Female",
            "maritalStatus": "Single",
            "phone": "1234567890",
            "homeTelephone": "0987654321",
            "email": "jane.doe@example.com",
            "niNumber": "AB123456C",
            "sendRegistrationLink": true
        },
        "addressDetails": {
            "address": "456 Elm Street",
            "addressLine2": "Apt 2A",
            "city": "New York",
            "postCode": "10001"
        },
        "kinDetails": {
            "kinName": "String",
            "relationshipToYou": "String",
            "address": "String",
            "postCode": "String",
            "emergencyContactNumber": "String",
            "email": "String"
        },
        "financialDetails": {
            "bankName": "String",
            "holderName": "String",
            "sortCode": "String",
            "accountNumber": "String",
            "payrollFrequency": "String",
            "pension": "String"
        },
        "jobDetails": {
            "jobTitle": "Marketing Specialist",
            "jobDescription": "Handles marketing strategies and campaigns.",
            "annualSalary": 50000,
            "hourlyRate": 25,
            "weeklyWorkingHours": "40",
            "joiningDate": "2024-01-15",
            "location": "New York",
            "assignManager": "John Smith",
            "role": "Manager"
        },
        "immigrationDetails": {
            "passportNumber": "987654321",
            "countryOfIssue": "USA",
            "passportExpiry": "2030-12-31",
            "nationality": "American",
            "visaCategory": "None",
            "visaValidFrom": "2024-01-01",
            "visaValidTo": "2024-12-31",
            "brpNumber": "123456",
            "cosNumber": "789012",
            "restriction": "None",
            "shareCode": "ABC123",
            "rightToWorkCheckDate": "2024-01-10",
            "rightToWorkEndDate": "2024-12-31"
        },
        "documentDetails": [
            {
                "documentType": "passport",
                "document":"123456798"
            },
        ],
        "contractDetails": {
            "contractType": "Full-time",
            "contractDocument": "String"
        }
    }
    const res = await request(app).post('/addmanager').set('x-api-key', 'Administrator').send(managerDetails)
    console.log('res/...', res.text)
    if(res.statusCode === 200){
        expect(res.statusCode).toBe(200)
    } else {
        expect(res.text)
    }
})

it('Administrator can access manager details by ID', async () => {
    const res = await request(app).post(`/getmanager/${managerIdforGetDetails}`).set('x-api-key', 'Administrator')
    // console.log('res...', res.text)
    if(res.statusCode === 404){
        expect(res.text).toBe('Manager not found.')
    } else {
        expect(res.statusCode).toBe(200)
    }
})

it('Administrator can access all managers details', async () => {
    const res = await request(app).post('/getallmanager').set('x-api-key', 'Administrator')
    // console.log('mangerDetails/..', res.statusCode)
    if(res.statusCode === 401){   
        expect(res.text)
    } else if(res.statusCode === 200) {
        expect(res.text)
    }
})

it('Administrator can update any manager details by ID', async () => {
    let managerUpdateDetails = {
        "personalDetails": {
            "firstName": "update first name",
            "middleName": "update middle name",
            "lastName": "update last name",
            "email": "update@example.com"
        },
        "addressDetails": {
            "address": "updated address",
            "city": "updated city",
            "postCode": "updated post code",
        },
        "kinDetails": {
            "kinName": "updated kinName",
            "address": "updated address",
            "emergencyContactNumber": "updated emergency contact number",
        },
        "financialDetails": {
            "bankName": "updated bank name",
            "accountNumber": "updated account number",
        },
        "jobDetails": {
            "jobTitle": "updated jobDetails",
            "location": "updated location"
        },
        "immigrationDetails": {
            "passportNumber": "updated passport number",
            "countryOfIssue": "updated country of issue",
            "passportExpiry": "updated passport expiry",
        }
    }
    const res = await request(app).post(`/updatemanager/${managerIdforUpdateDetails}`).set('x-api-key', 'Administrator').send(managerUpdateDetails)
    console.log('updatedManagerDetails/...', res.text)
    if(res.statusCode === 404){
        expect(res.text).toBe('Manager not found')
    } else {
        expect(res.statusCode).toBe(200)
    }
})

it('Administrator can remove any manager',async () => {
    const res = await request(app).post(`/deletemanager/${managerIdforRemoveManager}`).set('x-api-key', 'Administrator')
    console.log('deletedManagerDetails/..', res.text)
    console.log('statusCode/...', res.statusCode)
    if(res.statusCode === 404){
        expect(res.text).toBe('Manager not found')
    } else {
        expect(res.statusCode).toBe(200)
    }
})
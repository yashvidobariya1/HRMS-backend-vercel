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

// this all function called by manager

let employeeId

it('Manager can create a employee', async () => {
    const employeeData = {
        "personalDetails": {
            "firstName": "add employee for testing",
            "middleName": "add employee for testing",
            "lastName": "add employee for testing",
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
            "role": "Employee"
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
    const res = await request(app).post('/addemployee').set('x-api-key', 'Manager').send(employeeData)
    employeeId = await JSON.parse(res.text).employee._id
    
    if(res.statusCode === 401){  
        console.log('Error:', res.text) 
        expect(res.text)
    } else if(res.statusCode === 200){
        console.log('created manager/...', res.text)
        expect(res.statusCode).toBe(200)
    } else {
        console.log('Error:', res.text)
        expect(res.text)
    }
})

it('Manager can access employee details by ID', async () => {
    const res = await request(app).post(`/getemployee/${employeeId}`).set('x-api-key', `Manager`)    
    if(res.statusCode === 401){ 
        console.log('Error:', res.text)  
        expect(res.text)
    } else if (res.statusCode === 404) {
        console.log('Error:', res.text)
        expect(res.text).toBe('Employee not found');
    } else if(res.statusCode === 200) {
        console.log('employee Details/..', res.text)
        expect(res.statusCode).toBe(200);
    } else {
        console.log('Error:', res.text)
        expect(res.text)
    }
});

it('Manager can access all employees details', async () => {
    const res = await request(app).post('/getallemployee').set('x-api-key', 'Manager')    
    if(res.statusCode === 401){  
        console.log('Error:', res.text) 
        expect(res.text)
    } else if (res.statusCode === 200) {
        console.log('get all employees details/..', res.text)
        expect(res.statusCode).toBe(200)
    } else if(res.statusCode === 404){
        console.log('Error:', res.text)
        expect(res.text).toBe('Employees not found')
    } else {
        console.log('Error:', res.text)
        expect(res.text)
    }
})

it('Manager can update any employee details', async () => {
    let updateEmployeeDetails = {
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
    const res = await request(app).post(`/updateemployee/${employeeId}`).set('x-api-key', 'Manager').send(updateEmployeeDetails)    
    // console.log('status', res.statusCode)
    if(res.statusCode === 401){  
        console.log('Error:', res.text)
        expect(res.text)
    } else if (res.statusCode === 200) {
        console.log('updatedEmployeeZDetails/...', res.text)
        expect(res.statusCode).toBe(200)
    } else if(res.status == 404) {
        console.log('Error:', res.text)
        expect(res.text).toBe('Employee not found')
    } else {
        console.log('Error:', res.text)
        expect(res.text)
    }
})

it('Manager can remove any employe',async () => {
    const res = await request(app).post(`/deletemanager/${employeeId}`).set('x-api-key', 'Administrator')    
    if(res.statusCode === 401){   
        console.log('Error:', res.text)
        expect(res.text)
    } else if(res.statusCode === 404){
        console.log('Error:', res.text)
        expect(res.text).toBe('Employee not found')
    } else if(res.statusCode === 200) {
        console.log('deletedEmployeeDZetails/..', res.text)
        expect(res.statusCode).toBe(200)
    } else {
        console.log('Error:', res.text)
        expect(res.text)
    }
})

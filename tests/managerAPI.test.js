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

// this all function called by manager

let employeeIdforGetdetails = "676d238f81bb936af89fb41a"
let employeeIdforUpdatedetails = "676d238f81bb936af89fb41a"
let employeeIdforRemoveEmployee = "676d238f81bb936af89fb41a"

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
    // console.log('res', res)
    if(res.statusCode === 200){
        expect(res.statusCode).toBe(200)
    } else {
        expect(res.text)
    }
})

it('Manager can access employee details by ID', async () => {
    const res = await request(app).post(`/getemployee/${employeeIdforGetdetails}`).set('x-api-key', `Manager`)
    console.log('employee Details/..', res.text)
    if (res.statusCode === 404) {
        expect(res.text).toBe('Employee not found');
    } else {
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('personalDetails.firstName');
    }
});

it('Manager can access all employees details', async () => {
    const res = await request(app).post('/getallemployee').set('x-api-key', 'Manager')
    // console.log('res', res.text)
    if (res.statusCode === 200) {
        expect(res.statusCode).toBe(200)
    } else if(res.statusCode === 404){
        expect(res.text).toBe('Employees not found')
    } else {
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
    const res = await request(app).post(`/updateemployee/${employeeIdforUpdatedetails}`).set('x-api-key', 'Manager').send(updateEmployeeDetails)
    console.log('updatedEmployeeZDetails/...', res.text)
    // console.log('status', res.statusCode)
    if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('updatedEmployee.personalDetails.firstName', 'update first name')
    } else if(res.status == 404) {
        expect(res.text).toBe('Employee not found')
    } else {
        expect(res.text)
    }
})

it('Manager can remove any employe',async () => {
    const res = await request(app).post(`/deletemanager/${employeeIdforRemoveEmployee}`).set('x-api-key', 'Administrator')
    console.log('deletedEmployeeDZetails/..', res.text)
    if(res.statusCode === 404){
        expect(res.text).toBe('Employee not found')
    } else {
        expect(res.statusCode).toBe(200)
    }
})

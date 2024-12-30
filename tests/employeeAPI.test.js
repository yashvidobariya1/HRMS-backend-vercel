const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')

const { MongoMemoryServer } = require('mongodb-memory-server');

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

// all api called company by Superadmin, Administrator and Manager
describe('Superadmin, Administrator and Manager Routes - Crud Employee Test', () => {
    let createdEmployeeId;
    test('POST /addemployee should add a employee', async () => {
        const createResponse = await request(app).post('/addemployee').set('x-api-key', 'Manager' || 'Administrator' || 'Superadmin').send({
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
                    "document": "123456798"
                },
            ],
            "contractDetails": {
                "contractType": "Full-time",
                "contractDocument": "String"
            }
        })
        console.log('created employee/...', JSON.parse(createResponse.text))
        expect(createResponse.status).toBe(200);
        expect(createResponse.body.message).toBe('Employee created successfully.');
        expect(createResponse.body.employee).toHaveProperty('_id');
        createdEmployeeId = await (JSON.parse(createResponse.text)).employee._id
    })

    test('POST /getemployee/:id should fetch a employee by ID', async () => {
        const getResponse = await request(app).post(`/getemployee/${createdEmployeeId}`).set('x-api-key', 'Manager' || 'Administrator' || 'Superadmin')
        console.log('get employee details/..', getResponse.text)
        expect(getResponse.status).toBe(200);
        expect(getResponse.body.message).toBe('Employee get successfully.');
        expect(getResponse.body.employee.personalDetails.firstName).toBe('add employee for testing');
    });

    test('POST /getallemployee should fetch all employees', async () => {
        const getAllResponse = await request(app).post('/getallemployee').set('x-api-key', 'Manager' || 'Administrator' || 'Superadmin')
        console.log('get all employees/...', getAllResponse.text)
        expect(getAllResponse.status).toBe(200);
        expect(getAllResponse.body.message).toBe('Employee all get successfully.');
        expect(getAllResponse.body.employees).toBeInstanceOf(Array);
    })

    test('POST /updateemployee/:id should update employee details', async () => {
        const updateResponse = await request(app).post(`/updateemployee/${createdEmployeeId}`).set('x-api-key', 'Manager' ||  'Administrator' || 'Superadmin').send({
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
        })
        console.log('Updated employee details:', updateResponse.text);
        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.message).toBe('Employee details updated successfully.');
        expect(updateResponse.body.updatedEmployee.personalDetails.email).toBe('update@example.com');
    })

    test('POST /deleteemployee/:id should delete a employee', async () => {
        const deleteResponse = await request(app).post(`/deleteemployee/${createdEmployeeId}`).set('x-api-key', 'Manager' || 'Administrator' || 'Superadmin')
        console.log('delete employee details/..', deleteResponse.text)
        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.message).toBe('Employee deleted successfully.');
        const deletedEmployee = await User.findById(createdEmployeeId);
        expect(deletedEmployee.isDeleted).toBe(true);
    })
});
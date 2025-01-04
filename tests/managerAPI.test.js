const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')

const { MongoMemoryServer } = require('mongodb-memory-server');

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


// all api called manager by Superadmin and Administrator
describe('Superadmin and Administrator Routes - Crud Manager Test', () => {
    let createdManagerId;
    test('POST /addmanager should add a manager', async () => {
        const createResponse = await request(app).post('/addmanager').set('x-api-key', 'Administrator' || 'Superadmin').send({
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
                    "document": "123456798"
                },
            ],
            "contractDetails": {
                "contractType": "Full-time",
                "contractDocument": "String"
            }
        })
        console.log('created manager/...', JSON.parse(createResponse.text))
        expect(createResponse.body.status).toBe(200);
        expect(createResponse.body.message).toBe('Manager created successfully.');
        expect(createResponse.body.manager).toHaveProperty('_id');
        createdManagerId = await (JSON.parse(createResponse.text)).manager._id

    })

    test('POST /getmanager/:id should fetch a manager by ID', async () => {
        const getResponse = await request(app).post(`/getmanager/${createdManagerId}`).set('x-api-key', 'Administrator' || 'Superadmin')
        console.log('get manager details/..', getResponse.text)
        expect(getResponse.body.status).toBe(200);
        expect(getResponse.body.message).toBe('Manager get successfully.');
        expect(getResponse.body.manager.personalDetails.firstName).toBe('add manager for testing');
    })
    test('POST /getmanager/:id when fetching manager details and manager not found', async() => {
        const getResponse = await request(app).post(`/getmanager/676f9399ea4f13581c844ab2`).set('x-api-key', 'Administrator' || 'Superadmin')
        // console.log('details/...', JSON.parse(getResponse.text))
        expect(JSON.parse(getResponse.text).status).toBe(404)
        expect(getResponse.body.message).toBe('Manager not found.')
    })

    test('POST /getallmanager should fetch all managers', async () => {
        const getAllResponse = await request(app).post('/getallmanager').set('x-api-key', 'Administrator' || 'Superadmin')
        console.log('get all managers/...', getAllResponse.text)
        expect(getAllResponse.body.status).toBe(200);
        expect(getAllResponse.body.message).toBe('Manager all get successfully.');
        expect(getAllResponse.body.managers).toBeInstanceOf(Array);
    })
    test("POST /getallmanager when fetching all manager and manager's not found", async() => {
        const getAllResponse = await request(app).post('/getallmanager').set('x-api-key', 'Administrator' || 'Superadmin')
        // console.log('details/...', JSON.parse(getResponse.text))
        expect([]).toStrictEqual([])
    })

    test('POST /updatemanager/:id should update manager details', async () => {
        const updateResponse = await request(app).post(`/updatemanager/${createdManagerId}`).set('x-api-key', 'Administrator' || 'Superadmin').send({
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
        })
        console.log('Updated manager details:', updateResponse.text);
        expect(updateResponse.body.status).toBe(200);
        expect(updateResponse.body.message).toBe('Manager details updated successfully.');
        expect(updateResponse.body.updateManager.personalDetails.email).toBe('update@example.com');
    })
    test('POST /updatemanager/:id when updating manager details and manager not found', async() => {
        const updateResponse = await request(app).post(`/updatemanager/676f9399ea4f13581c844ab2`).set('x-api-key', 'Administrator' || 'Superadmin').send({
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
        })
        // console.log('details/...', JSON.parse(getResponse.text))
        expect(JSON.parse(updateResponse.text).status).toBe(404)
        expect(updateResponse.body.message).toBe('Manager not found')
    })

    test('POST /deletemanager/:id should delete a manager', async () => {
        const deleteResponse = await request(app).post(`/deletemanager/${createdManagerId}`).set('x-api-key', 'Administrator' || 'Superadmin')
        console.log('delete manager details/..', deleteResponse.text)
        expect(deleteResponse.body.status).toBe(200);
        expect(deleteResponse.body.message).toBe('Manager deleted successfully.');
        const deletedManager = await User.findById(createdManagerId);
        expect(deletedManager.isDeleted).toBe(true);
    })
    test('POST /deletemanager/:id when deleting manager and manager not found', async() => {
        const deleteResponse = await request(app).post(`/deletemanager/676f9399ea4f13581c844ab2`).set('x-api-key', 'Administrator' || 'Superadmin')
        // console.log('details/...', JSON.parse(getResponse.text))
        expect(JSON.parse(deleteResponse.text).status).toBe(404)
        expect(deleteResponse.body.message).toBe('Manager not found')
    })
});
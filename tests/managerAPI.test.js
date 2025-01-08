const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const bcrypt = require('bcrypt');

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

let manager;

beforeEach(async () => {
    manager = await User.find()
});


// all api called manager by Superadmin and Administrator
describe('Superadmin and Administrator Routes - Crud Manager Test', () => {
    let createdManagerId;
    let token
    describe('~ For add manager', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const hashedPassword = await bcrypt.hash('Administrator@123', 10);
            await User.create({
                personalDetails: {
                    email: 'administrator@example.com',
                    password: hashedPassword,
                },
                isDeleted: false,
                role: 'Administrator'
            });
            const userRes = await request(app)
                .post('/login')
                .send({
                    email: 'administrator@example.com',
                    password: 'Administrator@123',
                });

            expect(JSON.parse(userRes.text).status).toBe(200);
            expect(JSON.parse(userRes.text).message).toBe('User login successfully');
            expect(JSON.parse(userRes.text).user).toHaveProperty('token');
            token = JSON.parse(userRes.text).user.token
            const res = await request(app)
                .post('/addmanager')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for add a manager', async () => {
            const createResponse = await request(app).post('/addmanager').set('Authorization', `Bearer ${token}`).send({
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
                    "kinName": "",
                    "relationshipToYou": "",
                    "address": "",
                    "postCode": "",
                    "emergencyContactNumber": "",
                    "email": ""
                },
                "financialDetails": {
                    "bankName": "",
                    "holderName": "",
                    "sortCode": "",
                    "accountNumber": "",
                    "payrollFrequency": "",
                    "pension": ""
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
            expect(createResponse.body.status).toBe(200);
            expect(createResponse.body.message).toBe('Manager created successfully.');
            expect(createResponse.body.manager).toHaveProperty('_id');
            createdManagerId = await (JSON.parse(createResponse.text)).manager._id
        })
        test('should return 409 for email already exist', async () => {
            const res = await request(app).post('/addmanager').set('Authorization', `Bearer ${token}`).send({
                "personalDetails": {
                    "firstName": "add manager for testing",
                    "middleName": "add manager for testing",
                    "lastName": "add manager for testing",
                    "phone": "1234567890",
                    "email": "jane.doe@example.com",
                },
            })
            expect(JSON.parse(res.text).status).toBe(409);
            expect(JSON.parse(res.text).message).toBe('Email already exists.');
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                    password: hashedPassword,
                },
                isDeleted: false,
                role: 'Manager'
            });
            const res = await request(app)
                .post('/login')
                .send({
                    email: 'test123@example.com',
                    password: 'Test@123',
                });

            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User login successfully');
            expect(JSON.parse(res.text).user).toHaveProperty('token');
            const res1 = await request(app).post('/addmanager').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`).send({
                "personalDetails": {
                    "firstName": "add manager for testing",
                    "middleName": "add manager for testing",
                    "lastName": "add manager for testing",
                    "phone": "1234567890",
                    "email": "rishi12345@example.com",
                },
            });
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For get manager by ID', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .get(`/getmanager/${createdManagerId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should fetch a manager by ID', async () => {
            const getResponse = await request(app).get(`/getmanager/${createdManagerId}`).set('Authorization', `Bearer ${token}`)
            expect(getResponse.body.status).toBe(200);
            expect(getResponse.body.message).toBe('Manager get successfully.');
            expect(getResponse.body.manager.personalDetails.firstName).toBe('add manager for testing');
        });
        test('should return 409 for ID pass null', async () => {
            const getResponse = await request(app).get(`/getmanager/null`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(getResponse.body.message).toBe('Manager not found')
        })
        test('should return 409 for manager not found', async () => {
            const getResponse = await request(app).get(`/getmanager/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(getResponse.body.message).toBe('Manager not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                    password: hashedPassword,
                },
                isDeleted: false,
                role: 'Manager'
            });
            const res = await request(app)
                .post('/login')
                .send({
                    email: 'test123@example.com',
                    password: 'Test@123',
                });

            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User login successfully');
            expect(JSON.parse(res.text).user).toHaveProperty('token');
            const res1 = await request(app).get(`/getmanager/${createdManagerId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For get all manager', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .get('/getallmanager')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for fetch all managers', async () => {
            const res = await request(app).get('/getallmanager').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('Manager all get successfully.');
            expect(JSON.parse(res.text).managers).toBeInstanceOf(Array);
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                    password: hashedPassword,
                },
                isDeleted: false,
                role: 'Manager'
            });
            const res = await request(app)
                .post('/login')
                .send({
                    email: 'test123@example.com',
                    password: 'Test@123',
                });

            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User login successfully');
            expect(JSON.parse(res.text).user).toHaveProperty('token');
            const res1 = await request(app).get('/getallmanager').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For update manager', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .post(`/updatemanager/${createdManagerId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for update manager details', async () => {
            const updateResponse = await request(app).post(`/updatemanager/${createdManagerId}`).set('Authorization', `Bearer ${token}`).send({
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
            expect(updateResponse.body.status).toBe(200);
            expect(updateResponse.body.message).toBe('Manager details updated successfully.');
        })
        test('should return 409 for manager not found', async () => {
            const getResponse = await request(app).post(`/updatemanager/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(getResponse.body.message).toBe('Manager not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                    password: hashedPassword,
                },
                isDeleted: false,
                role: 'Manager'
            });
            const res = await request(app)
                .post('/login')
                .send({
                    email: 'test123@example.com',
                    password: 'Test@123',
                });

            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User login successfully');
            expect(JSON.parse(res.text).user).toHaveProperty('token');
            const res1 = await request(app).post(`/updatemanager/${createdManagerId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For delete manager', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .post(`/deletemanager/${createdManagerId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for delete a manager', async () => {
            const deleteResponse = await request(app).post(`/deletemanager/${createdManagerId}`).set('Authorization', `Bearer ${token}`)
            expect(deleteResponse.body.status).toBe(200);
            expect(deleteResponse.body.message).toBe('Manager deleted successfully.');
            const deletedManager = await User.findById(createdManagerId);
            expect(deletedManager.isDeleted).toBe(true);
        })
        test('should return 404 for manager not found', async () => {
            const deleteResponse = await request(app).post(`/deletemanager/${createdManagerId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(deleteResponse.text).status).toBe(404)
            expect(deleteResponse.body.message).toBe('Manager not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                    password: hashedPassword,
                },
                isDeleted: false,
                role: 'Employee'
            });
            const res = await request(app)
                .post('/login')
                .send({
                    email: 'test123@example.com',
                    password: 'Test@123',
                });

            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User login successfully');
            expect(JSON.parse(res.text).user).toHaveProperty('token');
            const res1 = await request(app).post(`/deletemanager/${createdManagerId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })
});
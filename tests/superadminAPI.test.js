const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const Company = require('../models/company')
const Location = require('../models/location')
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

let comapnies;
let locations;

beforeEach(async () => {
    comapnies = await Company.find()
    locations = await Location.find()
});


// all api called company by superadmin
let createdCompanyId;
describe('**SuperAdmin Routes - Crud Company Test**', () => {
    let token
    describe('~ For add Company', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const hashedPassword = await bcrypt.hash('Superadmin@123', 10);
            await User.create({
                personalDetails: {
                    email: 'superadmin@example.com',
                },
                password: hashedPassword,
                isDeleted: false,
                role: 'Superadmin'
            });
            const userRes = await request(app)
                .post('/login')
                .send({
                    email: 'superadmin@example.com',
                    password: 'Superadmin@123',
                });

            expect(JSON.parse(userRes.text).status).toBe(200);
            expect(JSON.parse(userRes.text).message).toBe('User login successfully');
            expect(JSON.parse(userRes.text).user).toHaveProperty('token');
            token = JSON.parse(userRes.text).user.token
            const res = await request(app)
                .post('/addCompany')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for add a company', async () => {
            const createResponse = await request(app).post('/addCompany').set('Authorization', `Bearer ${token}`).send({
                "companyDetails": {
                    "companyCode": "COMP001",
                    "businessName": "XYZ Ltd.",
                    "companyLogo": "",
                    "companyRegistrationNumber": "456789",
                    "payeReferenceNumber": "PAYE456",
                    "address": "159 Street",
                    "addressLine2": "Suite 100",
                    "city": "Cityville",
                    "postCode": "56789",
                    "country": "Countryland",
                    "timeZone": "GMT+1",
                    "contactPersonFirstname": "newJohn",
                    "contactPersonMiddlename": "A.",
                    "contactPersonLastname": "Doe",
                    "contactPersonEmail": "newJohn.doe@example.com",
                    "contactPhone": "9876543210",
                    "adminToReceiveNotification": "admin@example.com",
                    "additionalEmailsForCompliance": "compliance@example.com",
                    "pensionProvider": "Provider Inc."
                },
                "employeeSettings": {
                    "payrollFrequency": "Weekly",
                    "immigrationReminders": {
                        "day1st": "5",
                        "day2nd": "10",
                        "day3rd": "15"
                    },
                    "holidayYear": "Jan-Dec",
                    "noticePeriodDays": "25",
                    "contactConfirmationDays": "17",
                    "rightToWorkCheckReminder": "58",
                    "leaveEntitlements": {
                        "holidaysExcludingBank": "20",
                        "sickLeaves": "10"
                    }
                },
                "contractDetails": {
                    "startDate": "2025-01-01",
                    "endDate": "2025-12-31",
                    "maxEmployeesAllowed": "100"
                }
            })
            expect(createResponse.body.status).toBe(200);
            expect(createResponse.body.message).toBe('Company created successfully.');
            expect(createResponse.body.company).toHaveProperty('_id');
            createdCompanyId = await (JSON.parse(createResponse.text)).company._id

        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).post('/addCompany').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For get company by ID', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .get(`/getCompany/${createdCompanyId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for fetch a company by ID', async () => {
            const getResponse = await request(app).get(`/getCompany/${createdCompanyId}`).set('Authorization', `Bearer ${token}`)
            expect(getResponse.body.status).toBe(200);
            expect(getResponse.body.message).toBe('Company get successfully.');
        });
        test('should return 409 for ID pass null', async () => {
            const getResponse = await request(app).get(`/getCompany/null`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(getResponse.body.message).toBe('Company not found')
        })
        test('should return 409 for company not found', async () => {
            const getResponse = await request(app).get(`/getCompany/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(getResponse.body.message).toBe('Company not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).get(`/getCompany/${createdCompanyId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For get all company', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .get('/getAllCompany')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for fetch all companys', async () => {
            const getAllResponse = await request(app).get('/getAllCompany').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getAllResponse.text).status).toBe(200);
            expect(JSON.parse(getAllResponse.text).message).toBe('Company all get successfully.');
            expect(JSON.parse(getAllResponse.text).companies).toBeInstanceOf(Array);
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).get('/getAllCompany').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For update company', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .post(`/updateCompany/${createdCompanyId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for update company details', async () => {
            const updateResponse = await request(app).post(`/updateCompany/${createdCompanyId}`).set('Authorization', `Bearer ${token}`).send({
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
            expect(JSON.parse(updateResponse.text).status).toBe(200);
            expect(JSON.parse(updateResponse.text).message).toBe('Company details updated successfully.');
        })
        test('should return 409 for company not found', async () => {
            const getResponse = await request(app).post(`/updateCompany/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(getResponse.body.message).toBe('Company not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).post(`/updateCompany/${createdCompanyId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For delete company', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .post(`/deleteCompany/${createdCompanyId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for delete a company', async () => {
            const deleteResponse = await request(app).post(`/deleteCompany/${createdCompanyId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(deleteResponse.text).status).toBe(200);
            expect(JSON.parse(deleteResponse.text).message).toBe('Company deleted successfully.');
            // const deletedCompany = await User.findById(createdCompanyId);
            // expect(deletedCompany.isDeleted).toBe(true);
        })
        test('should return 404 for company not found', async () => {
            const deleteResponse = await request(app).post(`/deleteCompany/${createdCompanyId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(deleteResponse.text).status).toBe(404)
            expect(JSON.parse(deleteResponse.text).message).toBe('Company not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).post(`/deleteCompany/${createdCompanyId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })
})

// all api called location by superadmin
describe('**SuperAdmin Routes - Crud Location Test**', () => {
    let createdLocationId;
    let token
    describe('~ For add location', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const hashedPassword = await bcrypt.hash('Superadmin@123', 10);
            await User.create({
                personalDetails: {
                    email: 'superadmin@example.com',
                },
                password: hashedPassword,
                isDeleted: false,
                role: 'Superadmin'
            });
            const userRes = await request(app)
                .post('/login')
                .send({
                    email: 'superadmin@example.com',
                    password: 'Superadmin@123',
                });

            expect(JSON.parse(userRes.text).status).toBe(200);
            expect(JSON.parse(userRes.text).message).toBe('User login successfully');
            expect(JSON.parse(userRes.text).user).toHaveProperty('token');
            token = JSON.parse(userRes.text).user.token
            const res = await request(app)
                .post('/addLocation')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for add a location', async () => {
            const createResponse = await request(app).post('/addLocation').set('Authorization', `Bearer ${token}`).send({
                companyId: createdCompanyId,
                payeReferenceNumber: '999999',
                locationName: 'Lifecycle Test Location',
                address: '123 Lifecycle Street',
                city: 'Lifecycle City',
                postcode: '99999',
                country: 'Lifecycle Country',
                ukviApproved: true,
            })
            expect(JSON.parse(createResponse.text).status).toBe(200);
            expect(JSON.parse(createResponse.text).message).toBe('Location created successfully.');
            expect(JSON.parse(createResponse.text).location).toHaveProperty('_id');
            createdLocationId = await (JSON.parse(createResponse.text)).location._id

        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).post('/addLocation').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For get location by ID', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .get(`/getLocation/${createdLocationId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for fetch a location by ID', async () => {
            const getResponse = await request(app).get(`/getLocation/${createdLocationId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(200);
            expect(JSON.parse(getResponse.text).message).toBe('Location get successfully.');
        });
        test('should return 409 for ID pass null', async () => {
            const getResponse = await request(app).get(`/getLocation/null`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(JSON.parse(getResponse.text).message).toBe('Location not found')
        })
        test('should return 409 for location not found', async () => {
            const getResponse = await request(app).get(`/getLocation/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(JSON.parse(getResponse.text).message).toBe('Location not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).get(`/getLocation/${createdLocationId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For get all location', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .get('/getalllocation')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for fetch all locations', async () => {
            const getAllResponse = await request(app).get('/getAllLocation').set('Authorization', `Bearer ${token}`)
            expect(getAllResponse.body.status).toBe(200);
            expect(getAllResponse.body.message).toBe('Location all get successfully.');
            expect(getAllResponse.body.locations).toBeInstanceOf(Array);
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).get('/getAllLocation').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For update location', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .post(`/updateLocation/${createdLocationId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for update location details', async () => {
            const updateResponse = await request(app).post(`/updateLocation/${createdLocationId}`).set('Authorization', `Bearer ${token}`).send({
                address: '456 Updated Lifecycle Street',
            })
            expect(updateResponse.body.status).toBe(200);
            expect(updateResponse.body.message).toBe('Location details updated successfully.');
        })
        test('should return 409 for location not found', async () => {
            const getResponse = await request(app).post(`/updateLocation/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(getResponse.body.message).toBe('Location not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).post(`/updateLocation/${createdLocationId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ For delete location', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .post(`/deleteLocation/${createdLocationId}`)
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for delete a location', async () => {
            const deleteResponse = await request(app).post(`/deleteLocation/${createdLocationId}`).set('Authorization', `Bearer ${token}`)
            expect(deleteResponse.body.status).toBe(200);
            expect(deleteResponse.body.message).toBe('Location deleted successfully.');
            // const deletedLocation = await User.findById(createdLocationId);
            // expect(deletedLocation.isDeleted).toBe(true);
        })
        test('should return 404 for location not found', async () => {
            const deleteResponse = await request(app).post(`/deleteLocation/${createdLocationId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(deleteResponse.text).status).toBe(404)
            expect(deleteResponse.body.message).toBe('Location not found')
        })
        test('should return 403 for forbidden roles', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
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
            const res1 = await request(app).post(`/deleteLocation/${createdLocationId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })
});

describe('**Crud Contract Test**', () => {
    let newToken
    test('should return 401 for Unauthorized: Invalid API key', async () => {
        const hashedPassword = await bcrypt.hash('Testeruser@123', 10);
        await User.create({
            personalDetails: {
                email: 'testeruser@gmail.com',
            },
            jobDetails: [{
                role: 'Superadmin'
            }],
            role: 'Superadmin',
            password: hashedPassword
        })
        const loginUser = await request(app)
            .post('/login')
            .send({
                email: 'testeruser@gmail.com',
                password: 'Testeruser@123'
            })
        newToken = JSON.parse(loginUser.text).token
        const res = await request(app)
            .post('/addContract')
            .send({ companyId: '', contractName: 'company contract name', contract: 'data:plain/txt;base64,dGVzdGluZyBwYXNzaW5nIHBsYWluIGluIGRvY3VtZW50' })
        expect(JSON.parse(res.text).status).toBe(401)
        expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
    })
    test('should return invalid or expairy token when token is invalid', async () =>{

        const res = await request(app)
            .post('/addContract')
            .set('Authorization', `Bearer abcdefghABCDEijklmnrsLNOPQRStuvwxyzFGHIJKopqVWXYZ`)
            .send({ companyId: createdCompanyId, contractName: 'company contract name', contract: 'data:plain/txt;base64,dGVzdGluZyBwYXNzaW5nIHBsYWluIGluIGRvY3VtZW50'})
        expect(JSON.parse(res.text).message).toBe('Invalid or expiry token!')
    })
    // test('should return 404 for company not found', async () => {
    //     const res = await request(app)
    //         .post('/addContract')
    //         .set('Authorization', `Bearer ${newToken}`)
    //         .send({ companyId: '677f6d67d8500bff50846f29' })
    //         console.log('res/..', JSON.parse(res.text))
    //     expect(JSON.parse(res.text).status).toBe(404)
    //     expect(JSON.parse(res.text).message).toBe('Company not found')
    // })
});
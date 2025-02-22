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
describe('**- Crud Company Test**', () => {
    let createdCompanyId;
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
            expect(JSON.parse(createResponse.text).status).toBe(200);
            expect(JSON.parse(createResponse.text).message).toBe('Company created successfully.');
            expect(JSON.parse(createResponse.text).company).toHaveProperty('_id');
            createdCompanyId = await (JSON.parse(createResponse.text)).company._id

        })
        test('should return 403 for Access denied', async () => {
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
            expect(JSON.parse(getResponse.text).status).toBe(200);
            expect(JSON.parse(getResponse.text).message).toBe('Company fetched successfully.');
        });
        test('should return 409 for ID pass null', async () => {
            const getResponse = await request(app).get(`/getCompany/null`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(JSON.parse(getResponse.text).message).toBe('Company not found')
        })
        test('should return 409 for company not found', async () => {
            const getResponse = await request(app).get(`/getCompany/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(JSON.parse(getResponse.text).message).toBe('Company not found')
        })
        test('should return 403 for Access denied', async () => {
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
            expect(JSON.parse(getAllResponse.text).message).toBe('Companines fetched successfully.');
            expect(JSON.parse(getAllResponse.text).companies).toBeInstanceOf(Array);
        })
        test('should return 403 for Access denied', async () => {
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
            expect(JSON.parse(updateResponse.text).status).toBe(200);
            expect(JSON.parse(updateResponse.text).message).toBe('Company details updated successfully.');
        })
        test('should return 409 for company not found', async () => {
            const getResponse = await request(app).post(`/updateCompany/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(getResponse.text).status).toBe(404)
            expect(getResponse.body.message).toBe('Company not found')
        })
        test('should return 403 for Access denied', async () => {
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
        test('should return 403 for Access denied', async () => {
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
describe('**- Crud Location Test**', () => {
    let createdCompanyId
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
        test('Should return 404 for company not found', async () => {
            const res = await request(app).post('/addLocation').set('Authorization', `Bearer ${token}`).send({
                companyId: createdCompanyId,
                payeReferenceNumber: '999999',
                locationName: 'Lifecycle Test Location',
                address: '123 Lifecycle Street',
                city: 'Lifecycle City',
                postcode: '99999',
                country: 'Lifecycle Country',
                ukviApproved: true,
            })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Company not found.')
        })
        test('should return 200 for add a location', async () => {
            const createCompany = await request(app).post('/addCompany').set('Authorization', `Bearer ${token}`).send({
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
            createdCompanyId = await (JSON.parse(createCompany.text)).company._id
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
        test('Should return 409 for exist location', async () => {
            const res = await request(app).post('/addLocation').set('Authorization', `Bearer ${token}`).send({
                companyId: createdCompanyId,
                payeReferenceNumber: '999999',
                locationName: 'Lifecycle Test Location',
                address: '123 Lifecycle Street',
                city: 'Lifecycle City',
                postcode: '99999',
                country: 'Lifecycle Country',
                ukviApproved: true,
            })
            expect(JSON.parse(res.text).status).toBe(409)
            expect(JSON.parse(res.text).message).toBe("The location name 'Lifecycle Test Location' already exists. Please choose a different name.")
        })
        test('should return 403 for Access denied', async () => {
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
            expect(JSON.parse(getResponse.text).message).toBe('Location fetched successfully.');
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
        test('should return 403 for Access denied', async () => {
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
            expect(getAllResponse.body.message).toBe('Locations fetched successfully.');
            expect(getAllResponse.body.locations).toBeInstanceOf(Array);
        })
        test('should return 403 for Access denied', async () => {
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

    describe('~ For get all locations by company ID', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app).get('/getCompanyLocations?companyId=679b11982789a90ec173fe4f')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('Should return 404 company not found', async () => {
            const res = await request(app).get('/getCompanyLocations?companyId=679b11982789a90ec173fe4f').set('Authorization', `Bearer ${token}`)
            // console.log('res:', res)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Company not found!')
        })
        test('Should return 200 companys location getted successfuly', async () => {
            const res = await request(app).get(`/getCompanyLocations?companyId=${createdCompanyId}`).set('Authorization', `Bearer ${token}`)
            // console.log('res:', res)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe("Company's locations fetched successfully.")
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token}, { $set: { role: 'superadmin' } })
            const res = await request(app).get(`/getCompanyLocations?companyId=${createdCompanyId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For update location', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token}, { $set: { role: 'Superadmin' } })
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
        test('should return 403 for Access denied', async () => {
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
        test('should return 403 for Access denied', async () => {
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

describe('**Crud Contract Test ( Superadmin and Administrator )**', () => {
    let createdCompanyId
    let contractId
    let newToken
    describe('~ For add contract', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .post('/addContract')
                .send({ companyId: '', contractName: 'company contract name', contract: 'data:plain/txt;base64,dGVzdGluZyBwYXNzaW5nIHBsYWluIGluIGRvY3VtZW50' })
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        // test('should return invalid or expairy token when token is invalid', async () =>{
        //     const res = await request(app)
        //         .post('/addContract')
        //         .set('Authorization', `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2Nzk3NGY3NjYyMGU5NTAxN2RlNWMyOTUiLCJpYXQiOjE3MzkyNjQwMDd9.KaIYtpE4A5_Y69UiO2-SJYzZB8BCu3q9wR6m2D-95lU`)
        //         .send({ companyId: createdCompanyId, contractName: 'company contract name', contract: 'data:plain/txt;base64,dGVzdGluZyBwYXNzaW5nIHBsYWluIGluIGRvY3VtZW50'})
        //     expect(JSON.parse(res.text).message).toBe('Invalid or expiry token!')
        // })
        test('should return 404 for company not found', async () => {
            const hashedPassword = await bcrypt.hash('Testeruser@123', 10);
            await User.create({
                personalDetails: {
                    email: 'testeruser@gmail.com',
                },
                jobDetails: [{
                    role: 'Superadmin',
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
            newToken = await JSON.parse(loginUser.text).user.token
            const res = await request(app)
                .post('/addContract')
                .set('Authorization', `Bearer ${newToken}`)
                .send({ companyId: '677f6d67d8500bff50846f29' })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Company not found.')
        })
        test('Should return 400 for can not passed reqired fileds', async () => {
            const createCompany = await request(app).post('/addCompany').set('Authorization', `Bearer ${newToken}`).send({
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
            // console.log('createCompany:', JSON.parse(createCompany.text))
            createdCompanyId = await (JSON.parse(createCompany.text)).company._id
            const res = await request(app)
                .post('/addContract')
                .set('Authorization', `Bearer ${newToken}`)
                .send({ companyId: createdCompanyId })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Contract name and contract are required.')
        })
        test('Should return 400 for file uploading error', async () => {
            const res = await request(app)
                .post('/addContract')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    companyId: createdCompanyId,
                    contractName: 'Full-Time',
                    contract: '132',
                    contractFileName: 'Full-Time'
                })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe(`Error occurred while uploading file. Please try again.`)
        })
        test('Should return 200 for contract added successfully', async () => {
            const res = await request(app)
                .post('/addContract')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    companyId: createdCompanyId,
                    contractName: 'Full-Time',
                    contract: 'data:text/txt;base64,dGVzdGluZ3BsYWludGV4dA==',
                    contractFileName: 'Full-Time'
                })
            contractId = await JSON.parse(res.text).newContract._id
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Contract form created successfully.')
        })
        test('Should return 409 for exist contract added', async () => {
            const res = await request(app)
                .post('/addContract')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    companyId: createdCompanyId,
                    contractName: 'Full-Time',
                    contract: 'data:text/txt;base64,dGVzdGluZ3BsYWludGV4dA==',
                    contractFileName: 'Full-Time'
                })
            expect(JSON.parse(res.text).status).toBe(409)
            expect(JSON.parse(res.text).message).toBe(`A contract with the name Full-Time already exists for this company.`)
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app)
                .post('/addContract')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    companyId: createdCompanyId,
                    contractName: 'Full-Time',
                    contract: 'data:text/txt;base64,dGVzdGluZ3BsYWludGV4dA==',
                    contractFileName: 'Full-Time'
                })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For get contract', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getContract/67974f76620e95017de5c295')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 contract not found', async () => {
            const res = await request(app)
            .get('/getContract/67974f76620e95017de5c295')
            .set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Contract not found')
        })
        test('Should return 200 for contract getted successfully', async () => {
            const res = await request(app)
            .get(`/getContract/${contractId}`)
            .set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Contract fetched successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app)
                .get(`/getContract/${contractId}`)
                .set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For get companys contract by company ID', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getAllContractOfCompany')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 company not found', async () => {
            const res = await request(app)
            .get('/getAllContractOfCompany')
            .set('Authorization', `Bearer ${newToken}`).send({ companyId: '679b11982789a90ec173fe4f' })
            // console.log('res:', res)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Company not found')
        })
        test('Should return 200 for companys location getted successfully', async () => {
            const res = await request(app)
            .get(`/getAllContractOfCompany`)
            .set('Authorization', `Bearer ${newToken}`).send({ companyId: createdCompanyId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Contracts fetched successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app)
            .get(`/getAllContractOfCompany`)
            .set('Authorization', `Bearer ${newToken}`).send({ companyId: createdCompanyId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For get all contract', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getAllContract')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 200 for all contract getted sucessfully', async () => {
            const res = await request(app).get('/getAllContract').set('Authorization', `Bearer ${newToken}`)
            // console.log('Res:', res.text)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Contracts fetched successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app).get('/getAllContract').set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For update contract', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/updateContract/67aad9033e7992b77587d60a`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 contract not found', async () => {
            const res = await request(app).post(`/updateContract/67aad9033e7992b77587d60a`).set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Contract not found')
        })
        test('Should return 409 already exist contract', async () => {
            await request(app).post('/addContract').set('Authorization', `Bearer ${newToken}`).send({companyId: createdCompanyId,contractName: 'FullTime',contract: 'data:text/txt;base64,dGVzdGluZ3BsYWludGV4dA==',contractFileName: 'FullTime'})
            const res = await request(app).post(`/updateContract/${contractId}`).set('Authorization', `Bearer ${newToken}`).send({ contractName: 'FullTime', companyId: createdCompanyId })
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(409)
            expect(JSON.parse(res.text).message).toBe('A contract with the name "FullTime" already exists for this company.')
        })
        test('Should return 200 for update contract', async () => {
            const res = await request(app).post(`/updateContract/${contractId}`).set('Authorization', `Bearer ${newToken}`).send({ contractName: 'contract', companyId: createdCompanyId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Contract details updated successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/updateContract/${contractId}`).set('Authorization', `Bearer ${newToken}`).send({ contractName: 'contract', companyId: createdCompanyId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For delete contract', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/deleteContract/67aad9033e7992b77587d60a`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 contract not found', async () => {
            const res = await request(app).post(`/deleteContract/67aad9033e7992b77587d60a`).set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Contract not found')
        })
        test('Should return 200 for contract deleted successfully', async () => {
            const res = await request(app).post(`/deleteContract/${contractId}`).set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Contract deleted successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/deleteContract/${contractId}`).set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })


});

describe('** QR codes ( Superadmin and Administrator )**', () => {
    let createdCompanyId
    let createdLocationId
    let token
    let QRId
    describe('~ For generate QR code', () => {
        test('Should return 400 for invalid qr type', async () => {
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
            const createCompany = await request(app).post('/addCompany').set('Authorization', `Bearer ${token}`).send({
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
            expect(JSON.parse(createCompany.text).status).toBe(200);
            expect(JSON.parse(createCompany.text).message).toBe('Company created successfully.');
            expect(JSON.parse(createCompany.text).company).toHaveProperty('_id');
            createdCompanyId = await (JSON.parse(createCompany.text)).company._id
            const createLocation = await request(app).post('/addLocation').set('Authorization', `Bearer ${token}`).send({
                companyId: createdCompanyId,
                payeReferenceNumber: '999999',
                locationName: 'Lifecycle Test Location',
                address: '123 Lifecycle Street',
                city: 'Lifecycle City',
                postcode: '99999',
                country: 'Lifecycle Country',
                ukviApproved: true,
            })
            expect(JSON.parse(createLocation.text).status).toBe(200);
            expect(JSON.parse(createLocation.text).message).toBe('Location created successfully.');
            expect(JSON.parse(createLocation.text).location).toHaveProperty('_id');
            createdLocationId = await (JSON.parse(createLocation.text)).location._id
            const res = await request(app)
                .post(`/generateQR/${createdLocationId}`)
                .set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('QR type is undefined, please enter valid type.')
        })
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app).post(`/generateQR/${createdLocationId}`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 location not found', async () => {
            const res = await request(app)
                .post(`/generateQR/67a602a80bba65ae29da84f1`)
                .set('Authorization', `Bearer ${token}`)
                .send({ qrType: 'Location' , qrValue: 'TestingQRcode', qrCode: 'data:plain/txt;base64,dGVzdGluZ3BsYWludGV4dA==' })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Location not found')
        })
        test('Should return 200 for QR generatr successfully', async () => {
            const res = await request(app)
                .post(`/generateQR/${createdLocationId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ qrType: 'Location', qrValue: 'TestingQRcode', qrCode: 'data:plain/txt;base64,dGVzdGluZ3BsYWludGV4dA==' })
            QRId = JSON.parse(res.text).QRCode._id
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Location QR generated successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token}, { $set: { role: 'superadmin' } })
            const res = await request(app)
                .post(`/generateQR/${createdLocationId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ qrType: 'Location', qrValue: 'TestingQRcode', qrCode: 'data:plain/txt;base64,dGVzdGluZ3BsYWludGV4dA==' })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For get all QRCodes of companys location', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token}, { $set: { role: 'Superadmin' } })
            const res = await request(app).get(`/getAllQRCodes/67a602a80bba65ae29da84f1`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 for location not found', async () => {
            const res = await request(app)
                .get('/getAllQRCodes/67a602a80bba65ae29da84f1').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Location not found.')
        })
        test('Should return 200 for QR codes getted successfully', async () => {
            const res = await request(app)
                .get(`/getAllQRCodes/${createdLocationId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('QR codes fetched successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token}, { $set: { role: 'superadmin' } })
            const res = await request(app)
                .get(`/getAllQRCodes/${createdLocationId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ Do inactivate QR code', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token}, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/inactivateQRCode/67a602a80bba65ae29da84f1`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for, QR code not found', async () => {
            const res = await request(app).post(`/inactivateQRCode/67a602a80bba65ae29da84f1`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('QRCode not found!')
        })
        test('should return 200 for QR code inactivated successfully', async () => {
            const res = await request(app).post(`/inactivateQRCode/${QRId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('QRCode inactivated successfully.')
        })
        test('should return 400 for, already inactivated QR code', async () => {
            const res = await request(app).post(`/inactivateQRCode/${QRId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('The QR is already inactive')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token}, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/inactivateQRCode/${QRId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
            await User.findOneAndUpdate({token: token}, { $set: { role: 'Superadmin' } })
        })
    })
})

describe('** Holiday Management ( Superadmin and Administrator )**', () => {
    let createdCompanyId
    let createdLocationId
    let createdHolidayId
    let token
    describe('~ For add holiday', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app).post('/addHoliday')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 400 required fields not provide', async () => {
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
            const createCompany = await request(app).post('/addCompany').set('Authorization', `Bearer ${token}`).send({
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
            expect(JSON.parse(createCompany.text).status).toBe(200);
            expect(JSON.parse(createCompany.text).message).toBe('Company created successfully.');
            expect(JSON.parse(createCompany.text).company).toHaveProperty('_id');
            createdCompanyId = await (JSON.parse(createCompany.text)).company._id
            const createLocation = await request(app).post('/addLocation').set('Authorization', `Bearer ${token}`).send({
                companyId: createdCompanyId,
                payeReferenceNumber: '999999',
                locationName: 'Lifecycle Test Location',
                address: '123 Lifecycle Street',
                city: 'Lifecycle City',
                postcode: '99999',
                country: 'Lifecycle Country',
                ukviApproved: true,
            })
            expect(JSON.parse(createLocation.text).status).toBe(200);
            expect(JSON.parse(createLocation.text).message).toBe('Location created successfully.');
            expect(JSON.parse(createLocation.text).location).toHaveProperty('_id');
            createdLocationId = await (JSON.parse(createLocation.text)).location._id
            const res = await request(app)
                .post('/addHoliday').set('Authorization', `Bearer ${token}`).send({ locationId: createdLocationId })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Date and occasion are required!')
        })
        test('Should return 404 for Location not found', async () => {
            const res = await request(app)
            .post('/addHoliday').set('Authorization', `Bearer ${token}`).send({ date: '2025-02-12', occasion: 'JEST test' })
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Location not found.')
        })
        test('Should return 400 for already exist holiday', async () => {
            await request(app).post('/addHoliday').set('Authorization', `Bearer ${token}`).send({ locationId: createdLocationId, date: '2025-02-12', occasion: 'JEST test' })
            const res = await request(app)
            .post('/addHoliday').set('Authorization', `Bearer ${token}`).send({ locationId: createdLocationId, date: '2025-02-12', occasion: 'JEST test' })
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Holiday already exist.')
        })
        test('Should return 200 for holiday added successfully', async () => {
            const res = await request(app)
            .post('/addHoliday').set('Authorization', `Bearer ${token}`).send({ locationId: createdLocationId, date: '2025-02-13', occasion: 'JEST test' })
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Holiday created successfully.')
            createdHolidayId = await JSON.parse(res.text).holiday._id
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).post('/addHoliday').set('Authorization', `Bearer ${token}`).send({ locationId: createdLocationId, date: '2025-02-13', occasion: 'JEST test' })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For get holiday', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getHoliday/67a0ccec37c28a6eb563bd6c')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 for holiday not found', async () => {
            const res = await request(app).get('/getHoliday/67a0ccec37c28a6eb563bd6c').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Holiday not found')
        })
        test('Should return 200 for holiday getted successfully', async () => {
            const res = await request(app).get(`/getHoliday/${createdHolidayId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Holiday fetched successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).get(`/getHoliday/${createdHolidayId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For get all holidays', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getAllHolidays?locationId=67a0ccec37c28a6eb563bd6c')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 for location not found', async () => {
            const res = await request(app).get('/getAllHolidays?locationId=67a0ccec37c28a6eb563bd6c').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Location not found')
        })
        test('Should return 200 for get all holidays', async () => {
            const res = await request(app).get(`/getAllHolidays?locationId=${createdLocationId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Holidays fetched successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).get(`/getAllHolidays?locationId=${createdLocationId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For update holiday', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/updateHoliday/67a0ccec37c28a6eb563bd6c`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 for holiday not found', async () => {
            const res = await request(app).post(`/updateHoliday/67a0ccec37c28a6eb563bd6c`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Holiday not found')
        })
        test('Should return 200 for update holiday', async () => {
            const res = await request(app).post(`/updateHoliday/${createdHolidayId}`).set('Authorization', `Bearer ${token}`).send({ date: '2025-03-12', occasion: 'UpdateTesting' })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Holiday details updated successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/updateHoliday/${createdHolidayId}`).set('Authorization', `Bearer ${token}`).send({ date: '2025-03-12', occasion: 'UpdateTesting' })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For delete holiday', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/deleteHoliday/67a0ccec37c28a6eb563bd6c`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 for holiday not found', async () => {
            const res = await request(app).post(`/deleteHoliday/67a0ccec37c28a6eb563bd6c`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Holiday not found')
        })
        test('Should return 200 for delete holiday', async () => {
            const res = await request(app).post(`/deleteHoliday/${createdHolidayId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Holiday deleted successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/deleteHoliday/${createdHolidayId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
        })
    })
})

describe('** client module ( Superadmin and Administrator )**', () => {
    let createdCompanyId
    let createdClientId
    let token    
    describe('~ Add client', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            const res = await request(app).post('/addClient?companyId=67a0ccec37c28a6eb563bd6c')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 company not found', async () => {
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
            const createCompany = await request(app).post('/addCompany').set('Authorization', `Bearer ${token}`).send({
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
            expect(JSON.parse(createCompany.text).status).toBe(200);
            expect(JSON.parse(createCompany.text).message).toBe('Company created successfully.');
            expect(JSON.parse(createCompany.text).company).toHaveProperty('_id');
            createdCompanyId = await (JSON.parse(createCompany.text)).company._id
            const res = await request(app).post('/addClient?companyId=67a0ccec37c28a6eb563bd6c').set('Authorization', `Bearer ${token}`).send({ clientName: 'firstClient' })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Company not found')
        })
        test('should return 200 client added successfully', async () => {
            const res = await request(app).post(`/addClient?companyId=${createdCompanyId}`).set('Authorization', `Bearer ${token}`).send({ clientName: 'firstClient' })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Client created successfully')
            createdClientId = await JSON.parse(res.text).client._id
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/addClient?companyId=${createdCompanyId}`).set('Authorization', `Bearer ${token}`).send({ clientName: 'firstClient' })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ get client', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getClient/67a0ccec37c28a6eb563bd6c')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 for client not found', async () => {
            const res = await request(app).get('/getClient/67a0ccec37c28a6eb563bd6c').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Client not found')
        })
        test('Should return 200 for client getted successfully', async () => {
            const res = await request(app).get(`/getClient/${createdClientId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Client fetched successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).get(`/getClient/${createdClientId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ get all client', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getAllClients')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 200 for all client getted successfully', async () => {
            const res = await request(app).get('/getAllClients').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Clients fetched successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).get('/getAllClients').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ update client', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/updateClient/67a0ccec37c28a6eb563bd6c`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 client not found', async () => {
            const res = await request(app).post(`/updateClient/67a0ccec37c28a6eb563bd6c`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Client not found')
        })
        test('Should return 200 client details update successfully', async () => {
            const res = await request(app).post(`/updateClient/${createdClientId}`).set('Authorization', `Bearer ${token}`).send({ clientName: 'Update client name' })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Client details updated successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/updateClient/${createdClientId}`).set('Authorization', `Bearer ${token}`).send({ clientName: 'Update client name' })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ delete client', () => {
        test('should return 401 for, Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/deleteClient/67aad9033e7992b77587d60a`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 client not found', async () => {
            const res = await request(app).post(`/deleteClient/67aad9033e7992b77587d60a`).set('Authorization', `Bearer ${token}`)
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Client not found')
        })
        test('Should return 200 client details update successfully', async () => {
            const res = await request(app).post(`/deleteClient/${createdClientId}`).set('Authorization', `Bearer ${token}`).send({ clientName: 'Update client name' })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Client deleted successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: token }, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/deleteClient/${createdClientId}`).set('Authorization', `Bearer ${token}`).send({ clientName: 'Update client name' })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })
})

describe('**Crud Template Test ( Superadmin )**', () => {
    let templateId
    let newToken
    describe('~ For add template', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const res = await request(app)
                .post('/addTemplate')
                .send({ templateName: 'template name', template: 'data:plain/txt;base64,dGVzdGluZyBwYXNzaW5nIHBsYWluIGluIGRvY3VtZW50' })
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 400 for can not passed reqired fileds', async () => {
            await User.create({
                personalDetails: {
                    email: 'testeruserfortemplate@gmail.com',
                },
                jobDetails: [{
                    role: 'Superadmin',
                }],
                role: 'Superadmin',
                password: 'Password123'
            })
            const loginUser = await request(app)
                .post('/login')
                .send({
                    email: 'testeruserfortemplate@gmail.com',
                    password: 'Password123'
                })
            newToken = await JSON.parse(loginUser.text).user.token
            const res = await request(app)
                .post('/addTemplate')
                .set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Template name and template are required.')
        })
        test('Should return 400 for file uploading error', async () => {
            const res = await request(app)
                .post('/addTemplate')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    templateName: 'Full-Time',
                    template: '123',
                    templateFileName: 'Full-Time'
                })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe(`Error occurred while uploading file. Please try again.`)
        })
        test('Should return 200 for template added successfully', async () => {
            const res = await request(app)
                .post('/addTemplate')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    templateName: 'Full-Time',
                    template: 'data:text/txt;base64,dGVzdGluZ3BsYWludGV4dA==',
                    templateFileName: 'Full-Time'
                })
            templateId = await JSON.parse(res.text).newTemplate._id
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Template form created successfully.')
        })
        test('Should return 409 for exist template added', async () => {
            const res = await request(app)
                .post('/addTemplate')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    templateName: 'Full-Time',
                    template: 'data:text/txt;base64,dGVzdGluZ3BsYWludGV4dA==',
                    templateFileName: 'Full-Time'
                })
            expect(JSON.parse(res.text).status).toBe(409)
            expect(JSON.parse(res.text).message).toBe(`A template with the name Full-Time already exists.`)
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app)
                .post('/addTemplate')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    templateName: 'Full-Time',
                    template: 'data:text/txt;base64,dGVzdGluZ3BsYWludGV4dA==',
                    templateFileName: 'Full-Time'
                })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For get template', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getTemplate/67974f76620e95017de5c295')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 template not found', async () => {
            const res = await request(app)
            .get('/getTemplate/67974f76620e95017de5c295')
            .set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Template not found')
        })
        test('Should return 200 for template getted successfully', async () => {
            const res = await request(app)
            .get(`/getTemplate/${templateId}`)
            .set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Template fetched successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app)
                .get(`/getTemplate/${templateId}`)
                .set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For get all template', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).get('/getAllTemplates')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 200 for all template getted sucessfully', async () => {
            const res = await request(app).get('/getAllTemplates').set('Authorization', `Bearer ${newToken}`)
            // console.log('Res:', res.text)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Templates fetched successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app).get('/getAllTemplates').set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For update template', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/updateTemplate/67aad9033e7992b77587d60a`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 template not found', async () => {
            const res = await request(app).post(`/updateTemplate/67aad9033e7992b77587d60a`).set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Template not found')
        })
        test('Should return 409 already exist template', async () => {
            await request(app).post('/addTemplate').set('Authorization', `Bearer ${newToken}`).send({templateName: 'FullTime',template: 'data:text/txt;base64,dGVzdGluZ3BsYWludGV4dA==',templateFileName: 'FullTime'})
            const res = await request(app).post(`/updateTemplate/${templateId}`).set('Authorization', `Bearer ${newToken}`).send({ templateName: 'FullTime'})
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(409)
            expect(JSON.parse(res.text).message).toBe('A template with the name "FullTime" already exists.')
        })
        test('Should return 200 for update template', async () => {
            const res = await request(app).post(`/updateTemplate/${templateId}`).set('Authorization', `Bearer ${newToken}`).send({ templateName: 'template'})
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Template details updated successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/updateTemplate/${templateId}`).set('Authorization', `Bearer ${newToken}`).send({ templateName: 'template'})
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('~ For delete template', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'Superadmin' } })
            const res = await request(app).post(`/deleteTemplate/67aad9033e7992b77587d60a`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 404 template not found', async () => {
            const res = await request(app).post(`/deleteTemplate/67aad9033e7992b77587d60a`).set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Template not found')
        })
        test('Should return 200 for template deleted successfully', async () => {
            const res = await request(app).post(`/deleteTemplate/${templateId}`).set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Template deleted successfully.')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({token: newToken}, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/deleteTemplate/${templateId}`).set('Authorization', `Bearer ${newToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })


});
const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const Company = require('../models/company')
const Location = require('../models/location')

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

let comapnies;
let locations;

beforeEach(async () => {
    comapnies = await Company.find()
    locations = await Location.find()
});


// all api called company by superadmin
describe('SuperAdmin Routes - Crud Company Test', () => {
    let createdCompanyId;
    test('POST /addcompany should add a company', async () => {
        const createResponse = await request(app).post('/addcompany').send({
            "companyDetails": {
                "companyCode": "COMP001",
                "businessName": "XYZ Ltd.",
                "companyLogo": "logo2.png",
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
        }).set('x-api-key', 'Superadmin');
        console.log('created company/...', JSON.parse(createResponse.text))
        expect(createResponse.status).toBe(200);
        expect(createResponse.body.message).toBe('Company created successfully.');
        expect(createResponse.body.company).toHaveProperty('_id');
        createdCompanyId = await (JSON.parse(createResponse.text)).company._id
    })

    test('POST /getcompany/:id should fetch a company by ID', async () => {
        const getResponse = await request(app).post(`/getcompany/${createdCompanyId}`).set('x-api-key', 'Superadmin')
        console.log('get company details/..', getResponse.text)
        expect(getResponse.status).toBe(200);
        expect(getResponse.body.message).toBe('Company get successfully.');
        expect(getResponse.body.company.companyDetails.companyCode).toBe('COMP001');
    })

    test('POST /getallcompany should fetch all companies', async () => {
        const getAllResponse = await request(app).post('/getallcompany').set('x-api-key', 'Superadmin')
        console.log('get all comapnies/...', getAllResponse.text)
        expect(getAllResponse.status).toBe(200);
        expect(getAllResponse.body.message).toBe('Company all get successfully.');
        expect(getAllResponse.body.company).toBeInstanceOf(Array);
    })

    test('POST /updatecompany/:id should update company details', async () => {
        const updateResponse = await request(app).post(`/updatecompany/${createdCompanyId}`).set('x-api-key', 'Superadmin').send({
            "employeeSettings": {
                "payrollFrequency": "Monthly",
                "holidayYear": "Jan-Dec"
            },
        });
        console.log('Updated company details:', updateResponse.text);
        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.message).toBe('Company details updated successfully.');
        expect(updateResponse.body.updatedCompany.employeeSettings.payrollFrequency).toBe('Monthly');
    });

    
    test('POST /deletecompany/:id should delete a company', async () => {
        const deleteResponse = await request(app).post(`/deletecompany/${createdCompanyId}`).set('x-api-key', 'Superadmin')
        console.log('delete company details/..', deleteResponse.text)
        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.message).toBe('Company deleted successfully.');
        const deletedCompany = await Company.findById(createdCompanyId);
        expect(deletedCompany.isDeleted).toBe(true);
    })
})

// all api called location by superadmin
describe('SuperAdmin Routes - Crud Location Test', () => {
    let createdLocationId;
    test('POST /addlocation should add a location', async () => {
        const createResponse = await request(app)
            .post('/addlocation')
            .send({
                companyName: 'Lifecycle Test Company',
                payeReferenceNumber: '999999',
                locationName: 'Lifecycle Test Location',
                address: '123 Lifecycle Street',
                city: 'Lifecycle City',
                postcode: '99999',
                country: 'Lifecycle Country',
                ukviApproved: true,
            })
            .set('x-api-key', 'Superadmin');
        console.log('created location/...', JSON.parse(createResponse.text))
        expect(createResponse.status).toBe(200);
        expect(createResponse.body.message).toBe('Location created successfully.');
        expect(createResponse.body.location).toHaveProperty('_id');

        createdLocationId = createResponse.body.location._id;
    });

    test('POST /getlocation/:id should fetch a location by ID', async () => {
        const getResponse = await request(app)
            .post(`/getlocation/${createdLocationId}`)
            .set('x-api-key', 'Superadmin');
        console.log('get location details/..', getResponse.text)
        expect(getResponse.status).toBe(200);
        expect(getResponse.body.message).toBe('Location get successfully.');
        expect(getResponse.body.location.companyName).toBe('Lifecycle Test Company');
    });

    test('POST /getalllocation should fetch all locations', async () => {
        const getAllResponse = await request(app)
            .post('/getalllocation')
            .set('x-api-key', 'Superadmin');
        console.log('get all comapnies/...', getAllResponse.text)
        expect(getAllResponse.status).toBe(200);
        expect(getAllResponse.body.message).toBe('Location all get successfully.');
        expect(getAllResponse.body.location).toBeInstanceOf(Array);
    });

    test('POST /updatelocation/:id should update location details', async () => {
        const updateResponse = await request(app)
            .post(`/updatelocation/${createdLocationId}`)
            .send({
                address: '456 Updated Lifecycle Street',
            })
            .set('x-api-key', 'Superadmin');
        console.log('updated Location details/..', updateResponse.text)
        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.message).toBe('Location details updated successfully.');
        expect(updateResponse.body.updatedLocation.address).toBe('456 Updated Lifecycle Street');
    });

    test('POST /deletelocation/:id should delete a location', async () => {
        const deleteResponse = await request(app)
            .post(`/deletelocation/${createdLocationId}`)
            .set('x-api-key', 'Superadmin');
        console.log('delete Location details/..', deleteResponse.text)
        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.message).toBe('Location deleted successfully.');
        const deletedLocation = await Location.findById(createdLocationId);
        expect(deletedLocation.isDeleted).toBe(true);
    });
});
const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const bcrypt = require('bcrypt');

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

describe('Login API', () => {
    test('should log in a user with valid credentials', async () => {
        const hashedPassword = await bcrypt.hash('Password@123', 10);
        await User.create({
            personalDetails: {
                email: 'test@example.com',
                password: hashedPassword,
            },
            isDeleted: false,
        });

        const res = await request(app)
            .post('/login')
            .send({
                email: 'test@example.com',
                password: 'Password@123',
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('User login successfully');
    });
    test('should return 404 for non-existing user', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                email: 'notfound@example.com',
                password: 'Password@123',
            });

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe('User not found');
    });

    test('should return 404 for incorrect password', async () => {
        const hashedPassword = await bcrypt.hash('Password@123', 10);
        await User.create({
            personalDetails: {
                email: 'test@example.com',
                password: hashedPassword,
            },
            isDeleted: false,
        });

        const res = await request(app)
            .post('/login')
            .send({
                email: 'test@example.com',
                password: 'wrongpassword',
            });

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe('Password does not match');
    });
});

describe('Forgot Password API', () => {
    test('should update password for an existing user', async () => {
        const hashedPassword = await bcrypt.hash('Password@123', 10);
        const user = await User.create({
            personalDetails: {
                email: 'test@example.com',
                password: hashedPassword,
            },
            isDeleted: false,
        });

        const res = await request(app)
            .post('/forgotpassword')
            .send({
                email: 'test@example.com',
                newPassword: 'NewPassword@123',
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Password updated successfully.');
    });
    test('should return 404 if user does not exist', async () => {
        const res = await request(app)
            .post('/forgotpassword')
            .send({
                email: 'notfound@example.com',
                newPassword: 'newpassword',
            });

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe('User not found');
    });
});

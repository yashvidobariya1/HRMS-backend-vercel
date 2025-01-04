const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const bcrypt = require('bcrypt');
const Timesheet = require('../models/timeSheet');
const geolib = require('geolib')

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
        expect(JSON.parse(res.text).message).toBe('User login successfully');
    });
    test('should return 404 for non-existing user', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                email: 'notfound@example.com',
                password: 'Password@123',
            });
        // console.log('res/...', res)
        expect(JSON.parse(res.text).status).toBe(404);
        expect(JSON.parse(res.text).message).toBe('User not found');
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

        expect(JSON.parse(res.text).status).toBe(404);
        expect(JSON.parse(res.text).message).toBe('Password does not match');
    });
});

describe('Forgot Password process API', () => {
    describe('Email verification', () => {
        test('should return 400 for invalid email', async () => {
            const res = await request(app)
            .post('/emailverification')
            .send({
                email: '',
            });
            expect(JSON.parse(res.text).status).toBe(400);
            expect(JSON.parse(res.text).message).toBe('Please enter valid email address.');
        })
        test('should return 404 for non-existing user', async () => {
            const res = await request(app)
            .post('/emailverification')
            .send({
                email: 'notfound@example.com',
            });
            expect(JSON.parse(res.text).status).toBe(404);
            expect(JSON.parse(res.text).message).toBe('User not found.');
        })
        test('should return 200 for otp send successfully via email', async () => {
            const hashedPassword = await bcrypt.hash('Password@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test@example.com',
                    password: hashedPassword,
                },
                isDeleted: false,
            });
            const res = await request(app)
                .post('/emailverification')
                .send({
                    email: 'test@example.com',
                });
            expect(JSON.parse(res.text).status).toBe(200);
            console.log('OTP sent to your email successfully.');
        })
    })
    describe('OTP Verification', () => {
        test('should return 400 for invalid otp', async () => {
            const hashedPassword = await bcrypt.hash('Password@123', 10)
            await User.create({
                personalDetails: {
                    email: 'test@example.com',
                    password: hashedPassword,
                    otp: '987654'
                },
                isDeleted: false,
            });
            const res = await request(app)
            .post('/otpverification')
            .send({
                email: 'test@example.com',
                otp: '123456',
            });
            // console.log('res for invalid otp/...', JSON.parse(res.text))
            expect(JSON.parse(res.text).status).toBe(409);
            expect(JSON.parse(res.text).message).toBe('Invalid OTP.');
        })
        test('should return 404 for non-existing user', async () => {
            const res = await request(app)
                .post('/otpverification')
                .send({
                    otp: '123456',
                });
            expect(JSON.parse(res.text).status).toBe(404);
            expect(JSON.parse(res.text).message).toBe('User not found.');
        })
        test('should return 200 for otp verification successfully', async () => {
            const hashedPassword = await bcrypt.hash('Password@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test@example.com',
                    password: hashedPassword
                },
                isDeleted: false,
            });
            const res = await request(app)
                .post('/emailverification')
                .send({
                    email: 'test@example.com'
                });
            const otp = JSON.parse(res.text).message;
            const res2 = await request(app)
                .post('/otpverification')
                .send({
                    email: 'test@example.com',
                    otp: otp,
                });
                // console.log('body/..', res)
            // console.log('res for otp verification/....', JSON.parse(res2.text))
            expect(JSON.parse(res2.text).status).toBe(200);
            expect(JSON.parse(res2.text).message).toBe('OTP verified successfully.');
        })
    })
    describe('forgot Password', () => {
        test('should return 404 for non-existing user', async () => {
            const res = await request(app)
                .post('/forgotpassword')
                .send({
                    email: 'tets@example.com',
                });
            expect(JSON.parse(res.text).status).toBe(404);
            expect(JSON.parse(res.text).message).toBe('User not found');
        })
        test('should return 400 for password criteria', async () => {
            const res = await request(app)
            .post('/forgotpassword')
            .send({
                email: 'test@example.com',
                newPassword: 'abcdefghijklmnopqrstuvwxyz'
            });
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long.')
        })
        test('should return 400 for do not match with confirm password', async () => {
            const res = await request(app)
            .post('/forgotpassword')
            .send({
                email: 'test@example.com',
                newPassword: 'Abcd@123',
                confirmPassword: 'Abcd@1234'
            });
            expect(JSON.parse(res.text).status).toBe(400);
            expect(JSON.parse(res.text).message).toBe('New password and confirm password do not match.');
        })
        test('should return 200 for forgot password', async () => {
            const res = await request(app)
            .post('/forgotpassword')
            .send({
                email: 'test@example.com',
                newPassword: 'Abcd@123',
                confirmPassword: 'Abcd@123'
            });
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('Password updated successfully.');
        })
    })
});

describe('update password API', () => {
    let userId
    test('should return 404 for non-existing user', async () => {
        const res = await request(app)
        .post('/updatepassword')
        .send({
            email: 'tets@example.com',
        });
        expect(JSON.parse(res.text).status).toBe(404);
        expect(JSON.parse(res.text).message).toBe('User not found.');
    })
    test('should return 400 for old password is incorrect', async () => {
        const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
        const user = await User.create({
            personalDetails: {
                email: 'abcd@example.com',
                password: hashedPassword
            }
        })
        userId = await (user._id).toString()
        const res1 = await request(app)
        .post('/updatepassword')
        .send({
            userId,
            oldPassword: 'Abcd@123',
            newPassword: 'Xyz@1234',
            confirmPassword: 'Xyz@1234'
        });
        // console.log('res', res1.text)
        expect(JSON.parse(res1.text).status).toBe(400);
        expect(JSON.parse(res1.text).message).toBe('Old password is incorrect.');
    })
    test('should return 400 for password criteria', async () => {
        const res = await request(app)
        .post('/updatepassword')
        .send({
            userId,
            oldPassword: 'Abcd@1234',
            newPassword: 'xyz@1234',
            confirmPassword: 'Xyz@1234'
        });
        expect(JSON.parse(res.text).status).toBe(401);
        expect(JSON.parse(res.text).message).toBe('Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long.')
    })
    test('should return 400 for do not match with confirm password', async () => {
        const res = await request(app)
        .post('/updatepassword')
        .send({
            userId,
            oldPassword: 'Abcd@1234',
            newPassword: 'Xyz@1234',
            confirmPassword: 'Xyz@123'
        });
        expect(JSON.parse(res.text).status).toBe(400);
        expect(JSON.parse(res.text).message).toBe('New password and confirm password do not match.');
    })
    test('should return 200 for update password', async () => {
        const res = await request(app)
        .post('/updatepassword')
        .send({
            userId,
            oldPassword: 'Abcd@1234',
            newPassword: 'Xyz@1234',
            confirmPassword: 'Xyz@1234'
        });
        expect(JSON.parse(res.text).status).toBe(200);
        expect(JSON.parse(res.text).message).toBe('Password updated successfully.');
    })
})

describe('Get all Users', () => {
    test('should return 200 for getted all users', async () => {
        const res = await request(app).get('/getallusers').set('x-api-key', 'Manager' || 'Administrator' || 'Superadmin')
        expect(JSON.parse(res.text).status).toBe(200);
        expect(JSON.parse(res.text).message).toBe('Users get successfully.');
    })
})

describe('ClockIn or ClockOut for employees and managers', () => {
    describe('ClockIn', () => {
        let userId
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
            const user = await User.create({
                personalDetails: {
                    email: 'abcd@example.com',
                    password: hashedPassword
                }
            })
            userId = await (user._id).toString()
            const res = await request(app)
            .post('/clockin')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 401 for Forbidden: Access denied', async () => {
            const res = await request(app)
            .post('/clockin').set('x-api-key', 'Superadmin' || 'administrator')
            expect(JSON.parse(res.text).status).toBe(403);
            expect(JSON.parse(res.text).message).toBe('Forbidden: Access denied');
        })
        test('should return 404 for non-existing user', async () => {
            const res = await request(app)
            .post('/clockin').set('x-api-key', 'Employee' || 'Manager')
            console.log('res/...', res.text)
            expect(JSON.parse(res.text).status).toBe(404);
            expect(JSON.parse(res.text).message).toBe('User not found');
        })
        test("should return 400 for, do't allow location",async () => {            
            const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
            const user = await User.create({
                personalDetails: {
                    email: 'abcd@example.com',
                    password: hashedPassword
                }
            })
            userId = await (user._id).toString()
            const res = await request(app)
            .post('/clockin')
            .send({ userId })
            .set('x-api-key', 'Employee' || 'Manager')
            // console.log('res.text/....', res)
            expect(JSON.parse(res.text).status).toBe(400);
            expect(JSON.parse(res.text).message).toBe('Something went wrong, Please try again!');
        })
        test('should return 403 for outside the geofenc area', async () => {
            const res = await request(app)
            .post('/clockin')
            .send({ userId, location: { latitude: "72.8302", longitude: "21.1959" } })
            .set('x-api-key', 'Employee' || 'Manager')
            // console.log('res.text/....', res)
            expect(JSON.parse(res.text).status).toBe(403);
            expect(JSON.parse(res.text).message).toBe('You are outside the geofence area.');
        })
        // test('should return 200 for clock-In', async () => {
        //     const res = await request(app)
        //     .post('/clockin')
        //     .send({ userId, location: { latitude: "21.1959", longitude: "72.8302" } })
        //     .set('x-api-key', 'Employee' || 'Manager')
        //     console.log('res.text/....====>>>>>>>>', res.text)
        //     expect(JSON.parse(res.text).status).toBe(200);
        // })
        // test('should return 400 for clockIn before clockOut', async () => {
        //     Timesheet.create({
        //         userId,
        //         date: 'YYYY-MM-DD',
        //         clockingTime: []
        //     })
        //     const res = await request(app)
        //     .post('/clockin')
        //     .send({ userId, location: { latitude: 21.1959, longitude: 72.8302 } })
        //     .set('x-api-key', 'Employee' || 'Manager')
        //     console.log('res.text/....====>>>>>>>>', res.text)            
        //     expect(JSON.parse(res.text).status).toBe(400);
        //     expect(JSON.parse(res.text).message).toBe('Please clock out before clocking in again.')
        // })
    })
    describe('ClockOut', () => {
        let userId
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
            const user = await User.create({
                personalDetails: {
                    email: 'abcd@example.com',
                    password: hashedPassword
                }
            })
            userId = await (user._id).toString()
            const res = await request(app)
            .post('/clockout')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 401 for Forbidden: Access denied', async () => {
            const res = await request(app)
            .post('/clockout').set('x-api-key', 'Superadmin' || 'administrator')
            expect(JSON.parse(res.text).status).toBe(403);
            expect(JSON.parse(res.text).message).toBe('Forbidden: Access denied');
        })
        test('should return 404 for non-existing user', async () => {
            const res = await request(app)
            .post('/clockout').set('x-api-key', 'Employee' || 'Manager')
            console.log('res/...', res.text)
            expect(JSON.parse(res.text).status).toBe(404);
            expect(JSON.parse(res.text).message).toBe('User not found');
        })
        test("should return 400 for, do't allow location",async () => {            
            const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
            const user = await User.create({
                personalDetails: {
                    email: 'abcd@example.com',
                    password: hashedPassword
                }
            })
            userId = await (user._id).toString()
            const res = await request(app)
            .post('/clockout')
            .send({ userId })
            .set('x-api-key', 'Employee' || 'Manager')
            // console.log('res.text/....', res)
            expect(JSON.parse(res.text).status).toBe(400);
            expect(JSON.parse(res.text).message).toBe('Something went wrong, Please try again!');
        })
        test('should return 404 for time sheet not found', async () => {
            
            const res = await request(app)
            .post('/clockout')
            .send({ userId, location: { latitude: "72.8302", longitude: "21.1959" } })
            .set('x-api-key', 'Employee' || 'Manager')
            // console.log('res.text/....', res)
            expect(JSON.parse(res.text).status).toBe(404);
            expect(JSON.parse(res.text).message).toBe('No timesheet found for today.');
        })
        // test('should return 403 for outside the geofenc area', async () => {
        //     const res = await request(app)
        //     .post('/clockout')
        //     .send({ userId, location: { latitude: "72.8302", longitude: "21.1959" } })
        //     .set('x-api-key', 'Employee' || 'Manager')
        //     console.log('res.text/....', res)
        //     expect(JSON.parse(res.text).status).toBe(403);
        //     expect(JSON.parse(res.text).message).toBe('You are outside the geofence area.');
        // })
    })
})

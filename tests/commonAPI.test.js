const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const bcrypt = require('bcrypt');
const Timesheet = require('../models/timeSheet');
const Notification = require('../models/notification')

const { MongoMemoryServer } = require('mongodb-memory-server');
const Company = require('../models/company');
const Location = require('../models/location');
const leaveRequest = require('../models/leaveRequest');
const moment = require('moment');
const Contract = require('../models/contract');
const Template = require('../models/template');
const Task = require('../models/task');

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

describe('Login API==================================================', () => {
    let usertoken;
    test('should return 200 for log in a user with valid credentials', async () => {
        const hashedPassword = await bcrypt.hash('Password@123', 10);
        await User.create({
            personalDetails: {
                email: 'test@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
            role: 'Superadmin'  //Superadmin, Administrator, Manager
        });

        const res = await request(app)
            .post('/login')
            .send({
                email: 'test@example.com',
                password: 'Password@123',
            });

        expect(JSON.parse(res.text).status).toBe(200);
        expect(JSON.parse(res.text).message).toBe('User login successfully');
        expect(JSON.parse(res.text).user).toHaveProperty('token');
        usertoken = JSON.parse(res.text).user.token;
    });
    test('should return 400 for email and password required', async () => {
        const res = await request(app).post('/login').send({});
        expect(JSON.parse(res.text).status).toBe(400);
        expect(JSON.parse(res.text).message).toBe('Email and password are required');
    });
    test('should return 404 for non-existing user', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                email: 'notfound@example.com',
                password: 'Password@123',
            });

        expect(JSON.parse(res.text).status).toBe(404);
        expect(JSON.parse(res.text).message).toBe('User not found');
    });
    test('should return 401 for incorrect password', async () => {
        const hashedPassword = await bcrypt.hash('Password@123', 10);
        await User.create({
            personalDetails: {
                email: 'test@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
        });

        const res = await request(app)
            .post('/login')
            .send({
                email: 'test@example.com',
                password: 'wrongpassword',
            });
        expect(JSON.parse(res.text).status).toBe(401);
        expect(JSON.parse(res.text).message).toBe('Invalid credential');
    });
});

describe('Logout API==================================================', () => {
    test('Should return 404 for user not found', async () => {
        const hashedPassword = await bcrypt.hash('Password@123', 10);
        await User.create({
            personalDetails: {
                email: 'test@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
            role: 'Superadmin'
        });

        const res = await request(app).post('/login').send({ email: 'test@example.com', password: 'Password@123' })
        expect(JSON.parse(res.text).status).toBe(200)
        expect(JSON.parse(res.text).message).toBe('User login successfully')
        expect(JSON.parse(res.text).user).toHaveProperty('token')
        const usertoken = JSON.parse(res.text).user.token
        const res2 = await request(app).post('/logOut').set('Authorization', `Bearer ${usertoken}cx`)
        expect(JSON.parse(res2.text).status).toBe(404)
        expect(JSON.parse(res2.text).message).toBe('User not found')
    })
    test('Should return 200 for logout successfully', async () => {
        const hashedPassword = await bcrypt.hash('Password@123', 10);
        await User.create({
            personalDetails: {
                email: 'testforlogout@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
            role: 'Superadmin'
        });

        const res = await request(app).post('/login').send({ email: 'testforlogout@example.com', password: 'Password@123' })
        expect(JSON.parse(res.text).status).toBe(200)
        expect(JSON.parse(res.text).message).toBe('User login successfully')
        expect(JSON.parse(res.text).user).toHaveProperty('token')
        const res2 = await request(app).post(`/logOut?userId=${JSON.parse(res.text).user._id}`)
        expect(JSON.parse(res2.text).status).toBe(200)
        expect(JSON.parse(res2.text).message).toBe('Logging out successfully.')
    })
})

describe('Update password API==================================================', () => {
    let userId
    test('should return 404 for non-existing user', async () => {
        const res = await request(app)
            .post('/updatePassword')
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
            },
            password: hashedPassword
        })
        userId = await (user._id).toString()
        const res1 = await request(app)
            .post('/updatePassword')
            .send({
                userId,
                oldPassword: 'Abcd@123',
                newPassword: 'Xyz@1234',
                confirmPassword: 'Xyz@1234'
            });
        expect(JSON.parse(res1.text).status).toBe(400);
        expect(JSON.parse(res1.text).message).toBe('Old password is incorrect.');
    })
    test('should return 400 for password criteria', async () => {
        const res = await request(app)
            .post('/updatePassword')
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
            .post('/updatePassword')
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
            .post('/updatePassword')
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

describe('Forgot Password process API==================================================', () => {
    describe('Email verification', () => {
        test('should return 400 for invalid email', async () => {
            const res = await request(app)
                .post('/emailVerification')
                .send({
                    email: '',
                });
            expect(JSON.parse(res.text).status).toBe(400);
            expect(JSON.parse(res.text).message).toBe('Please enter valid email address.');
        })
        test('should return 404 for non-existing user', async () => {
            const res = await request(app)
                .post('/emailVerification')
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
                },
                password: hashedPassword,
                isDeleted: false,
            });
            const res = await request(app)
                .post('/emailVerification')
                .send({
                    email: 'test@example.com',
                });
            expect(JSON.parse(res.text).status).toBe(200);
        })
    })
    describe('OTP Verification', () => {
        test('should return 400 for invalid otp', async () => {
            const hashedPassword = await bcrypt.hash('Password@123', 10)
            await User.create({
                personalDetails: {
                    email: 'test@example.com',
                },
                password: hashedPassword,
                otp: '987654',
                isDeleted: false,
                isEmailVerified: true,
                isOTPVerified: true,
            });
            const res = await request(app)
                .post('/otpVerification')
                .send({
                    email: 'test@example.com',
                    otp: '123456',
                });
            expect(JSON.parse(res.text).status).toBe(409);
            expect(JSON.parse(res.text).message).toBe('Invalid OTP.');
        })
        test('should return 404 for non-existing user', async () => {
            const res = await request(app)
                .post('/otpVerification')
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
                },
                password: hashedPassword,
                isDeleted: false,
            });
            const res = await request(app)
                .post('/emailVerification')
                .send({
                    email: 'test@example.com'
                });
            const otp = JSON.parse(res.text).otp;
            const res2 = await request(app)
                .post('/otpVerification')
                .send({
                    email: 'test@example.com',
                    otp: otp,
                });
            expect(JSON.parse(res2.text).status).toBe(200);
            expect(JSON.parse(res2.text).message).toBe('OTP verified successfully.');
        })
    })
    describe('forgot Password', () => {
        test('should return 404 for non-existing user', async () => {
            const res = await request(app)
                .post('/forgotPassword')
                .send({
                    email: 'tets@example.com',
                });
            expect(JSON.parse(res.text).status).toBe(404);
            expect(JSON.parse(res.text).message).toBe('User not found');
        })
        test('should return 400 for password criteria', async () => {
            const res = await request(app)
                .post('/forgotPassword')
                .send({
                    email: 'test@example.com',
                    newPassword: 'abcdefghijklmnopqrstuvwxyz'
                });
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long.')
        })
        test('should return 400 for do not match with confirm password', async () => {
            const res = await request(app)
                .post('/forgotPassword')
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
                .post('/forgotPassword')
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

describe('dashboard==================================================', () => {
    let token
    test('should return 401 for Unauthorized: Invalid API key', async () => {
        await User.create({
            personalDetails: {
                email: 'testfordashboard@example.com',
            },
            jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
            role: 'Superadmin',
            password: 'Superadmin@123',
        });

        const login = await request(app)
            .post('/login')
            .send({
                email: 'testfordashboard@example.com',
                password: 'Superadmin@123',
            });
        expect(JSON.parse(login.text).status).toBe(200);
        expect(JSON.parse(login.text).message).toBe('User login successfully');
        expect(JSON.parse(login.text).user).toHaveProperty('token');
        token = await JSON.parse(login.text).user.token
        const res = await request(app)
            .post('/dashboard')
        expect(JSON.parse(res.text).status).toBe(401);
        expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
    })
    test('should return 200 for fetched dashboard data', async () => {
        const res = await request(app).post('/dashboard').set('Authorization', `Bearer ${token}`)
        expect(JSON.parse(res.text).status).toBe(200)
    })
    test('should return 403 for Access denied', async () => {
        const hashedPassword = await bcrypt.hash('Test@123', 10);
        await User.create({
            personalDetails: {
                email: 'test123@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
            role: 'nonExistRole'
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
        const res1 = await request(app).post('/dashboard').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
        expect(JSON.parse(res1.text).status).toBe(403);
        expect(JSON.parse(res1.text).message).toBe('Access denied');
    })
})

describe('get user job titles==================================================', () => {
    describe('~ Superadmin', () => {    
        let superadminToken
        let employeeToken
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'Superadmin@example.com',
                },
                jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
                role: 'Superadmin',
                password: 'Superadmin@123',
            });

            const login = await request(app)
                .post('/login')
                .send({
                    email: 'Superadmin@example.com',
                    password: 'Superadmin@123',
                });
            expect(JSON.parse(login.text).status).toBe(200);
            expect(JSON.parse(login.text).message).toBe('User login successfully');
            expect(JSON.parse(login.text).user).toHaveProperty('token');
            superadminToken = await JSON.parse(login.text).user.token
            const res = await request(app)
                .get('/getUserJobTitles')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('Should return 404 User not found', async () => {
            const res = await request(app).get('/getUserJobTitles?EmployeeId=67ad71c3d84d2f6c8bfb14ff').set("Authorization", `Bearer ${superadminToken}`)
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        test('Should return 200 for job title get successfully', async () => {
            await User.create({
                personalDetails: {
                    email: 'testing@example.com',
                },
                jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
                role: 'Employee',
                password: 'Password@123',
            });

            const login = await request(app)
                .post('/login')
                .send({
                    email: 'testing@example.com',
                    password: 'Password@123',
                });
            employeeToken = await JSON.parse(login.text).user.token
            const res = await request(app)
            .get('/getUserJobTitles')
            .set("Authorization", `Bearer ${employeeToken}`)
            // console.log('res:', res)
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User job titles get successfully.')
        })
        test('should return 403 for Access denied', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
                isDeleted: false,
                role: 'Employees'
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
            const res1 = await request(app).get('/getUserJobTitles').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ Administrator', () => {    
        let administratorToken
        let employeeToken
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'Administrator@example.com',
                },
                jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
                role: 'Administrator',
                password: 'Administrator@123',
            });

            const login = await request(app)
                .post('/login')
                .send({
                    email: 'Administrator@example.com',
                    password: 'Administrator@123',
                });
            expect(JSON.parse(login.text).status).toBe(200);
            expect(JSON.parse(login.text).message).toBe('User login successfully');
            expect(JSON.parse(login.text).user).toHaveProperty('token');
            administratorToken = await JSON.parse(login.text).user.token
            const res = await request(app)
                .get('/getUserJobTitles')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('Should return 404 User not found', async () => {
            const res = await request(app).get('/getUserJobTitles?EmployeeId=67ad71c3d84d2f6c8bfb14ff').set("Authorization", `Bearer ${administratorToken}`)
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        test('Should return 200 for job title get successfully', async () => {
            await User.create({
                personalDetails: {
                    email: 'testing@example.com',
                },
                jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
                role: 'Employee',
                password: 'Password@123',
            });

            const login = await request(app)
                .post('/login')
                .send({
                    email: 'testing@example.com',
                    password: 'Password@123',
                });
            employeeToken = await JSON.parse(login.text).user.token
            const res = await request(app)
            .get('/getUserJobTitles')
            .set("Authorization", `Bearer ${employeeToken}`)
            // console.log('res:', res)
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User job titles get successfully.')
        })
        test('should return 403 for Access denied', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
                isDeleted: false,
                role: 'Managers'
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
            const res1 = await request(app).get('/getUserJobTitles').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ Manager', () => {    
        let managerToken
        let employeeToken
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'Manager@example.com',
                },
                jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
                role: 'Manager',
                password: 'Manager@123',
            });

            const login = await request(app)
                .post('/login')
                .send({
                    email: 'Manager@example.com',
                    password: 'Manager@123',
                });
            expect(JSON.parse(login.text).status).toBe(200);
            expect(JSON.parse(login.text).message).toBe('User login successfully');
            expect(JSON.parse(login.text).user).toHaveProperty('token');
            managerToken = await JSON.parse(login.text).user.token
            const res = await request(app)
                .get('/getUserJobTitles')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('Should return 404 User not found', async () => {
            const res = await request(app).get('/getUserJobTitles?EmployeeId=67ad71c3d84d2f6c8bfb14ff').set("Authorization", `Bearer ${managerToken}`)
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        test('Should return 200 for job title get successfully', async () => {
            await User.create({
                personalDetails: {
                    email: 'testing@example.com',
                },
                jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
                role: 'Employee',
                password: 'Password@123',
            });

            const login = await request(app)
                .post('/login')
                .send({
                    email: 'testing@example.com',
                    password: 'Password@123',
                });
            employeeToken = await JSON.parse(login.text).user.token
            const res = await request(app)
            .get('/getUserJobTitles')
            .set("Authorization", `Bearer ${employeeToken}`)
            // console.log('res:', res)
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User job titles get successfully.')
        })
        test('should return 403 for Access denied', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
                isDeleted: false,
                role: 'Employees'
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
            const res1 = await request(app).get('/getUserJobTitles').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe('~ Employee', () => {    
        let employeeToken
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'Employee@example.com',
                },
                jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
                role: 'Employee',
                password: 'Employee@123',
            });

            const login = await request(app)
                .post('/login')
                .send({
                    email: 'Employee@example.com',
                    password: 'Employee@123',
                });
            expect(JSON.parse(login.text).status).toBe(200);
            expect(JSON.parse(login.text).message).toBe('User login successfully');
            expect(JSON.parse(login.text).user).toHaveProperty('token');
            employeeToken = await JSON.parse(login.text).user.token
            const res = await request(app)
                .get('/getUserJobTitles')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('Should return 404 User not found', async () => {
            const res = await request(app).get('/getUserJobTitles?EmployeeId=67ad71c3d84d2f6c8bfb14ff').set("Authorization", `Bearer ${employeeToken}`)
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        test('Should return 200 for job title get successfully', async () => {
            await User.create({
                personalDetails: {
                    email: 'testing@example.com',
                },
                jobDetails: [{ jobTitle: 'jobTitle 1' }, { jobTitle: 'jobTitle 2' }],
                role: 'Employee',
                password: 'Password@123',
            });

            const login = await request(app)
                .post('/login')
                .send({
                    email: 'testing@example.com',
                    password: 'Password@123',
                });
            const res = await request(app)
            .get('/getUserJobTitles')
            .set("Authorization", `Bearer ${JSON.parse(login.text).user.token}`)
            // console.log('res:', res)
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('User job titles get successfully.')
        })
        test('should return 403 for Access denied', async () => {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            await User.create({
                personalDetails: {
                    email: 'test123@example.com',
                },
                password: hashedPassword,
                isDeleted: false,
                role: 'Employees'
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
            const res1 = await request(app).get('/getUserJobTitles').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })
})

describe('User CRUD==================================================', () => {
    describe('Superadmin', () => {
        let createdSAToken
        let createdSAID
        let createdEmployeeId
        let location
        let contract
        describe('~ add user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                await User.create({
                    personalDetails: {
                        email: 'Superadmin@example.com',
                    },
                    password: 'Superadmin@123',
                    isDeleted: false,
                    role: 'Superadmin'
                });
                const userRes = await request(app)
                    .post('/login')
                    .send({
                        email: 'Superadmin@example.com',
                        password: 'Superadmin@123',
                    });
    
                expect(JSON.parse(userRes.text).status).toBe(200);
                expect(JSON.parse(userRes.text).message).toBe('User login successfully');
                expect(JSON.parse(userRes.text).user).toHaveProperty('token');
                createdSAToken = JSON.parse(userRes.text).user.token
                createdSAID = JSON.parse(userRes.text).user._id
                const res = await request(app)
                    .post('/addUser')
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for add a employee', async () => {
                const company = await Company.create({
                    companyDetails: {
                        businessName: 'addTestCompanyForSuperadmin'
                    }
                })
                location = await Location.create({
                    locationName: 'addTestLocationForSuperadmin',
                    companyId: company._id
                })
                contract = await Contract.create({
                    contractName: 'addTestContractForSuperadmin',
                    companyId: company._id,
                    contract: 'https://res.cloudinary.com/dwerzoswa/raw/upload/v1740383012/contracts/mqamzy1q82nd5getw8mm',
                    contractFileName: 'addTestContractForSuperadmin'
                })
                const res = await request(app).post('/addUser').set('Authorization', `Bearer ${createdSAToken}`).send({
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
                    "jobDetails": [{
                        "jobTitle": "Marketing Specialist",
                        "jobDescription": "Handles marketing strategies and campaigns.",
                        "annualSalary": 50000,
                        "hourlyRate": 25,
                        "weeklyWorkingHours": "40",
                        "joiningDate": "2024-01-15",
                        "location": location._id,
                        "assignManager": createdSAID,
                        "role": "Employee"
                    }],
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
                            "document": "data:application/pdf;base64,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CmVuZG9iagoKOSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UcnVlVHlwZS9CYXNlRm9udC9CQUFBQUErQXJpYWwtQm9sZE1UCi9GaXJzdENoYXIgMAovTGFzdENoYXIgMTEKL1dpZHRoc1s3NTAgNzIyIDYxMCA4ODkgNTU2IDI3NyA2NjYgNjEwIDMzMyAyNzcgMjc3IDU1NiBdCi9Gb250RGVzY3JpcHRvciA3IDAgUgovVG9Vbmljb2RlIDggMCBSCj4+CmVuZG9iagoKMTAgMCBvYmoKPDwKL0YxIDkgMCBSCj4+CmVuZG9iagoKMTEgMCBvYmoKPDwvRm9udCAxMCAwIFIKL1Byb2NTZXRbL1BERi9UZXh0XT4+CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDQgMCBSL1Jlc291cmNlcyAxMSAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL0dyb3VwPDwvUy9UcmFuc3BhcmVuY3kvQ1MvRGV2aWNlUkdCL0kgdHJ1ZT4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCgoxMiAwIG9iago8PC9Db3VudCAxL0ZpcnN0IDEzIDAgUi9MYXN0IDEzIDAgUgo+PgplbmRvYmoKCjEzIDAgb2JqCjw8L1RpdGxlPEZFRkYwMDQ0MDA3NTAwNkQwMDZEMDA3OTAwMjAwMDUwMDA0NDAwNDYwMDIwMDA2NjAwNjkwMDZDMDA2NT4KL0Rlc3RbMSAwIFIvWFlaIDU2LjcgNzczLjMgMF0vUGFyZW50IDEyIDAgUj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2VzCi9SZXNvdXJjZXMgMTEgMCBSCi9NZWRpYUJveFsgMCAwIDU5NSA4NDIgXQovS2lkc1sgMSAwIFIgXQovQ291bnQgMT4+CmVuZG9iagoKMTQgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSCi9PdXRsaW5lcyAxMiAwIFIKPj4KZW5kb2JqCgoxNSAwIG9iago8PC9BdXRob3I8RkVGRjAwNDUwMDc2MDA2MTAwNkUwMDY3MDA2NTAwNkMwMDZGMDA3MzAwMjAwMDU2MDA2QzAwNjEwMDYzMDA2ODAwNkYwMDY3MDA2OTAwNjEwMDZFMDA2RTAwNjkwMDczPgovQ3JlYXRvcjxGRUZGMDA1NzAwNzIwMDY5MDA3NDAwNjUwMDcyPgovUHJvZHVjZXI8RkVGRjAwNEYwMDcwMDA2NTAwNkUwMDRGMDA2NjAwNjYwMDY5MDA2MzAwNjUwMDJFMDA2RjAwNzIwMDY3MDAyMDAwMzIwMDJFMDAzMT4KL0NyZWF0aW9uRGF0ZShEOjIwMDcwMjIzMTc1NjM3KzAyJzAwJyk+PgplbmRvYmoKCnhyZWYKMCAxNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMTE5OTcgMDAwMDAgbiAKMDAwMDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMjI0IDAwMDAwIG4gCjAwMDAwMTIzMzAgMDAwMDAgbiAKMDAwMDAwMDI0NCAwMDAwMCBuIAowMDAwMDExMTU0IDAwMDAwIG4gCjAwMDAwMTExNzYgMDAwMDAgbiAKMDAwMDAxMTM2OCAwMDAwMCBuIAowMDAwMDExNzA5IDAwMDAwIG4gCjAwMDAwMTE5MTAgMDAwMDAgbiAKMDAwMDAxMTk0MyAwMDAwMCBuIAowMDAwMDEyMTQwIDAwMDAwIG4gCjAwMDAwMTIxOTYgMDAwMDAgbiAKMDAwMDAxMjQyOSAwMDAwMCBuIAowMDAwMDEyNDk0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSAxNi9Sb290IDE0IDAgUgovSW5mbyAxNSAwIFIKL0lEIFsgPEY3RDc3QjNEMjJCOUY5MjgyOUQ0OUZGNUQ3OEI4RjI4Pgo8RjdENzdCM0QyMkI5RjkyODI5RDQ5RkY1RDc4QjhGMjg+IF0KPj4Kc3RhcnR4cmVmCjEyNzg3CiUlRU9GCg=="
                        },
                    ],
                    "contractDetails": {
                        "contractType": contract._id.toString()
                    }
                })
                // console.log('res:', res)
                expect(res.body.status).toBe(200);
                expect(res.body.message).toBe('Employee created successfully.');
                createdEmployeeId = await (JSON.parse(res.text)).user._id
            }, 25000)
            test('should return 409 for email already exist', async () => {
                const res = await request(app).post('/addUser').set('Authorization', `Bearer ${createdSAToken}`).send({
                    "personalDetails": {
                        "firstName": "add employee for testing",
                        "middleName": "add employee for testing",
                        "lastName": "add employee for testing",
                        "phone": "1234567890",
                        "email": "jane.doe@example.com",
                    },
                    "jobDetails": [{
                        "jobTitle": "Marketing Specialist",
                        "jobDescription": "Handles marketing strategies and campaigns.",
                        "annualSalary": 50000,
                        "hourlyRate": 25,
                        "weeklyWorkingHours": "40",
                        "joiningDate": "2024-01-15",
                        "location": location._id,
                        "assignManager": createdSAID,
                        "role": "Employee"
                    }],
                    "contractDetails": {
                        "contractType": contract?._id.toString()
                    }
                })
                // console.log('res:', res.text)
                expect(JSON.parse(res.text).status).toBe(409);
                expect(JSON.parse(res.text).message).toBe('Email already exists.');
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
                const res1 = await request(app).post('/addUser').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`).send({
                    "personalDetails": {
                        "firstName": "add employee for testing",
                        "middleName": "add employee for testing",
                        "lastName": "add employee for testing",
                        "phone": "1234567890",
                        "email": "rishi12345@example.com",
                    },
                });
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })
        
        describe('~ get user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .get(`/getUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for fetch a employee by ID', async () => {
                const res = await request(app).get(`/getUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdSAToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('User get successfully.');
            });
            test('should return 409 for ID pass null', async () => {
                const res = await request(app).get(`/getUser/null`).set('Authorization', `Bearer ${createdSAToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 409 for user not found', async () => {
                const res = await request(app).get(`/getUser/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${createdSAToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
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
                const res1 = await request(app).get(`/getUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe('~ get all users', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .get('/getAllUsers')
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for fetch all users', async () => {
                const res = await request(app).get('/getAllUsers').set('Authorization', `Bearer ${createdSAToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Users got successfully.');
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
                const res1 = await request(app).get('/getAllUsers').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe('~ update user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .post(`/updateUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for update user details', async () => {
                const res = await request(app).post(`/updateUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdSAToken}`).send({
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
                    "role": "Employee",
                    "contractDetails": {
                        "contractType": contract?._id.toString()
                    }
                })
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Employee details updated successfully.');
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post(`/updateUser/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${createdSAToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 409 for email already in use', async () => {
                await User.create({
                    personalDetails: {
                        firstName: "Existing",
                        lastName: "User",
                        email: "existing@example.com"
                    },
                    isDeleted: false
                });
                const res = await request(app)
                    .post(`/updateUser/${createdEmployeeId}`)
                    .set('Authorization', `Bearer ${createdSAToken}`)
                    .send({
                        personalDetails: {
                            email: "existing@example.com",
                        }
                    });
    
                expect(JSON.parse(res.text).status).toBe(409);
                expect(JSON.parse(res.text).message).toBe("Email already exists.");
            });
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
                const res1 = await request(app).post(`/updateUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe('~ delete user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .post(`/deleteUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for delete a user', async () => {
                const res = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdSAToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Employee deleted successfully.');
                const deletedEmployee = await User.findById(createdEmployeeId);
                expect(deletedEmployee.isDeleted).toBe(true);
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdSAToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
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
                const res1 = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })
    })

    describe('Administrator', () => {
        let createdADToken
        let createdADID
        let createdEmployeeId
        let location
        let contract
        describe('~ add user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                await User.create({
                    personalDetails: {
                        email: 'Administrator@example.com',
                    },
                    password: 'Administrator@123',
                    isDeleted: false,
                    role: 'Administrator'
                });
                const userRes = await request(app)
                    .post('/login')
                    .send({
                        email: 'Administrator@example.com',
                        password: 'Administrator@123',
                    });
    
                expect(JSON.parse(userRes.text).status).toBe(200);
                expect(JSON.parse(userRes.text).message).toBe('User login successfully');
                expect(JSON.parse(userRes.text).user).toHaveProperty('token');
                createdADToken = JSON.parse(userRes.text).user.token
                createdADID = JSON.parse(userRes.text).user._id
                const res = await request(app)
                    .post('/addUser')
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for add a employee', async () => {
                const company = await Company.create({
                    companyDetails: {
                        businessName: 'addTestCompanyForAdministrator'
                    }
                })
                location = await Location.create({
                    locationName: 'addTestLocationForAdministrator',
                    companyId: company._id
                })
                contract = await Contract.create({
                    contractName: 'addTestLocationForAdministrator',
                    companyId: company._id,
                    contract: 'https://res.cloudinary.com/dwerzoswa/raw/upload/v1740383012/contracts/mqamzy1q82nd5getw8mm',
                    contractFileName: 'addTestContractForSuperadmin'
                })
                const res = await request(app).post('/addUser').set('Authorization', `Bearer ${createdADToken}`).send({
                    "personalDetails": {
                        "firstName": "add employee for testing",
                        "middleName": "add employee for testing",
                        "lastName": "add employee for testing",
                        "dateOfBirth": "1990-01-01",
                        "gender": "Female",
                        "maritalStatus": "Single",
                        "phone": "1234567890",
                        "homeTelephone": "0987654321",
                        "email": "jane.doe2@example.com",
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
                    "jobDetails": [{
                        "jobTitle": "Marketing Specialist",
                        "jobDescription": "Handles marketing strategies and campaigns.",
                        "annualSalary": 50000,
                        "hourlyRate": 25,
                        "weeklyWorkingHours": "40",
                        "joiningDate": "2024-01-15",
                        "location": location._id,
                        "assignManager": createdADID,
                        "role": "Employee"
                    }],
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
                            "document": "data:application/pdf;base64,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CmVuZG9iagoKOSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UcnVlVHlwZS9CYXNlRm9udC9CQUFBQUErQXJpYWwtQm9sZE1UCi9GaXJzdENoYXIgMAovTGFzdENoYXIgMTEKL1dpZHRoc1s3NTAgNzIyIDYxMCA4ODkgNTU2IDI3NyA2NjYgNjEwIDMzMyAyNzcgMjc3IDU1NiBdCi9Gb250RGVzY3JpcHRvciA3IDAgUgovVG9Vbmljb2RlIDggMCBSCj4+CmVuZG9iagoKMTAgMCBvYmoKPDwKL0YxIDkgMCBSCj4+CmVuZG9iagoKMTEgMCBvYmoKPDwvRm9udCAxMCAwIFIKL1Byb2NTZXRbL1BERi9UZXh0XT4+CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDQgMCBSL1Jlc291cmNlcyAxMSAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL0dyb3VwPDwvUy9UcmFuc3BhcmVuY3kvQ1MvRGV2aWNlUkdCL0kgdHJ1ZT4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCgoxMiAwIG9iago8PC9Db3VudCAxL0ZpcnN0IDEzIDAgUi9MYXN0IDEzIDAgUgo+PgplbmRvYmoKCjEzIDAgb2JqCjw8L1RpdGxlPEZFRkYwMDQ0MDA3NTAwNkQwMDZEMDA3OTAwMjAwMDUwMDA0NDAwNDYwMDIwMDA2NjAwNjkwMDZDMDA2NT4KL0Rlc3RbMSAwIFIvWFlaIDU2LjcgNzczLjMgMF0vUGFyZW50IDEyIDAgUj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2VzCi9SZXNvdXJjZXMgMTEgMCBSCi9NZWRpYUJveFsgMCAwIDU5NSA4NDIgXQovS2lkc1sgMSAwIFIgXQovQ291bnQgMT4+CmVuZG9iagoKMTQgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSCi9PdXRsaW5lcyAxMiAwIFIKPj4KZW5kb2JqCgoxNSAwIG9iago8PC9BdXRob3I8RkVGRjAwNDUwMDc2MDA2MTAwNkUwMDY3MDA2NTAwNkMwMDZGMDA3MzAwMjAwMDU2MDA2QzAwNjEwMDYzMDA2ODAwNkYwMDY3MDA2OTAwNjEwMDZFMDA2RTAwNjkwMDczPgovQ3JlYXRvcjxGRUZGMDA1NzAwNzIwMDY5MDA3NDAwNjUwMDcyPgovUHJvZHVjZXI8RkVGRjAwNEYwMDcwMDA2NTAwNkUwMDRGMDA2NjAwNjYwMDY5MDA2MzAwNjUwMDJFMDA2RjAwNzIwMDY3MDAyMDAwMzIwMDJFMDAzMT4KL0NyZWF0aW9uRGF0ZShEOjIwMDcwMjIzMTc1NjM3KzAyJzAwJyk+PgplbmRvYmoKCnhyZWYKMCAxNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMTE5OTcgMDAwMDAgbiAKMDAwMDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMjI0IDAwMDAwIG4gCjAwMDAwMTIzMzAgMDAwMDAgbiAKMDAwMDAwMDI0NCAwMDAwMCBuIAowMDAwMDExMTU0IDAwMDAwIG4gCjAwMDAwMTExNzYgMDAwMDAgbiAKMDAwMDAxMTM2OCAwMDAwMCBuIAowMDAwMDExNzA5IDAwMDAwIG4gCjAwMDAwMTE5MTAgMDAwMDAgbiAKMDAwMDAxMTk0MyAwMDAwMCBuIAowMDAwMDEyMTQwIDAwMDAwIG4gCjAwMDAwMTIxOTYgMDAwMDAgbiAKMDAwMDAxMjQyOSAwMDAwMCBuIAowMDAwMDEyNDk0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSAxNi9Sb290IDE0IDAgUgovSW5mbyAxNSAwIFIKL0lEIFsgPEY3RDc3QjNEMjJCOUY5MjgyOUQ0OUZGNUQ3OEI4RjI4Pgo8RjdENzdCM0QyMkI5RjkyODI5RDQ5RkY1RDc4QjhGMjg+IF0KPj4Kc3RhcnR4cmVmCjEyNzg3CiUlRU9GCg=="
                        },
                    ],
                    "contractDetails": {
                        "contractType": contract?._id.toString()
                    }
                })
                // console.log('res:', res)
                expect(res.body.status).toBe(200);
                expect(res.body.message).toBe('Employee created successfully.');
                createdEmployeeId = await (JSON.parse(res.text)).user._id
            }, 25000)
            test('should return 409 for email already exist', async () => {
                const res = await request(app).post('/addUser').set('Authorization', `Bearer ${createdADToken}`).send({
                    "personalDetails": {
                        "firstName": "add employee for testing",
                        "middleName": "add employee for testing",
                        "lastName": "add employee for testing",
                        "phone": "1234567890",
                        "email": "jane.doe2@example.com",
                    },
                    "jobDetails": [{
                        "jobTitle": "Marketing Specialist",
                        "jobDescription": "Handles marketing strategies and campaigns.",
                        "annualSalary": 50000,
                        "hourlyRate": 25,
                        "weeklyWorkingHours": "40",
                        "joiningDate": "2024-01-15",
                        "location": location._id,
                        "assignManager": createdADID,
                        "role": "Employee"
                    }],
                    "contractDetails": {
                        "contractType": contract?._id.toString()
                    }
                })
                expect(JSON.parse(res.text).status).toBe(409);
                expect(JSON.parse(res.text).message).toBe('Email already exists.');
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
                const res1 = await request(app).post('/addUser').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`).send({
                    "personalDetails": {
                        "firstName": "add employee for testing",
                        "middleName": "add employee for testing",
                        "lastName": "add employee for testing",
                        "phone": "1234567890",
                        "email": "rishi12345@example.com",
                    },
                });
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })
        
        describe('~ get user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .get(`/getUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for fetch a employee by ID', async () => {
                const res = await request(app).get(`/getUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdADToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('User get successfully.');
            });
            test('should return 409 for ID pass null', async () => {
                const res = await request(app).get(`/getUser/null`).set('Authorization', `Bearer ${createdADToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 409 for user not found', async () => {
                const res = await request(app).get(`/getUser/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${createdADToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
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
                const res1 = await request(app).get(`/getUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe("~ get own company's employees", () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .get('/getAllUsers')
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for fetch all own companys employee', async () => {
                const res = await request(app).get('/getAllUsers').set('Authorization', `Bearer ${createdADToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Users got successfully.');
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
                const res1 = await request(app).get('/getAllUsers').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe('~ update user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .post(`/updateUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for update user details', async () => {
                const res = await request(app).post(`/updateUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdADToken}`).send({
                    "personalDetails": {
                        "firstName": "update first name",
                        "middleName": "update middle name",
                        "lastName": "update last name",
                        "email": "updated@example.com"
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
                    "role": "Employee",
                    "contractDetails": {
                        "contractType": contract?._id.toString()
                    }
                })
                // console.log('res:', res)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Employee details updated successfully.');
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post(`/updateUser/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${createdADToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 409 for email already in use', async () => {
                await User.create({
                    personalDetails: {
                        firstName: "Existing",
                        lastName: "User",
                        email: "existing@example.com"
                    },
                    isDeleted: false
                });
                const res = await request(app)
                    .post(`/updateUser/${createdEmployeeId}`)
                    .set('Authorization', `Bearer ${createdADToken}`)
                    .send({
                        personalDetails: {
                            email: "existing@example.com",
                        }
                    });
                // console.log('res:', res)
                expect(JSON.parse(res.text).status).toBe(409);
                expect(JSON.parse(res.text).message).toBe('Email already exists.');
            });
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
                const res1 = await request(app).post(`/updateUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe('~ delete user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .post(`/deleteUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for delete a user', async () => {
                const res = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdADToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Employee deleted successfully.');
                const deletedEmployee = await User.findById(createdEmployeeId);
                expect(deletedEmployee.isDeleted).toBe(true);
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdADToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
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
                const res1 = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })
    })

    describe('Manager', () => {
        let createdMToken
        let createdMID
        let createdEmployeeId
        let location
        let contract
        describe('~ add user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                await User.create({
                    personalDetails: {
                        email: 'manager@example.com',
                    },
                    password: 'manager@123',
                    isDeleted: false,
                    role: 'Manager'
                });
                const userRes = await request(app)
                    .post('/login')
                    .send({
                        email: 'manager@example.com',
                        password: 'manager@123',
                    });
    
                expect(JSON.parse(userRes.text).status).toBe(200);
                expect(JSON.parse(userRes.text).message).toBe('User login successfully');
                expect(JSON.parse(userRes.text).user).toHaveProperty('token');
                createdMToken = JSON.parse(userRes.text).user.token
                createdMID = JSON.parse(userRes.text).user._id
                const res = await request(app)
                    .post('/addUser')
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for add a employee', async () => {
                const company = await Company.create({
                    companyDetails: {
                        businessName: 'addTestCompanyForManager'
                    }
                })
                location = await Location.create({
                    locationName: 'addTestLocationForManager',
                    companyId: company._id
                })
                contract = await Contract.create({
                    contractName: 'addTestLocationForManager',
                    companyId: company._id,
                    contract: 'https://res.cloudinary.com/dwerzoswa/raw/upload/v1740383012/contracts/mqamzy1q82nd5getw8mm',
                    contractFileName: 'addTestContractForSuperadmin'
                })
                const res = await request(app).post('/addUser').set('Authorization', `Bearer ${createdMToken}`).send({
                    "personalDetails": {
                        "firstName": "add employee for testing",
                        "middleName": "add employee for testing",
                        "lastName": "add employee for testing",
                        "dateOfBirth": "1990-01-01",
                        "gender": "Female",
                        "maritalStatus": "Single",
                        "phone": "1234567890",
                        "homeTelephone": "0987654321",
                        "email": "jane.doe2@example.com",
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
                    "jobDetails": [{
                        "jobTitle": "Marketing Specialist",
                        "jobDescription": "Handles marketing strategies and campaigns.",
                        "annualSalary": 50000,
                        "hourlyRate": 25,
                        "weeklyWorkingHours": "40",
                        "joiningDate": "2024-01-15",
                        "location": location._id,
                        "assignManager": createdMID,
                        "role": "Employee"
                    }],
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
                            "document": "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nD2OywoCMQxF9/mKu3YRk7bptDAIDuh+oOAP+AAXgrOZ37etjmSTe3ISIljpDYGwwrKxRwrKGcsNlx1e31mt5UFTIYucMFiqcrlif1ZobP0do6g48eIPKE+ydk6aM0roJG/RegwcNhDr5tChd+z+miTJnWqoT/3oUabOToVmmvEBy5IoCgplbmRzdHJlYW0KZW5kb2JqCgozIDAgb2JqCjEzNAplbmRvYmoKCjUgMCBvYmoKPDwvTGVuZ3RoIDYgMCBSL0ZpbHRlci9GbGF0ZURlY29kZS9MZW5ndGgxIDIzMTY0Pj4Kc3RyZWFtCnic7Xx5fFvVlf+59z0tdrzIu7xFz1G8Kl7i2HEWE8vxQlI3iRM71A6ksSwrsYptKZYUE9omYStgloZhaSlMMbTsbSPLAZwEGgNlusxQ0mHa0k4Z8muhlJb8ynQoZVpi/b736nkjgWlnfn/8Pp9fpNx3zz33bPecc899T4oVHA55KIEOkUJO96DLvyQxM5WI/omIpbr3BbU/3J61FPBpItOa3f49g1948t/vI4rLIzL8dM/A/t3vn77ZSpT0LlH8e/0eV98jn3k0mSj7bchY2Q/EpdNXm4hyIIOW9g8Gr+gyrq3EeAPGVQM+t+uw5VrQ51yBcc6g6wr/DywvGAHegbE25Br0bFR/ezPGR4kq6/y+QPCnVBYl2ijka/5hjz95S8kmok8kEFl8wDG8xQtjZhRjrqgGo8kcF7+I/r98GY5TnmwPU55aRIhb9PWZNu2Nvi7mRM9/C2flx5r+itA36KeshGk0wf5MWfQ+y2bLaSOp9CdkyxE6S3dSOnXSXSyVllImbaeNTAWNg25m90T3Rd+ii+jv6IHoU+zq6GOY/yL9A70PC/5NZVRHm0G/nTz0lvIGdUe/Qma6nhbRWtrGMslFP8H7j7DhdrqDvs0+F30fWtPpasirp0ZqjD4b/YDK6Gb1sOGVuCfoNjrBjFF31EuLaQmNckf0J9HXqIi66Wv0DdjkYFPqBiqgy+k6+jLLVv4B0J30dZpmCXyn0mQ4CU0b6RIaohEapcfoByyVtRteMbwT/Wz0TTJSGpXAJi+9xWrZJv6gmhBdF/05XUrH6HtYr3hPqZeqDxsunW6I/n30Ocqgp1g8e5o9a6g23Hr2quj90W8hI4toOTyyGXp66Rp6lr5P/05/4AejB2kDdUDzCyyfaawIHv8Jz+YH+AHlZarAanfC2hDdR2FE5DidoGfgm3+l0/QGS2e57BOsl93G/sATeB9/SblHOar8i8rUR+FvOxXCR0F6kJ7Efn6RXmIGyK9i7ewzzMe+xP6eneZh/jb/k2pWr1H/op41FE2fnv5LdHP0j2SlHPokXUkH4duv0QQdpR/Sj+kP9B/0HrOwVayf3c/C7DR7m8fxJXwL9/O7+IP8m8pm5TblWbVWXa9err6o/tzwBcNNJpdp+oOHpm+f/ub0j6JPRX+E3EmC/CJqhUevQlY8SCfpZUj/Gb1KvxT5A/lr2Q72aWgJsBvYHeyb7AX2I/ZbrJLkewlfy5uh1ceH4aer+e38Dmh/Ce9T/Of8Vf47/kfFoCxRVip7lfuVsDKpnFJ+rVrUIrVCXa5uUXeoUUSm2nCxocPwiOFxw3OGd4z1xj6j3/gb09Wma83/dLbs7L9N03T/dHh6ArlrRiZdCU98lR5A3h9FDH4Aj/4QFp+mdxGFHFbAimH3atbK2tgm9il2GfOwq9n17O/Yl9k97AH2LawAa+Am2O7gjbyDu7iHX8uv57fwo3gf59/nP+Gv8DOwPEuxKw5lubJR2aFcqgxhDUHlgHItPHub8pjykvKy8qbyG+UMopalLlZD6pXq3erD6lH1R4ZPGgbxfsBw0jBl+JHhA8MHRm7MMeYZK42fMT5i/KXJaFppajfdaPoX03+Y/SyPlcFybX614NnYg4v5YzxdPcjOAJHPVErGyh2IQwd2xX9QgzKNuCSJediWwbPVNMFpdKph8AfZCaplL9BBI1dQidXTFGG/4KfV5/lF9GPWw7LVh5Uhww94AT2OanSYP81PsPV0lNfzS/i9CrE32CP0BvL9CrqDXc4C9Dg7w9awz7M6dpD+hWcqHexaqo8+wFUWxzaydwgW0FVqH33646sgW02/oLemv6omqp9DfZqkuxDRb9Br7FH6MzNE30Z1U1CNXKgyNyPfryNR9XZinx3EfsxGBRkwvkRHxYliqjOuU6+kd+g/6S3DcWTUelTSN6e96lfVX0XrouXYYdhl9Aj2XT9djB3zBrLkGYzF6DLs9HjUkmrs6nbaQX30eVS926Lh6L3Ra6L7oz76R/D+mS1jf2Zj2BGT4Kin7+H9RfoZuwn78OL/3ikw3UdT9FtmZYWsGvvhjGGf4bDhMcNRw7cNLxqXw9vX0j3I6F8im+OxAjf9iH5Lf2JmxCabllEN7F0F27togHcrz1ATyyE/9mwJ6vh6fSUBSLka3rsX+/kZ7I13UCcuo2/TK4yzLKzIDf1myGmDn3eB+iFE8Bo2AUwfqnYZ/Q7rTmKreBD6nJB0F6rWFGz6Bf0a3o5Ku5ahLjSzSyDrT/Qp6oOGldTOxhGBJ2k1Kmuz8k/w91JmofVsCfs6+HqwQ5Mon1YbfsU4LZveHF3FvcozOGOiwI/h9Mqli9heWJGMdZylDLaFaqe3wYaXiZyNnc6GdRfVr12zelVdbc2K6uVVlRXlyxxlpSXFRYVL7UsKNNvi/LzcnGxrVmZGelpqiiU5KTFhUXyc2WQ0qApntKzF3tqjhYt6wmqRfcOGcjG2u4BwzUP0hDWgWhfShLUeSaYtpHSCcveHKJ0xSucsJbNo9VRfvkxrsWvhF5vt2iTbsbUL8C3N9m4tfEbCmyR8WMKJgAsKwKC1WPubtTDr0VrCrfv6R1t6miFufFF8k73JE1++jMbjFwFcBCicZfePs6x1TAI8q2XNOCdzIowK59ibW8LZ9mZhQVgpbHH1hdu3drU05xYUdJcvC7Mmt703TPb14WSHJKEmqSZsbAqbpBrNK1ZDN2njy6ZGb560UG+PI6HP3ue6rCusuLqFjhQH9DaHs6583To3hPDUpq7r58/mKqMtVq8mhqOj12vhqa1d82cLxLW7GzLAywtbe0ZbofpmOLGtQ4M2fl13V5hdB5WaWIlYVWx9HnuLwPR8RgvH2dfb+0c/04PQ5IyGadv+gkhOjvNY9DTltGijnV32gnBDrr3b1Zw3nk6j2/ZPZDu17IUz5cvGLSkxx44nJetAQuJ8wDM7JyFJLqC2bbOeZcIi+0YkRFhza7Cky441rRIXzyoada8CGV7dDFzhPkTEG45r6hm1rBF4wR82FFrs2ugfCRlgP/P2QoxLxxgLLX8kAYo8mU01zM/AYYcjXFYmUsTUhJjCxnVyXFu+bN8kX2n3WzR0cB+1w7eu7jWVcH9BgQjwTZNO6sUgfGhrV2ysUW9uhJyVju4w7xEzUzMzGdvFzKGZmVn2Hjsy+ah8EMgIm4tm/yVbMtNa+teEWebHTHti820d9ratO7q0ltEe3bdtnQtGsflVs3M6FE5r6lJyuQ7xXEXOIikvmyUWg66EsFqIf0aZ1H1hBUkpEUxrDVt6NsSu3fEFBR/JM2kyz2OajL4juGQ3x6ZbGV7jWDheu2C8wLqEUQX2qkW8rXPH6Gj8grlWFKDR0Va71jraM+qajB7qtWsW++gx/jB/eNTf0jMT0Mno8Ztyw603d2MR/WwNkpXT+nE7u2HruJPd0LGj65gFT283dHZFOONNPeu7x5dirusYbkWcEstnsWKkiRG1MSR6hJvlVO4xJ9EhOatKhBy7JxlJnHkGx8g9yWM4i8ThVY7bFBF8A9449U20/ihn00bTJG9wppFBnVYo3qROM8o2Gw3TXHmaFVEcbnatZHVY3qs/W7/Z8m79prP11ADY8gEuy6sKUgpSCnFhuIH4QFOmPnAa6C+kqVPQhScYMrjwnGUhGx10rigxlMRfnOVRPQmGsqzVWRsyuzP7Mw2rs1bmXp97t+GuRQZbSiEjnpZamGwxZxcfMTHTZHRqIm5RDUy82Zl2qIBpBVUFvCAlVSPNUmXhlkl+04S2vMPqgGk7hW2bLDv3vufYu+mMNLJB2kg797KdaQXVWZmZqRnpuBfE217AUlZU163jtTVFRcVF9jt4/lM9V032lNft3nRN79fPvsxKXv1c3YZd9fUDHeueMBzPK3pu+s0fPnHNmLutzKY+90FtUuolLzz22JO7U5PEs/ct0d+oHbivy6R7nVmfStmTcpdBiTNmG+t5fUobb0t5k5uSJ3nQmaIuyqT4jPT0+DhjWnpRRgZNslJnUqZTW1pzJJNFM1lmjhWLdmYuWVpz2Dpm5X7rO1b+eyuzxi8qijOLqWTQjpnZO2Zmzs5qqJdr3zvsEKvfjNUPO95D23Sm3iIjVW+BFxrOCC+wnQW1RqN9SVFRLaKWnpm5onrlSgEqm9c84738sU+ybNu2hg3DZSz7vu29n37sLj42bT3tWbsl9Dqb+svPxToP4H73y+o6KmZrj1EpjNmZEt9gMBoTMoyZCTVKjbnGWmNv5i3mFmuzPUFTKks74npKD5XeV/p148OmhxKeMD6REC49VXq6NIlKK0vbMXGy9LVSY6kzJ6+mAeNDctJgKlBNOfmZcFkk3lQgPLdYNVlSUopz8/KKiuMZGZMtRakpzh21PSnMl8JSJnmrMzkntyg/DzhfHuvJY3nAHS1EdBl8HCEqFsmUHNcgeudK2F0M0mJnI1o92tLimmLnmotqKotfKn6tWEkuthUfKlaoWCuuKo4Wq8XZJb+K+Vq4OPZCtp2Bl9/budeBRHtv707RwefS6+LdcKbhDEtJXU1oy6vYsGPvToTBkVaQsXJFdWbWSnnNzEAIapCDS4xGCRbNgAeYctPU7ruqWh+4LPRASf70m/nFW9f2V0y/ubhhZWN/+fSbatFtj3Zu396567LmL5/t5ru+WlG/4aa7pjlvvWfHstZr7z77AWKWNL1V3YbcTGM1R1NLDCxtMnraaU1IrjFnJibXmMTFKC6GTOC4cI4tZ00NgqomLkoyWjilGdU0rioKg9vTeizMMsmOOFMXJSdWJpWQllGV0ZOhvJPBMoR/lxTViN6Zmre4JiMrK0ddrTit2TUHFaZMsmJnHJcjVD8xSsXTiTNvZY1GVagW2enfGYs52LHpbDau+Gc9u7nF0/xrh2Pv8CbLu69Tw5mdlQ3StSx1dYr0a+pqAKYki9joDibjsrMtbOloC69BxY+oFjoefYdY9J1xBc/veHXjRDlGhuhvnEmJKQ1plrRsXFKtDQacIRMYiD6CcUxWd1pBWloBMyUp9iXFxWLL1CUxx/T7zD59Y1Nh06cOtm/dnL2+tvfT2WrR2ST+hw/4sZ29Fy1J+UVioFvUwDvxLPg+amAy7rdHnIVGw7H0Y1blYgPbY/iJgaemFCYmJVGupRAuSSZz5jlVL9OWX5Xfk+/PP5RvyLckayzmLFH48hYWvtm6J6pe6urKudq3IqVAQ/HLSDeKymfP5nLj14i6dyf7V5a07cBjvV/a/JnvP/vAkX1Nn95QO2Y4nlnw6pHrJ70pGWd/qj433VPR29jenxiPbPoS1nMt1hNHw84Gs0E1GgpNmrnKfNL8mlmtNB82c7OZFFWsJ47MpgbjFjyKb1Nw8vAcbVHVIr5IjZu/iPj5i0D9eg8ABnPL2LkXvWKw1GM1WEhGgWxfUs6cXcv7zt5rOP7+9IPvn71NVCcrHP5rw8uowpPO6pUqK1M1i5bSrR6yGszqSSvPyEzh6amZKUlpyWRJSmNk4elx5uRFbNeiKAwTZSbeyFKSY4VYVh2c13jYFomPkr2iwbzF3G5WzCWWypRdKTxlkqnOxKS0Ip6+i8YypzJ5JkL3ZFxCTWZ21hXHuJfk0hx76zeJ0/KDnfXv7sx+naxYm1gVWgMuq6uT8UJ5EMUhbUVtjSgLWSZRBDIyVmTYURLs1ntX3x26IlDUtO6i2n/+5+k371WL2r9wbcfS71hWb2179YOnlI0i126Hsd9AbMTZPnKM4rAPG1DnnHHtcfxQXDhuKu5U3O/jDLa4nriDcWNAGBSjCQe/kkzMSafwxKjQTtwiGA1GkxrPTUVMFXs5rmBpjZpt1o8ah34LIAOEJcjQyOhgAcOONJjL0G5n2dNvsmz1SaZOf/CXT6hFOEDYPAs7xBaccpYK+wztBn7IEDZMGU4Zfm8w2Aw9hoOGMSAMMAY3JVwpYjRjCWWr51ii614R02s4/udWeKMRZ3Ixzqp0ymNfO0aW6PvO1kWr7477SuJdlkcMD8efiDuROJljNqezDfxiY2v8lsWPJD5pfDLnu/HfS/hJ/CsJ75v+lJiYl5yX4czNr8lwJqXUJGeczHgpQ5GFLnlxg+yTstDzW5wJyUmp7Uk9STzJmspEFmTn1rAVqcLsiXytRvZLSmO9ozzWW/Nk70xOSq4ZE/flFpi9KzUVmTehLkq1igxcushEBawyo2BLEkvKqVy8a7Fv8X2L1cXJBWYnirY5O9/bGPPGpjNy+2w68y6KwBkUOWe61VmS3mB1Lk7GJdeCS15KgyxqDWdlEUyFEaBIFcaASPagE31khhTnnSyEkoEwgeNMzGeJLjwRF79ODhsLGhwk6F93oCjvlOqTnPBSklCaJNQnOeEskkJRnBwOHKP1uAtD8HbupZ0OhiPHrhUX1VpoRTUpBfL+JE0chiZjFv8zs65868j0767zsvSXz7BU41mncrVr/Y5i5YpLLquvZ2xb5Vfuf+K2V5kZ1fm70898/qYNbODKg01NAfkxmPiI79d7nvlx/8ldyfV/NGeb5adDD/yqfu5Tf5reavwyqgdDbWMzH58RmdZNb6amuQ/UPvQBU4IRKMN36Q71V3SLKZ8OqAFK4qtx53sJ3Qncl/hjZMX4dtEw1wielfQ4s7H/5JN8UtGUIeV/qw1qyPBZXXoClSANxIsjISppO+65Nlt82AgCu0u9ksTduzRYXhXJFy9HiuTCnaEOK9TFLDqsUjrr12EDWdnndNgI+A4dNtF32Dd02ExF3K/DcTTK79LhePU5RdPhRdRr+qUOJ9Buc7MOJxqPmh/T4SS6LPnTs347mHxch+E2y2od5qRa1umwQsss63VYpXjLkA4bKMFyhQ4bAV+rwybqtRzWYTOlWf6gw3HUkmLQ4XjuSvmEDi+i5WmPz35btiLtFzqcqOxIT9bhJKrI8sISpgqvJ2V9SYdVysl6UMIG4OOzTuqwSplZ35ewEXhj1ms6rFJq1hsSNom4ZP1JhxGLrKiEzcAnWNN0WCWr1SbhOBFfa50OI77ZtToMOdkNOoz4Zl+sw5CZfZ8OI77ZEzqM+Gb/ow4jvtm/0mHEN+dhHUZ8c17UYcQ391M6jPhq2TqM+Gqf1WHEV/tfOoz4Ft8p4Xjhq+J/12H4qji2xkXAp5Zk67BKi0scEk4QaynZqMOwv2SrhJNE5pd4dFilvJKQhC1Szm06LOR8TcJpwuclz+owfF7yXQmnC3tKfqbDsKfkTQlnAJ9eynRYJa00Q8KZgr60VodBX9ok4WxJv1OHBf1eCeeKHCi9TYeRA6X3SDhf2FM6rsOwp/QpCdsk/fd1WNC/LOGlIgdK39Jh5EDpHyVcJvxTlqjD8E9ZzM5yUQnKSnVYnYHN0v+zMOwvk/ljlusq26rDAr9LwAkx+v06LPDXS1jGpex+HRZ6H6VO2k9+8tBucpEbvUaPonVSv4Q3kY+G0II6lYaK6aNhwOLqAt4rKTRgBsBfAahZ4l3/Q0mVs5Zp1IGZAQrN0gSA24g+pm85rca7isp1qFpiG8ExgH4bePbAhqDk2gZ5AbRh2odrH6iGMe8C5Xqpo+8cO9fMo9FmqdbQJVJKYNbqFdBahbeGKr8JWDdmfZj3wbNBKj2vlI+SMUdbPs+uznn4b0nPCr/1QcYg+mG6HDih7b/vcw1YD7zlhU1BaZvwkYaxoAnqUrcjHhq1S36NiqS+Tbhuge7d0vcu0As+D6QKb49ITiGt4jw2xeLsg15hkx+0+z+SyiPzS9CNSKv2zOr16tlbLqPso17d6s1ypl960QVrls3aPixnvDJTO3ANSatjEYll1SrkUpO0JCi9POO3Ydiigcql52Iso7zS930yw0TODUld8+Pu1mW5pG2Cc1BKFHb3Q/+glBjzviatdkl9bj0asRlhdUCPh0uuMca3fzb+Xj3b/XoEPdI3AZmNsdXNRMil2x+S2jSpYb5VM5EXvhHjESm7f142CFqflBXTPYOPeTuoe8StZ2rgHLogZHqkV7zoY7LdOiYkPS0yai6nfXLnDkuPDkh+YamI56DONaPBLfn36Vq9+kpj+1FImPPCblAKaTHsnF+9und9+kq8kj4kR3NRDcgsHZDWnT8nZmprYHYtYm5QypuTIerF5bq1Lt3/bln1NH2XzvisT+reI7ExfrHDvHoM++W+8+s54sNV7Oh9urdjEuaqvUvGKpYdmvShW1+/V0ZtQNL45d6LZeOQ5IytZH52e2czS+z8K/TIDEprRG7u0/dWrO4MzNoxKEdz2Rv80IkU+ND63LqOXikhJD3dtyA3PbQX+BnPitx2z65wt8xtTebAFdK3AZl3wdl6Eou6sD2234N61YjtpoCeZXPVMzY7KCPioislf8xqIdctZ+cyLaa9T3rLL3fJ/tlVzOgekjVTzLukJ4Z1HWIPxbwYlPwzFs9I98scGpR1c8a2Cnn2BTG3BmdqJeSKd4Wkml9hK2R1GgRFv9xLA4AGAQ3JCHnkKEC7ZA7EIl4xS/l/V8OIzJgYrWeels2o9J0491vRmpB5At4CrDgBWnH9pMS3ANOBq8jNi3EStOC9SWI7KRFPU6J1ymwKnCfXtFl8bJ/EPOrXfT6Xo3/dKTYXmZmKPBPnXjm7H/ShWZ3u2doWy+e582h+tYxVjrk6Gtu/Xr1mBvQ9vUdK8czWRLFbu3VtYnfv02tp7+xpFNMZ/BjPzNTOkdnq5NF3nGc2p4dl/Qjq+3m3no/n89fMLhQe88yTMreLz9XXp5+AIgN7ZWWMWd2rR2ZIl3y+CBXLVS30VKwin5sV52qeqW2iirnkvagLWgd0bwf0GvJRuoX3twMzV2f3nxMLj36XMf+eK1a9XdIiv/SsV7/T+Wtirum5ODSvts3oFZWkT3raO+8UGZ53r7xslnp4Xt7Ond0f7ylh3aCUP5NXvgXyRmT8L5fRnH8fOlMf5yh9oI3doYakx4X8/tn1xOyan92DekWN+T+2q/x6fsxV3oU59HErmsuPjXLt50Zu5t5LnDke/Q4ttprY/Z5bRnXoQzEY/pC/5yQH5N1qSN71x86hffLeaITm313919GfkTes3/959Wee893FnRvHmLfm7ljdUua5+3gmYq4P+Xr332TtnJfP1bDwvF9okUe/iw3i7JmRIJ5PGin2JFCCe/gaqsPzl4brcozK8XxVI5+yxKcj26lNp6zC7HLM1OhwHZ7G6iTXSqrFs4BoQvrfdtb990/GmbnKD3lv9jzs3O/37Ha5PdqjWme/R9vkG/IFgdKafMN+37Ar6PUNaf4Bd4XW7Aq6/guiSiFM6/ANhAQmoG0cAt/y1aurynGprtAaBwa0bd49/cGAts0T8Azv8/Q1DntdA+t9A30zMtdIjCZQay7xDAeE6BUVVVVaySave9gX8O0Ols6RzKeQ2HIpq1PCj2idw64+z6Br+HLNt/tjLdeGPXu8gaBn2NOneYe0IEi3d2jtrqBWpHVu0rbs3l2huYb6NM9AwDPSD7KKWUlYs2/PsMvfv38+yqM1D7tGvEN7BK8X7i3Xtvl6IXqz193vG3AFlgnpw16316V1uEJDfVgIXLWqusk3FPQMCtuG92sBF7wIR3l3a32egHfP0DIttnY3qFxeTA76hj1af2jQNQTzNXe/a9jlxjIw8LoDWIdrSMPcfrF+L9zuxwI9bk8g4IM6sSAX5Ifc/ZpXFyUWHxryaCPeYL90w6DP1ye4BQyzgzDEDacGZnDBEc9Q0OsBtRtAaHh/hSY97dvnGXYh3sFhjys4iCnB4A4h5gGhTMTRMyxN2B0aGAAobYX6QR+UeIf6QoGgXGoguH/AM98TIlsDQotneNA7JCmGfZdDrAv2u0NQFAtgn9e1xyfmR/rhc63fM+CHR3zaHu8+jySQae/SBuAObdAD3w153SB3+f0euHHI7YGSmLu9wlma5wosZtAzsF/D2gLInQEhY9A7IN0b1DdSQNfnBkevRwsFkFLSm569IWFsyC38r+32YcmQiEUFgyJPsPRhD+IeRGogTAG4TKYnhoOuPa4rvUMQ7Qm6l8WcBvY+b8A/4NovVAjuIc9IwO/ywzSQ9MHEoDcgBAty/7Bv0CelVfQHg/41lZUjIyMVg3rCVrh9g5X9wcGBysGg+NuSysHALpdYeIVA/pUMI54BYD2SZfOWzo2tG5saOzdu2axtadU+ubGpZXNHi9Z48baWlk0tmzsT4xPjO/vh1hmvCReLmMBQrCAoPXqeLSYXIxJZrLl3v7bfFxKcbpFt8LPcR7G0RHLIHEV8sf2GQO7aM+zxiEys0LrB1u9CGvh6xTYCZ3CBMSI7R0Q6eRA4j/D0sMcdRJx3w49zdokQ+vZ4JIkM8SwfQoPs7Q0FIRpm+rCj5i2oODBjFBJ51hWzzCLbtH2ugZCrFxnmCiBD5nNXaNuHZM7un1kF1qRXLqS3Swv4PW4vis65K9fgxSGZbYLX1dfnFTmBrByWVXmZQA9L38rd/SGjBryDXrEgKJF0I77hywOxJJX5KJG+ERTUUO+AN9Av9EBWzN2DSFTYj1D592ux5NU9tFCR9MfG3XOLE9Vrb8gTkGpQ99ye4SF9BcO63ZI40O8LDfRhD+3zekZi5eqc5Qs6RNKDCtA3V+Jm1wizZGF1B+diLBbm0q3efX6x0uRZBn3f64KgxxVcIwi2dzTiEChZVVNXqtUtX1VeVVNVFRe3vQ3IquXLa2pwrVtRp9WtrF1duzox/iN23cduRjGq1M2T+xCPqx79Jknc6sz/mGXhTJBCLBG3Bm8toJnD7qaFH3NrOqZV/9Bj/oyOU25QnlG+o5zEdXz+/AL8ha8NLnxtcOFrgwtfG1z42uDC1wYXvja48LXBha8NLnxtcOFrgwtfG1z42uDC1wYXvjb4f/hrg9nPD7z0UZ8sxGY+iT6WrT6JCS2gPXf2Ylk1AguoZnCt9BbGl9N7oH8LuIWfOiycm+GZub/ynVfi3OwlEppPE8NskKN98vOOhfMLZ9r10zckn/18clfOpz7f/HxP+T7Shz7Vpq5T16pN6kp1lepUL1Lb1NXzqc8733neT3TmsK3nrCeGaRMjthw08+fmsG36venlH7J4Hp6l0C8VO7Jk3vws7q/Nm7/SN3+1vI/LK/3/y1O0mH5K53l9mzqVr1AyY2SLTilfnrCkVzsnlbsnktOqnY0W5U5qR+MUVjbRFBonn3IbHUTjIG+LlC+vPiaAifikagvobyIN7RCaQmO4Mjl2ogn6mybSMoX4ayLJKZLvs5GqmhgwYbFWtzemK1cQUzzKENnJphxAvxi9G30++l6lD5VC2OmcSLZUH4K+BpA3KBkoQzalUcmkavTNSg7lSrJQJCmmJxQpKatujFeaFKskSVYSUY9silkxRapt2glF/NmwU7lhIm6RsO+GiCWj+hnlOsVE6aA6BKosW/IzSjxVoomVdE7EJVYfbkxQOrHMTrjFpoj/rH+fvDqVoQgEQV+LkkeZmLtcyacM9K3K4kiGbeqEcrsk+zshBfrWRcwrRDeRmFQ91RiniL8HCCu3wuO3Sm2HJ4pWVVNjkVJCVYr4EwlNOQjooPjP4soooFGEaRShGUVoRmHFKBkR+RsxcyNoKpUrya+M0GG0+wCrEJkRgQePSWBpSfUxJVuxwhOWE/AdAzZnIi5JWGaNpKZJMutEQlJ1wzNKgLagcRgfnMiyVvtOKGVyKcsmrLmCwR+JS4DrsmKxAGOmiMEzSp6yWHoiX3og3GjDmFGyYiPGf8BPCe/wl/mPRXzFT/rI/h/1/kW9/2Gsj07xUxPQ4pzk/yz60415/A0I28VfpfsAcX6CP4+jxsZ/zieFFfxn/Bg1oH8F4z70x9CvQH88UvA92ySfnEAH2++JJGaKxfLnI45KHbAV6kBWrg6kZlY3FvLn+LOUBxE/Rb8U/bN8ipagP4nein6KB+l76J/gtbQW/VG9/w5/WuQ0f4o/iTPTxiciScKEcMQkuiMRo+i+FaHYqL3S9jT/Fn+cckD6zUhRDrCPTBQttSWfgDzGH+TBSL4ttTGe38+62LsgGqNXRE+p/IFInRByOPK0ZjvGD/PDTmuds9BZ7nxIqSqsKq96SNEKtXKtTntIa7TwW8kA52HD8ptwxfnMkT1oTrTD/MaIWhduPIs1iXVxOoTrmIR6cPVLiHC1zM6+I6EGfh1tQeOQcQDtINohtKtIxfVKtM+ifQ7t8xITRAuhjaB8+MHhB4cfHH7J4QeHHxx+cPglh19qD6EJjh5w9ICjBxw9kqMHHD3g6AFHj+QQ9vaAo0dytIOjHRzt4GiXHO3gaAdHOzjaJUc7ONrB0S45nOBwgsMJDqfkcILDCQ4nOJySwwkOJzickqMKHFXgqAJHleSoAkcVOKrAUSU5qsBRBY4qyaGBQwOHBg5Ncmjg0MChgUOTHBo4NHBoksMCDgs4LOCwSA4LOCzgsIDDIjksMj4hNMFxGhynwXEaHKclx2lwnAbHaXCclhynwXEaHKf5yLhyqvEFsJwCyymwnJIsp8ByCiynwHJKspwCyymwnNKXHpTO4EibA2gH0Q6hCd4p8E6Bdwq8U5J3SqZXCE3whsERBkcYHGHJEQZHGBxhcIQlRxgcYXCEJccYOMbAMQaOMckxBo4xcIyBY0xyjMnEDaEJjr89Kf/m0PCrWJcZhys/xEplf5Delv0BekX2n6dx2X+OHpL9Z+lq2V9JdbIfoSLZQ57sg2Qzs4itLrkxEyVgC9ouNB/afWhH0E6imST0EtpraFFe61yiJpu2mO4zHTGdNBmOmE6beLJxi/E+4xHjSaPhiPG0kWuNuTxR1lGUFvqivB7E9fdoOERwbZBQA6+B3hrU2Vq8a3iNM+WM9vsy9lIZO1nGjpSxL5axxjh+MVNlpcOdPofhrMuZULTO9gpaXVHxOlSmW598O8sWKVppm2RPx7pSpwP922jjaA+hXY1Wh1aNVo5WiGaTuDLQdzmX6CKfRitGK0DThArKzMTdTWqK2XmMJ7KHJl5IpDihp7gEfCcixVXoJiPFW9A9FSnutTXGsSepWNwGsScQucfRH4nYXsf0N2PdNyK2E+geidhq0O2MFFeguzRS/KKtMZFtJ5sqWDv1vgPrFv22iO0SkG2N2ErROSLFRYK6DIoKMVvKuuh19IU619KYJnvEthbdkohttaA2U7EIPDNSuTTPgCZ6ZQIG/f4Y61KZc5HtjO1229tg/x0ci/T4mTaponupcJJd4oy3PV3+VRA32iKN8YIe58O43odF/4TtocIbbfdAFit80na3rcJ2a/mkGehbYPeNUkXEdrU2yR93ptkO2apswfLXbQHbJ2wu2zbbzkLgI7bLbE8LM6mbdfHHn7S1Q+BGrKIwYru4cFKa2Grbb3Paim2rtaeFf2lVTG5d+dPCA1Qd074M/i0rnBQ5vr1ukqU4y0zvmA6bLjWtN6012U1LTItN+aZ0c6rZYk4yJ5jjzWaz0ayauZnM6eLnHRzizyvTjeKv18moiqsqYQsXVx77S1POzJw+QeE0pY23daxnbeEpN7X1auH3OuyTLH7rjrDBvp6FU9uorXN9eJWjbdIU3Rauc7SFTe2Xdo0zdms3sGF+wySjzq5JFhWo63LFD1GNM7rultxjxFj2dbd0d5M1c1+DtSF1Xcrq1ubzXHr0q2PuZZ0P5ofvauvoCj+W3x2uFkA0v7stfJX4mapjPJkntjQf40mi6+46pvp5css2gVf9zd0ge12SIZuTQEbFogOZeT1pggz1ZL0gQ4xidEVgB12B6EAXn0hFkq4oPlHSqUzQjb+itTSPa5qkKSR6RdK8UkjzaJAx4G0eLyqSVHaNdQkq1mXXpGGlUpDNBpJymyTBk5tNCrIxqSxcOUdSqJPUzpLUSl0Km6OxxWjSS2Zo0ktA4/gfvjzrHWxieejA8+KXv3rsLR60nvBN+/qt4UO9mjZ+IKT/JFhRT6+7X/QuTzhk9zSHD9ibtfHlz59n+nkxvdzePE7Pt3R2jT/v9DRHljuXt9hdzd0TDfVdjQt03Tirq6v+PMLqhbAuoauh8TzTjWK6QehqFLoaha4GZ4PU1eIVed/eNW6m9eJ3QWQ/wRfFI4d7cgu612da/OtEQh9bW2A9kHtcJfYILXJ0hxPs68OJaGKqvLG8UUxhn4mpJPHzbvqU9cDagtzj7BF9ygJ0in09zbiWBFFbuHZrW7igY0eXSJWw03X+mAXES05bqcXbjH8YB2XDez4lBc77Cp7vFQqFAuIScuApuS1c1tEWXrkVlphMUNXT3A1cxQxOUSRuPC6uZTI6hUkHjGBBoU5ADiZ+I8AZj6cuEx8zjpm4eFQITuTkV/uewQl+EA3PcXwkUimfl/nIxJJC8fwSnKisjfV4PhV9JKegWvwUQR1YRV8Y650p5QAOFx4uP1w3VjhWPlZnFD+08BCQtofEURqpfEihoCMw4wiAwW6K/XQB9N0fycuXiscE4HB0OwLyN17ow6526L8jA6fPOjagSw1I8cGZgMTwAYoRxyYdoRmmkM4iJ0OSRSr8P1jbNhMKZW5kc3RyZWFtCmVuZG9iagoKNiAwIG9iagoxMDgyNQplbmRvYmoKCjcgMCBvYmoKPDwvVHlwZS9Gb250RGVzY3JpcHRvci9Gb250TmFtZS9CQUFBQUErQXJpYWwtQm9sZE1UCi9GbGFncyA0Ci9Gb250QkJveFstNjI3IC0zNzYgMjAwMCAxMDExXS9JdGFsaWNBbmdsZSAwCi9Bc2NlbnQgOTA1Ci9EZXNjZW50IDIxMQovQ2FwSGVpZ2h0IDEwMTAKL1N0ZW1WIDgwCi9Gb250RmlsZTIgNSAwIFI+PgplbmRvYmoKCjggMCBvYmoKPDwvTGVuZ3RoIDI3Mi9GaWx0ZXIvRmxhdGVEZWNvZGU+PgpzdHJlYW0KeJxdkc9uhCAQxu88BcftYQNadbuJMdm62cRD/6S2D6AwWpKKBPHg2xcG2yY9QH7DzDf5ZmB1c220cuzVzqIFRwelpYVlXq0A2sOoNElSKpVwe4S3mDpDmNe22+JgavQwlyVhbz63OLvRw0XOPdwR9mIlWKVHevioWx+3qzFfMIF2lJOqohIG3+epM8/dBAxVx0b6tHLb0Uv+Ct43AzTFOIlWxCxhMZ0A2+kRSMl5RcvbrSKg5b9cskv6QXx21pcmvpTzLKs8p8inPPA9cnENnMX3c+AcOeWBC+Qc+RT7FIEfohb5HBm1l8h14MfIOZrc3QS7YZ8/a6BitdavAJeOs4eplYbffzGzCSo83zuVhO0KZW5kc3RyZWFtCmVuZG9iagoKOSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UcnVlVHlwZS9CYXNlRm9udC9CQUFBQUErQXJpYWwtQm9sZE1UCi9GaXJzdENoYXIgMAovTGFzdENoYXIgMTEKL1dpZHRoc1s3NTAgNzIyIDYxMCA4ODkgNTU2IDI3NyA2NjYgNjEwIDMzMyAyNzcgMjc3IDU1NiBdCi9Gb250RGVzY3JpcHRvciA3IDAgUgovVG9Vbmljb2RlIDggMCBSCj4+CmVuZG9iagoKMTAgMCBvYmoKPDwKL0YxIDkgMCBSCj4+CmVuZG9iagoKMTEgMCBvYmoKPDwvRm9udCAxMCAwIFIKL1Byb2NTZXRbL1BERi9UZXh0XT4+CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDQgMCBSL1Jlc291cmNlcyAxMSAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL0dyb3VwPDwvUy9UcmFuc3BhcmVuY3kvQ1MvRGV2aWNlUkdCL0kgdHJ1ZT4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCgoxMiAwIG9iago8PC9Db3VudCAxL0ZpcnN0IDEzIDAgUi9MYXN0IDEzIDAgUgo+PgplbmRvYmoKCjEzIDAgb2JqCjw8L1RpdGxlPEZFRkYwMDQ0MDA3NTAwNkQwMDZEMDA3OTAwMjAwMDUwMDA0NDAwNDYwMDIwMDA2NjAwNjkwMDZDMDA2NT4KL0Rlc3RbMSAwIFIvWFlaIDU2LjcgNzczLjMgMF0vUGFyZW50IDEyIDAgUj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2VzCi9SZXNvdXJjZXMgMTEgMCBSCi9NZWRpYUJveFsgMCAwIDU5NSA4NDIgXQovS2lkc1sgMSAwIFIgXQovQ291bnQgMT4+CmVuZG9iagoKMTQgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSCi9PdXRsaW5lcyAxMiAwIFIKPj4KZW5kb2JqCgoxNSAwIG9iago8PC9BdXRob3I8RkVGRjAwNDUwMDc2MDA2MTAwNkUwMDY3MDA2NTAwNkMwMDZGMDA3MzAwMjAwMDU2MDA2QzAwNjEwMDYzMDA2ODAwNkYwMDY3MDA2OTAwNjEwMDZFMDA2RTAwNjkwMDczPgovQ3JlYXRvcjxGRUZGMDA1NzAwNzIwMDY5MDA3NDAwNjUwMDcyPgovUHJvZHVjZXI8RkVGRjAwNEYwMDcwMDA2NTAwNkUwMDRGMDA2NjAwNjYwMDY5MDA2MzAwNjUwMDJFMDA2RjAwNzIwMDY3MDAyMDAwMzIwMDJFMDAzMT4KL0NyZWF0aW9uRGF0ZShEOjIwMDcwMjIzMTc1NjM3KzAyJzAwJyk+PgplbmRvYmoKCnhyZWYKMCAxNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMTE5OTcgMDAwMDAgbiAKMDAwMDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMjI0IDAwMDAwIG4gCjAwMDAwMTIzMzAgMDAwMDAgbiAKMDAwMDAwMDI0NCAwMDAwMCBuIAowMDAwMDExMTU0IDAwMDAwIG4gCjAwMDAwMTExNzYgMDAwMDAgbiAKMDAwMDAxMTM2OCAwMDAwMCBuIAowMDAwMDExNzA5IDAwMDAwIG4gCjAwMDAwMTE5MTAgMDAwMDAgbiAKMDAwMDAxMTk0MyAwMDAwMCBuIAowMDAwMDEyMTQwIDAwMDAwIG4gCjAwMDAwMTIxOTYgMDAwMDAgbiAKMDAwMDAxMjQyOSAwMDAwMCBuIAowMDAwMDEyNDk0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSAxNi9Sb290IDE0IDAgUgovSW5mbyAxNSAwIFIKL0lEIFsgPEY3RDc3QjNEMjJCOUY5MjgyOUQ0OUZGNUQ3OEI4RjI4Pgo8RjdENzdCM0QyMkI5RjkyODI5RDQ5RkY1RDc4QjhGMjg+IF0KPj4Kc3RhcnR4cmVmCjEyNzg3CiUlRU9GCg=="
                        },
                    ],
                    "contractDetails": {
                        "contractType": contract?._id.toString()
                    }
                })
                // console.log('res:', res)
                expect(res.body.status).toBe(200);
                expect(res.body.message).toBe('Employee created successfully.');
                createdEmployeeId = await (JSON.parse(res.text)).user._id
            }, 25000)
            test('should return 409 for email already exist', async () => {
                const res = await request(app).post('/addUser').set('Authorization', `Bearer ${createdMToken}`).send({
                    "personalDetails": {
                        "firstName": "add employee for testing",
                        "middleName": "add employee for testing",
                        "lastName": "add employee for testing",
                        "phone": "1234567890",
                        "email": "jane.doe2@example.com",
                    },
                    "jobDetails": [{
                        "jobTitle": "Marketing Specialist",
                        "jobDescription": "Handles marketing strategies and campaigns.",
                        "annualSalary": 50000,
                        "hourlyRate": 25,
                        "weeklyWorkingHours": "40",
                        "joiningDate": "2024-01-15",
                        "location": location._id,
                        "assignManager": createdMID,
                        "role": "Employee"
                    }],
                    "contractDetails": {
                        "contractType": contract?._id.toString()
                    }
                })
                expect(JSON.parse(res.text).status).toBe(409);
                expect(JSON.parse(res.text).message).toBe('Email already exists.');
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
                const res1 = await request(app).post('/addUser').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`).send({
                    "personalDetails": {
                        "firstName": "add employee for testing",
                        "middleName": "add employee for testing",
                        "lastName": "add employee for testing",
                        "phone": "1234567890",
                        "email": "rishi12345@example.com",
                    },
                });
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })
        
        describe('~ get user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .get(`/getUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for fetch a employee by ID', async () => {
                const res = await request(app).get(`/getUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdMToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('User get successfully.');
            });
            test('should return 409 for ID pass null', async () => {
                const res = await request(app).get(`/getUser/null`).set('Authorization', `Bearer ${createdMToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 409 for user not found', async () => {
                const res = await request(app).get(`/getUser/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${createdMToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
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
                const res1 = await request(app).get(`/getUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe("~ get their company's employees", () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .get('/getAllUsers')
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for fetch all their companys employee', async () => {
                const res = await request(app).get('/getAllUsers').set('Authorization', `Bearer ${createdMToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Users got successfully.');
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
                const res1 = await request(app).get('/getAllUsers').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe('~ update user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .post(`/updateUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for update user details', async () => {
                const res = await request(app).post(`/updateUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdMToken}`).send({
                    "personalDetails": {
                        "firstName": "update first name",
                        "middleName": "update middle name",
                        "lastName": "update last name",
                        "email": "update222@example.com"
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
                    "role": "Employee",
                    "contractDetails": {
                        "contractType": contract?._id.toString()
                    }
                })
                // console.log('res:', res)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Employee details updated successfully.');
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post(`/updateUser/6775109a39cd21ffef4f9850`).set('Authorization', `Bearer ${createdMToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 409 for email already in use', async () => {
                await User.create({
                    personalDetails: {
                        firstName: "Existing",
                        lastName: "User",
                        email: "existing@example.com"
                    },
                    isDeleted: false
                });
                const res = await request(app)
                    .post(`/updateUser/${createdEmployeeId}`)
                    .set('Authorization', `Bearer ${createdMToken}`)
                    .send({
                        personalDetails: {
                            email: "existing@example.com",
                        }
                    });
                // console.log('res:', res)
                expect(JSON.parse(res.text).status).toBe(409);
                expect(JSON.parse(res.text).message).toBe('Email already exists.');
            });
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
                const res1 = await request(app).post(`/updateUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })

        describe('~ delete user', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app)
                    .post(`/deleteUser/${createdEmployeeId}`)
                expect(JSON.parse(res.text).status).toBe(401);
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
            })
            test('should return 200 for delete a user', async () => {
                const res = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdMToken}`)
                expect(JSON.parse(res.text).status).toBe(200);
                expect(JSON.parse(res.text).message).toBe('Employee deleted successfully.');
                const deletedEmployee = await User.findById(createdEmployeeId);
                expect(deletedEmployee.isDeleted).toBe(true);
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${createdMToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
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
                const res1 = await request(app).post(`/deleteUser/${createdEmployeeId}`).set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
                expect(JSON.parse(res1.text).status).toBe(403);
                expect(JSON.parse(res1.text).message).toBe('Access denied');
            });
        })
    })
})

describe('ClockIn or ClockOut for Administrators, managers and employees==================================================', () => {
    describe('ClockIn', () => {
        let userId
        let userToken
        let userJobId
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const company = await Company.create({
                companyDetails: {
                    businessName: 'testingCompany'
                }
            })
            const location = await Location.create({
                companyId: company._id,
                latitude: "12.121212",
                longitude: "21.212121",
                radius: "1000",
                locationName: "second location",
                ukviApproved: true
            })
            const user = await User.create({
                personalDetails: {
                    email: 'testingforclockin@gmail.com'
                },
                companyId: company._id,
                password: 'Password123',
                jobDetails: [{ jobTitle: 'webDeveloper', location: location._id }],
                role: 'Employee'
            })
            userId = user._id
            userJobId = user.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'testingforclockin@gmail.com', password: 'Password123' })
            expect(JSON.parse(login.text).status).toBe(200)
            userToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/clockIn')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 200 for clock-In', async () => {
            const res = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
                // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(200)
        })
        test('should return 404 for non-existing user', async () => {
            const res = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId: userJobId
                })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        test('should return 400 for, Invalid QR code', async () => {
            const res = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
            .send({
                userId,
                jobId: userJobId,
                location: { latitude: 12.121212, longitude: 21.212121 },
                isMobile: true
            })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Invalid QR code')
        })
        test("should return 400 for, location coordinator data not found", async () => {
            const res = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Location coordinator data is not found!')
        })
        test("should return 404 for, jobTitle not found", async () => {
            const res = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        })
        test('should return 403 for outside the geofenc area', async () => {
            const res = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.2337, longitude: 27.8138 }
                })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('You are outside the geofence area.')
        })
        test('should return 400 for clockIn before clockOut', async () => {
            const res = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Please clock out before clockin again.')
        })
        test('should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ _id: userId }, { $set: { role: 'employee' } })
            const res = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        });
    })
    describe('ClockOut', () => {
        let userId
        let userToken
        let userJobId
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const company = await Company.create({
                companyDetails: {
                    businessName: 'testingCompany'
                }
            })
            const location = await Location.create({
                companyId: company._id,
                latitude: "12.121212",
                longitude: "21.212121",
                radius: "1000",
                locationName: "second location",
                ukviApproved: true
            })
            const user = await User.create({
                personalDetails: {
                    email: 'testingforclockout@gmail.com'
                },
                companyId: company._id,
                password: 'Password123',
                jobDetails: [{ jobTitle: 'webDeveloper', location: location._id }],
                role: 'Employee'
            })
            userId = user._id
            userJobId = user.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'testingforclockout@gmail.com', password: 'Password123' })
            expect(JSON.parse(login.text).status).toBe(200)
            userToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/clockOut')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for non-existing user', async () => {
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId: userJobId
                })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        test('should return 400 for, Invalid QR code', async () => {
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
            .send({
                userId,
                jobId: userJobId,
                location: { latitude: 12.121212, longitude: 21.212121 },
                isMobile: true
            })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Invalid QR code')
        })
        test("should return 404 for, jobTitle not found", async () => {
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        })
        test("should return 400 for, location coordinator data not found", async () => {
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Location coordinator data is not found!')
        })
        test('should return 403 for outside the geofenc area', async () => {
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.2337, longitude: 27.8138 }
                })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('You are outside the geofence area.')
        })
        test('should return 404 for time sheet not found', async () => {
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('No timesheet found for today.')
        })
        test('should return 200 for clock-Out', async () => {            
            const clockIn = await request(app).post('/clockIn').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
            expect(JSON.parse(clockIn.text).status).toBe(200)
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
            expect(JSON.parse(res.text).status).toBe(200)
        })
        test('should return 400 for not clock-out without an active clock-in.', async () => {
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe("You can't clock-out without an active clock-in.")
        })
        test('should return 403 for Access denied for unauthorized role', async () => {
            await User.findOneAndUpdate({ _id: userId }, { $set: { role: 'employee' } })
            const res = await request(app).post('/clockOut').set('Authorization', `Bearer ${userToken}`)
                .send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        });
    })
})

describe("~ administartor, manager and employee can get own today's timesheet==================================================", () => {
    let userId
    let userToken
    let userJobId
    test('should return 401 for Unauthorized: Invalid API key', async () => {
        const user = await User.create({
            personalDetails: {
                email: 'testingforgettimesheet@gmail.com'
            },
            password: 'Password123',
            jobDetails: [{ jobTitle: 'webDeveloper' }],
            role: 'Employee'
        })
        userId = user._id
        userJobId = user.jobDetails[0]._id
        const login = await request(app).post('/login').send({ email: 'testingforgettimesheet@gmail.com', password: 'Password123' })
        expect(JSON.parse(login.text).status).toBe(200)
        userToken = JSON.parse(login.text).user.token
        const res = await request(app).post('/getOwnTodaysTimesheet')
        expect(JSON.parse(res.text).status).toBe(401)
        expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
    })
    test('should return 404 for , user not found', async () => {
        await User.findOneAndUpdate({ _id: userId }, { $set: { isDeleted: true } })
        const res = await request(app).post('/getOwnTodaysTimesheet').set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(404)
        expect(JSON.parse(res.text).message).toBe('User not found')
    })
    test('should return 404 for, job title not found', async () => {
        await User.findOneAndUpdate({ _id: userId }, { $set: { isDeleted: false } })
        const res = await request(app).post('/getOwnTodaysTimesheet').set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(404)
        expect(JSON.parse(res.text).message).toBe('JobTitle not found')
    })
    test('should return 200 for, timesheet got successfully', async () => {
        const res = await request(app).post('/getOwnTodaysTimesheet').set('Authorization', `Bearer ${userToken}`).send({ jobId: userJobId })
        expect(JSON.parse(res.text).status).toBe(200)
        expect(JSON.parse(res.text).message).toBe('Timesheet fetched successfully.')
    })
    test('should return 403 for, acces denied', async () => {
        await User.findOneAndUpdate({ _id: userId }, { $set: { role: 'employee' } })
        const res = await request(app).post('/getOwnTodaysTimesheet').set('Authorization', `Bearer ${userToken}`).send({ jobId: userJobId })
        expect(JSON.parse(res.text).status).toBe(403)
        expect(JSON.parse(res.text).message).toBe('Access denied')
    })
})

describe('~ administrator, manager and employee can get own all timesheet==================================================', () => {
    let userId
    let userToken
    let userJobId
    test('should return 401 for Unauthorized: Invalid API key', async () => {
        const user = await User.create({
            personalDetails: {
                email: 'testingforgetalltimesheet@gmail.com'
            },
            password: 'Password123',
            jobDetails: [{ jobTitle: 'webDeveloper' }],
            role: 'Employee'
        })
        userId = user._id
        userJobId = user.jobDetails[0]._id
        const login = await request(app).post('/login').send({ email: 'testingforgetalltimesheet@gmail.com', password: 'Password123' })
        expect(JSON.parse(login.text).status).toBe(200)
        userToken = JSON.parse(login.text).user.token
        const res = await request(app).post('/getAllTimesheets')
        expect(JSON.parse(res.text).status).toBe(401)
        expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
    })
    test('should return 404 for, user not found', async () => {
        await User.findOneAndUpdate({ _id: userId }, { $set: { isDeleted: true } })
        const res = await request(app).post('/getAllTimesheets').set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(404)
        expect(JSON.parse(res.text).message).toBe('User not found')
    })
    test('should return 404 for, job title not found', async () => {
        await User.findOneAndUpdate({ _id: userId }, { $set: { isDeleted: false } })
        const res = await request(app).post('/getAllTimesheets').set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(404)
        expect(JSON.parse(res.text).message).toBe('JobTitle not found')
    })
    test('should return 200 for, timesheet got successfully', async () => {
        const res = await request(app).post('/getAllTimesheets').set('Authorization', `Bearer ${userToken}`).send({ jobId: userJobId })
        expect(JSON.parse(res.text).status).toBe(200)
        expect(JSON.parse(res.text).message).toBe('Timesheets fetched successfully.')
    })
})

describe('~ get timesheet reports==================================================', () => {
    describe('~ superadmin can get all users timesheet report by id', () => {
        let SAToken
        let userId
        let userJobId
        test('should return 401 for, unauthorized: Invalid API key', async () => {
            const user = await User.create({
                personalDetails: {
                    email: 'testingforgetalltimesheetreport@gmail.com'
                },
                password: 'Password123',
                role: 'Superadmin'
            })
            const employee = await User.create({
                personalDetails: {
                    email: 'testingforgetalltimesheetreport@gmail.com'
                },
                password: 'Password123',
                jobDetails: [{ jobTitle: 'webDeveloper' }],
                role: 'Manager'
            })
            userId = employee._id
            userJobId = employee.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'testingforgetalltimesheetreport@gmail.com', password: 'Password123' })
            expect(JSON.parse(login.text).status).toBe(200)
            SAToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/getTimesheetReport')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for , user not found', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ userId: userJobId })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        // test('should return 404 for, jobTitle not found', async () => {
        //     const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ jobId: userJobId })
        //     expect(JSON.parse(res.text).status).toBe(404)
        //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        // })
        test('should return 200 for, timesheet report got successfully', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Timesheet report fetched successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({ token: SAToken }, { $set: { role: 'superadmin' } })
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe("~ administrator can get all thier company's employees timesheet report by id", () => {
        let ADToken
        let userId
        let userJobId
        test('should return 401 for, unauthorized: Invalid API key', async () => {
            const user = await User.create({
                personalDetails: {
                    email: 'testingforgetalltimesheetreportadministrator@gmail.com'
                },
                password: 'Password123',
                role: 'Administrator'
            })
            const employee = await User.create({
                personalDetails: {
                    email: 'testingforgetalltimesheetreport@gmail.com'
                },
                password: 'Password123',
                jobDetails: [{ jobTitle: 'webDeveloper' }],
                role: 'Manager'
            })
            userId = employee._id
            userJobId = employee.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'testingforgetalltimesheetreportadministrator@gmail.com', password: 'Password123' })
            expect(JSON.parse(login.text).status).toBe(200)
            ADToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/getTimesheetReport')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for , user not found', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId: userJobId })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        // test('should return 404 for, jobTitle not found', async () => {
        //     const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ jobId: userJobId })
        //     expect(JSON.parse(res.text).status).toBe(404)
        //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        // })
        test('should return 200 for, timesheet report got successfully', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Timesheet report fetched successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({ token: ADToken }, { $set: { role: 'administrator' } })
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe("~ Manager can get all thier team member's timesheet report by id", () => {
        let MToken
        let userId
        let userJobId
        test('should return 401 for, unauthorized: Invalid API key', async () => {
            const user = await User.create({
                personalDetails: {
                    email: 'testingforgetalltimesheetreportmanager@gmail.com'
                },
                password: 'Password123',
                role: 'Manager'
            })
            const employee = await User.create({
                personalDetails: {
                    email: 'testingforgetalltimesheetreport@gmail.com'
                },
                password: 'Password123',
                jobDetails: [{ jobTitle: 'webDeveloper' }],
                role: 'Employee'
            })
            userId = employee._id
            userJobId = employee.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'testingforgetalltimesheetreportmanager@gmail.com', password: 'Password123' })
            expect(JSON.parse(login.text).status).toBe(200)
            MToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/getTimesheetReport')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for , user not found', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${MToken}`).send({ userId: userJobId })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        // test('should return 404 for, jobTitle not found', async () => {
        //     const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${MToken}`).send({ jobId: userJobId })
        //     expect(JSON.parse(res.text).status).toBe(404)
        //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        // })
        test('should return 200 for, timesheet report got successfully', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${MToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Timesheet report fetched successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({ token: MToken }, { $set: { role: 'administrator' } })
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${MToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe("~ Administrator, Manager and employee can get own timesheet report", () => {
        let EToken
        let userJobId
        test('should return 401 for, unauthorized: Invalid API key', async () => {
            const employee = await User.create({
                personalDetails: {
                    email: 'testingforgetalltimesheetreportemployee@gmail.com'
                },
                password: 'Password123',
                jobDetails: [{ jobTitle: 'webDeveloper' }],
                role: 'Employee'
            })
            userJobId = employee.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'testingforgetalltimesheetreportemployee@gmail.com', password: 'Password123' })
            expect(JSON.parse(login.text).status).toBe(200)
            EToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/getTimesheetReport')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for , user not found', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${EToken}`).send({ userId: userJobId })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        // test('should return 404 for, jobTitle not found', async () => {
        //     const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${EToken}`)
        //     expect(JSON.parse(res.text).status).toBe(404)
        //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        // })
        test('should return 200 for, timesheet report got successfully', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${EToken}`).send({ jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Timesheet report fetched successfully')
        })
        test('should return 403 for, access denied', async () => {
            await User.findOneAndUpdate({ token: EToken }, { $set: { role: 'administrator' } })
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${EToken}`).send({ jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })
})

describe('Get Users Details==================================================', () => {
    let token
    let userId
    test('should return 401 for Unauthorized: Invalid API key', async () => {
        const hashedPassword = await bcrypt.hash('Dimple@123', 10);
        let user = await User.create({
            personalDetails: {
                email: 'dimple@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
            role: 'Superadmin'
        });
        const userRes = await request(app)
            .post('/login')
            .send({
                email: 'dimple@example.com',
                password: 'Dimple@123',
            });
        userId = await (user._id).toString()
        expect(JSON.parse(userRes.text).status).toBe(200);
        expect(JSON.parse(userRes.text).message).toBe('User login successfully');
        expect(JSON.parse(userRes.text).user).toHaveProperty('token');
        token = JSON.parse(userRes.text).user.token
        const res = await request(app)
            .get('/getDetails')
        expect(JSON.parse(res.text).status).toBe(401);
        expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
    })
    test('should return 200 for Superadmin role', async () => {
        const res = await request(app).get('/getDetails').set('Authorization', `Bearer ${token}`);
        expect(JSON.parse(res.text).status).toBe(200);
    });
    test('should return 404 for non-existing user', async () => {
        const user = await User.findOne({ _id: userId })
        user.isDeleted = true
        await user.save()
        const res = await request(app)
            .get('/getDetails').set('Authorization', `Bearer ${token}`)
        expect(JSON.parse(res.text).status).toBe(404);
        expect(JSON.parse(res.text).message).toBe('User not found');
    })
    test('should return 403 for Access denied', async () => {
        const hashedPassword = await bcrypt.hash('Harry@123', 10);
        await User.create({
            personalDetails: {
                email: 'harry@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
            role: 'User'
        });
        const res = await request(app)
            .post('/login')
            .send({
                email: 'harry@example.com',
                password: 'Harry@123',
            });

        expect(JSON.parse(res.text).status).toBe(200);
        expect(JSON.parse(res.text).message).toBe('User login successfully');
        expect(JSON.parse(res.text).user).toHaveProperty('token');
        const res1 = await request(app).get('/getDetails').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
        expect(JSON.parse(res1.text).status).toBe(403);
        expect(JSON.parse(res1.text).message).toBe('Access denied');
    });
})

describe('Update user their profile details========================================================', () => {
    let token
    let userId
    test('Should return 401 for Unauthorized: Invalid API key', async () => {
        const hashedPassword = await bcrypt.hash('updateProfile@123', 10);
        let user = await User.create({
            personalDetails: {
                email: 'updateProfile@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
            role: 'Manager'
        });
        const userRes = await request(app)
            .post('/login')
            .send({
                email: 'updateProfile@example.com',
                password: 'updateProfile@123',
            });
        userId = await (user._id).toString()
        expect(JSON.parse(userRes.text).status).toBe(200);
        expect(JSON.parse(userRes.text).message).toBe('User login successfully');
        expect(JSON.parse(userRes.text).user).toHaveProperty('token');
        token = JSON.parse(userRes.text).user.token
        const res = await request(app)
            .post('/updateProfileDetails')
        expect(JSON.parse(res.text).status).toBe(401);
        expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
    })
    test('Should return 200 for details update successfully', async () => {
        const res = await request(app)
        .post('/updateProfileDetails')
        .set('Authorization', `Bearer ${token}`)
        .send({
            email: 'manager1@example.com',
        })
        expect(JSON.parse(res.text).status).toBe(200);
        expect(JSON.parse(res.text).message).toBe('Profile updated successfully.');
    })
    test('Should return 404 for non-existing user', async () => {
        const user = await User.findOne({ _id: userId })
        user.isDeleted = true
        await user.save()
        // console.log('user:', user)
        const res = await request(app)
            .post('/updateProfileDetails')
            .set('Authorization', `Bearer ${user.token}`)
        expect(JSON.parse(res.text).status).toBe(404);
        expect(JSON.parse(res.text).message).toBe('User not found');
    })    
    test('Should return 403 for Access denied', async () => {
        const user = await User.findOne({ _id: userId })
        user.isDeleted = false
        user.role = "managers"
        await user.save()
        // console.log('user:', user)
        const res = await request(app)
            .post('/updateProfileDetails')
            .set('Authorization', `Bearer ${user.token}`)
        expect(JSON.parse(res.text).status).toBe(403)
        expect(JSON.parse(res.text).message).toBe('Access denied')
    })
})

describe('get all Notifications========================================================', () => {
    describe('~ Superadmin', () => {
        let SAToken
        let SAID
        test('Should return 200 for get all notifications', async () => {
            await User.create({
                personalDetails: {
                    email: 'notificationsuperadmin@gmail.com'
                },
                password: 'notificationsuperadmin@123',
                role: 'Superadmin'
            })
            const login = await request(app).post('/login').send({ email: 'notificationsuperadmin@gmail.com', password: 'notificationsuperadmin@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            SAToken = await JSON.parse(login.text).user.token
            SAID = await JSON.parse(login.text).user._id
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${SAToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Notifications fetched successfully.')
        })
        test('Should return 403 for Access denied', async () => {
            const user = await User.findOne({ _id: SAID })
            user.role = 'superadmin'
            await user.save()
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${SAToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
        test('Should return 404 for non-existing superadmin', async () => {
            const user = await User.findOne({ _id: SAID })
            user.role = 'Superadmin'
            user.isDeleted = true
            await user.save()
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${SAToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
    })

    describe('~ Administrator', () => {
        let ADToken
        let ADID
        test('Should return 200 for get own companys employees notifications', async () => {
            await User.create({
                personalDetails: {
                    email: 'notificationadministrator@gmail.com'
                },
                password: 'notificationadministrator@123',
                role: 'Administrator'
            })
            const login = await request(app).post('/login').send({ email: 'notificationadministrator@gmail.com', password: 'notificationadministrator@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            ADToken = await JSON.parse(login.text).user.token
            ADID = await JSON.parse(login.text).user._id
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${ADToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Notifications fetched successfully.')
        })
        test('Should return 403 for Access denied', async () => {
            const user = await User.findOne({ _id: ADID })
            user.role = 'administrator'
            await user.save()
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${ADToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
        test('Should return 404 for non-existing administrator', async () => {
            const user = await User.findOne({ _id: ADID })
            user.role = 'Administrator'
            user.isDeleted = true
            await user.save()
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${ADToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
    })

    describe('~ Manager', () => {
        let MToken
        let MID
        test('Should return 200 for get their companys employees notifications', async () => {
            await User.create({
                personalDetails: {
                    email: 'notificationmanager@gmail.com'
                },
                password: 'notificationmanager@123',
                role: 'Manager'
            })
            const login = await request(app).post('/login').send({ email: 'notificationmanager@gmail.com', password: 'notificationmanager@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            MToken = await JSON.parse(login.text).user.token
            MID = await JSON.parse(login.text).user._id
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${MToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Notifications fetched successfully.')
        })
        test('Should return 403 for Access denied', async () => {
            const user = await User.findOne({ _id: MID })
            user.role = 'manager'
            await user.save()
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${MToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
        test('Should return 404 for non-existing manager', async () => {
            const user = await User.findOne({ _id: MID })
            user.role = 'Manager'
            user.isDeleted = true
            await user.save()
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${MToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
    })

    describe('~ Employee', () => {
        let EToken
        let EID
        test('Should return 200 for get all notifications', async () => {
            await User.create({
                personalDetails: {
                    email: 'notificationEmployee@gmail.com'
                },
                password: 'notificationEmployee@123',
                role: 'Employee'
            })
            const login = await request(app).post('/login').send({ email: 'notificationEmployee@gmail.com', password: 'notificationEmployee@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            EToken = await JSON.parse(login.text).user.token
            EID = await JSON.parse(login.text).user._id
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${EToken}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Notifications fetched successfully.')
        })
        test('Should return 403 for Access denied', async () => {
            const user = await User.findOne({ _id: EID })
            user.role = 'manager'
            await user.save()
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${EToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
        test('Should return 404 for non-existing employee', async () => {
            const user = await User.findOne({ _id: EID })
            user.role = 'Employee'
            user.isDeleted = true
            await user.save()
            const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${EToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
    })
})

describe('get notification by ID========================================================', () => {
    let userToken
    let userId
    let notiID
    test('Should return 200 for notification get successfully', async () => {
        await User.create({
            personalDetails: {
                email: 'getnotificationuser@example.com'
            },
            role: 'Superadmin',
            password: 'Password@123'
        })
        const user = await request(app).post('/login').send({ email: 'getnotificationuser@example.com', password: 'Password@123' })
        expect(JSON.parse(user.text).status).toBe(200)
        userToken = await JSON.parse(user.text).user.token
        userId = await JSON.parse(user.text).user._id
        const notification = await Notification.create({
            userName: 'userName',
            type: 'type',
            message: 'message',
            readBy : [{
                userId: JSON.parse(user.text).user._id,
                role: JSON.parse(user.text).user.role,
                isRead: false,
            }]
        })
        notiID = notification?._id
        const res = await request(app).get(`/getNotification/${notiID}`).set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(200)
    })
    test('Should return 404 for notification not found', async () => {
        await Notification.findOneAndDelete({ _id: notiID })
        const res = await request(app).get(`/getNotification/${notiID}`).set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(404)
        expect(JSON.parse(res.text).message).toBe('Notification not found.')

    })
    test('Should return 403 for Access denied', async () => {
        const user = await User.findOne({ _id: userId })
        user.role = 'manager'
        await user.save()
        const res = await request(app).get('/getNotifications').set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(403)
        expect(JSON.parse(res.text).message).toBe('Access denied')
    })
})

describe('read notification by ID========================================================', () => {
    let userToken
    let userId
    let notiID
    test('Should return 200 notification read successfully', async () => {
        await User.create({
            personalDetails: {
                email: 'readnotification@example.com'
            },
            role: 'Administrator',
            password: 'Password@123'
        })
        const user = await request(app).post('/login').send({ email: 'readnotification@example.com', password: 'Password@123' })
        expect(JSON.parse(user.text).status).toBe(200)
        userToken = await JSON.parse(user.text).user.token
        userId = await JSON.parse(user.text).user._id
        const notification = await Notification.create({
            userName: 'readnotification',
            type: 'read',
            message: 'message',
            readBy : [{
                userId,
                role: JSON.parse(user.text).user.role,
                isRead: false,
            }]
        })
        notiID = notification?._id
        const res = await request(app).get(`/readNotification/${notiID}`).set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(200)
    })
    test('Should return 404 notification not found', async () => {
        await Notification.findOneAndDelete({ _id: notiID })
        const res = await request(app).get(`/readNotification/${notiID}`).set('Authorization', `Bearer ${userToken}`)
        // console.log(res.text)
        expect(JSON.parse(res.text).status).toBe(404)
        expect(JSON.parse(res.text).message).toBe('Notification not found')
    })
    test('Should return 403 for Access denied', async () => {
        const user = await User.findOne({ _id: userId })
        user.role = 'manager'
        await user.save()
        const res = await request(app).get(`/readNotification/${notiID}`).set('Authorization', `Bearer ${userToken}`)
        expect(JSON.parse(res.text).status).toBe(403)
        expect(JSON.parse(res.text).message).toBe('Access denied')
    })
})

describe('leave management========================================================', () => {
    describe('Administrator', () => {
        let ADToken
        let userId
        let userJobId
        let LRId
        describe('~ add leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const user = await User.create({
                    personalDetails: {
                        email: 'administratorleaverequest@example.com'
                    },
                    jobDetails: [{jobTitle: 'tester', sickLeavesAllow: 10, leavesAllow: 10}, {jobTitle: 'tester2', sickLeavesAllow: 10, leavesAllow: 10}],
                    password: 'Password@123',
                    role: 'Administrator'
                })
                userId = user._id
                userJobId = user.jobDetails[0]._id
                const login = await request(app).post('/login').send({ email: 'administratorleaverequest@example.com', password: 'Password@123' })
                expect(JSON.parse(login.text).status).toBe(200)
                ADToken = await JSON.parse(login.text).user.token
                const res = await request(app).post('/leaveRequest')
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 400 for already weekend or holiday', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${ADToken}`)
                    .send({
                        leaveType: 'Casual',
                        jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-02',
                    })
                expect(JSON.parse(res.text).status).toBe(400)
                expect(JSON.parse(res.text).message).toBe('Selected leave period contains weekends or holidays, no leave required!')
            })
            test('should return 404 for jobTitle not found', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${ADToken}`)
                    .send({
                        leaveType: 'Casual',
                        // jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-05',
                    })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 200 for leave request successful', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${ADToken}`)
                    .send({
                        leaveType: 'Casual',
                        jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-05',
                    })
                    // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                LRId = JSON.parse(res.text).leaveRequest._id
            })
            test('should return 403 for access denied', async () => {
                const user = await User.findOne({ _id: userId })
                user.role = 'administrator'
                await user.save()
                const res = await request(app).post(`/leaveRequest`).set('Authorization', `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ get leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).get(`/getLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 403 for access denied', async () => {
                const res = await request(app).get(`/getLeaveRequest/${userId}`).set('Authorization', `Bearer ${ADToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
            test('should return 404 for leave request not found', async () => {
                const user = await User.findOne({ _id: userId })
                user.role = 'Administrator'
                await user.save()
                const res = await request(app).get(`/getLeaveRequest/${userId}`).set('Authorization', `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 200 for leave request got successfully', async () => {
                const res = await request(app).get(`/getLeaveRequest/${LRId}`).set('Authorization', `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave request fetched successfully.')
            })
        })
    
        describe('~ get own all leave requests', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for jobTitle not found', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 200 for leave requests got successfully', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${ADToken}`).send({ jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('All leave requests fetched successfully.')
            })
            test('should return 404 for user not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true } }
                )
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${ADToken}`).send({ jobId: 'non-existing-job-id' })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'administrator' } }
                )
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${ADToken}`).send({ jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ get all leave requests of their employee', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).get(`/getAllLeaveRequest`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 200 for leave requests got successfully', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'Administrator' } }
                )
                const res = await request(app).get(`/getAllLeaveRequest`).set(`Authorization`, `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('All leave requests fetched successfully.')
            })
            test('should return 403 access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'administrator' } }
                )
                const res = await request(app).get(`/getAllLeaveRequest`).set(`Authorization`, `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ update own leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for JobTitle not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Administrator' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${ADToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 404 for leave request not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Administrator' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${userId}`).set('Authorization', `Bearer ${ADToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 400 for Invalid date range', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${ADToken}`).send({ jobId: userJobId, reasonOfLeave: 'update leave reason' })
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(400)
                expect(JSON.parse(res.text).message).toBe('Invalid date range!')
            })
            test('should return 200 for leave request updated successfully', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${ADToken}`).send({ jobId: userJobId, startDate: '2025-03-05', reasonOfLeave: 'update leave reason' })
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave request updated successfully')
            })
            test('should return 403 for leave already approved or rejected', async () => {
                const LeaveRequest = await leaveRequest.create({
                    userId,
                    jobId: userJobId,
                    status: 'Approved',
                })
                const res = await request(app).post(`/updateLeaveRequest/${LeaveRequest._id}`).set('Authorization', `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Leave request has already been Approved.')
            })
            test('should return 403 access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'administrator' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set(`Authorization`, `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ delete own or their employees leave requests', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for leave request not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Administrator' } }
                )
                const res = await request(app).post(`/deleteLeaveRequest/${userId}`).set('Authorization', `Bearer ${ADToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 403 for leave already approved or rejected', async () => {
                const LeaveRequest = await leaveRequest.create({
                    userId,
                    jobId: userJobId,
                    status: 'Approved',
                })
                const res = await request(app).post(`/deleteLeaveRequest/${LeaveRequest._id}`).set('Authorization', `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Leave request has already been Approved.')
            })
            test('should return 200 for leave request deleted successfully', async () => {
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`).set('Authorization', `Bearer ${ADToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave reuqest deleted successfully.')
            })
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'administrator' } }
                )
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`).set('Authorization', `Bearer ${ADToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })
    })

    describe('Manager', () => {
        let MToken
        let userId
        let userJobId
        let LRId
        describe('~ add leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const user = await User.create({
                    personalDetails: {
                        email: 'managerleaverequest@example.com'
                    },
                    jobDetails: [{jobTitle: 'tester', sickLeavesAllow: 10, leavesAllow: 10}, {jobTitle: 'tester2', sickLeavesAllow: 10, leavesAllow: 10}],
                    password: 'Password@123',
                    role: 'Manager'
                })
                userId = user._id
                userJobId = user.jobDetails[0]._id
                const login = await request(app).post('/login').send({ email: 'managerleaverequest@example.com', password: 'Password@123' })
                expect(JSON.parse(login.text).status).toBe(200)
                MToken = await JSON.parse(login.text).user.token
                const res = await request(app).post('/leaveRequest')
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 400 for already weekend or holiday', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${MToken}`)
                    .send({
                        leaveType: 'Casual',
                        jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-02',
                    })
                expect(JSON.parse(res.text).status).toBe(400)
                expect(JSON.parse(res.text).message).toBe('Selected leave period contains weekends or holidays, no leave required!')
            })
            test('should return 404 for jobTitle not found', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${MToken}`)
                    .send({
                        leaveType: 'Casual',
                        // jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-05',
                    })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 200 for leave request successful', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${MToken}`)
                    .send({
                        leaveType: 'Casual',
                        jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-05',
                    })
                    // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                LRId = JSON.parse(res.text).leaveRequest._id
            })
            test('should return 403 for access denied', async () => {
                const user = await User.findOne({ _id: userId })
                user.role = 'manager'
                await user.save()
                const res = await request(app).post(`/leaveRequest`).set('Authorization', `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ get leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).get(`/getLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 403 for access denied', async () => {
                const res = await request(app).get(`/getLeaveRequest/${userId}`).set('Authorization', `Bearer ${MToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
            test('should return 404 for leave request not found', async () => {
                const user = await User.findOne({ _id: userId })
                user.role = 'Manager'
                await user.save()
                const res = await request(app).get(`/getLeaveRequest/${userId}`).set('Authorization', `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 200 for leave request got successfully', async () => {
                const res = await request(app).get(`/getLeaveRequest/${LRId}`).set('Authorization', `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave request fetched successfully.')
            })
        })
    
        describe('~ get own all leave requests', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for jobTitle not found', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 200 for leave requests got successfully', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${MToken}`).send({ jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('All leave requests fetched successfully.')
            })
            test('should return 404 for user not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true } }
                )
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${MToken}`).send({ jobId: 'non-existing-job-id' })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'manager' } }
                )
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${MToken}`).send({ jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ get all leave requests of their employee', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).get(`/getAllLeaveRequest`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 200 for leave requests got successfully', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'Manager' } }
                )
                const res = await request(app).get(`/getAllLeaveRequest`).set(`Authorization`, `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('All leave requests fetched successfully.')
            })
            test('should return 403 access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'manager' } }
                )
                const res = await request(app).get(`/getAllLeaveRequest`).set(`Authorization`, `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ update own leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for leave request not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Manager' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${userId}`).set('Authorization', `Bearer ${MToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 404 for jobtile not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Manager' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${MToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 400 for Invalid date range', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${MToken}`).send({ jobId: userJobId, reasonOfLeave: 'update leave reason' })
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(400)
                expect(JSON.parse(res.text).message).toBe('Invalid date range!')
            })
            test('should return 200 for leave request updated successfully', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${MToken}`).send({ jobId: userJobId, startDate: '2025-03-05', reasonOfLeave: 'update leave reason' })
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave request updated successfully')
            })
            test('should return 403 for leave already approved or rejected', async () => {
                const LeaveRequest = await leaveRequest.create({
                    userId,
                    jobId: userJobId,
                    status: 'Approved',
                })
                const res = await request(app).post(`/updateLeaveRequest/${LeaveRequest._id}`).set('Authorization', `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Leave request has already been Approved.')
            })
            test('should return 403 access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'manager' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set(`Authorization`, `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ delete own or their team member leave requests', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for leave request not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Manager' } }
                )
                const res = await request(app).post(`/deleteLeaveRequest/${userId}`).set('Authorization', `Bearer ${MToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 403 for leave already approved or rejected', async () => {
                const LeaveRequest = await leaveRequest.create({
                    userId,
                    jobId: userJobId,
                    status: 'Approved',
                })
                const res = await request(app).post(`/deleteLeaveRequest/${LeaveRequest._id}`).set('Authorization', `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Leave request has already been Approved.')
            })
            test('should return 200 for leave request deleted successfully', async () => {
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`).set('Authorization', `Bearer ${MToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave reuqest deleted successfully.')
            })
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'manager' } }
                )
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`).set('Authorization', `Bearer ${MToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })
    })

    describe('Employee', () => {
        let EToken
        let userId
        let userJobId
        let LRId
        describe('~ add leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const user = await User.create({
                    personalDetails: {
                        email: 'employeeleaverequest@example.com'
                    },
                    jobDetails: [{jobTitle: 'tester', sickLeavesAllow: 10, leavesAllow: 10}, {jobTitle: 'tester2', sickLeavesAllow: 10, leavesAllow: 10}],
                    password: 'Password@123',
                    role: 'Employee'
                })
                userId = user._id
                userJobId = user.jobDetails[0]._id
                const login = await request(app).post('/login').send({ email: 'employeeleaverequest@example.com', password: 'Password@123' })
                expect(JSON.parse(login.text).status).toBe(200)
                EToken = await JSON.parse(login.text).user.token
                const res = await request(app).post('/leaveRequest')
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 400 for already weekend or holiday', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${EToken}`)
                    .send({
                        leaveType: 'Casual',
                        jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-02',
                    })
                expect(JSON.parse(res.text).status).toBe(400)
                expect(JSON.parse(res.text).message).toBe('Selected leave period contains weekends or holidays, no leave required!')
            })
            test('should return 404 for jobTitle not found', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${EToken}`)
                    .send({
                        leaveType: 'Casual',
                        // jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-05',
                    })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 200 for leave request successful', async () => {
                const res = await request(app).post('/leaveRequest').set('Authorization', `Bearer ${EToken}`)
                    .send({
                        leaveType: 'Casual',
                        jobId: userJobId,
                        selectionDuration: 'Full-Day',
                        startDate: '2025-03-05',
                    })
                    // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                LRId = JSON.parse(res.text).leaveRequest._id
            })
            test('should return 403 for access denied', async () => {
                const user = await User.findOne({ _id: userId })
                user.role = 'employee'
                await user.save()
                const res = await request(app).post(`/leaveRequest`).set('Authorization', `Bearer ${EToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ get leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).get(`/getLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 403 for access denied', async () => {
                const res = await request(app).get(`/getLeaveRequest/${userId}`).set('Authorization', `Bearer ${EToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
            test('should return 404 for leave request not found', async () => {
                const user = await User.findOne({ _id: userId })
                user.role = 'Employee'
                await user.save()
                const res = await request(app).get(`/getLeaveRequest/${userId}`).set('Authorization', `Bearer ${EToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 200 for leave request got successfully', async () => {
                const res = await request(app).get(`/getLeaveRequest/${LRId}`).set('Authorization', `Bearer ${EToken}`)
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave request fetched successfully.')
            })
        })
    
        describe('~ get own all leave requests', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for jobTitle not found', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${EToken}`)
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 200 for leave requests got successfully', async () => {
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${EToken}`).send({ jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('All leave requests fetched successfully.')
            })
            test('should return 404 for user not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true } }
                )
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${EToken}`).send({ jobId: 'non-existing-job-id' })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'employee' } }
                )
                const res = await request(app).post(`/getAllOwnLeaves`).set('Authorization', `Bearer ${EToken}`).send({ jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ update own leave request', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for leave request not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Employee' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${userId}`).set('Authorization', `Bearer ${EToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 404 for jobTitle not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Employee' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${EToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            })
            test('should return 400 for Invalid date range', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${EToken}`).send({ jobId: userJobId, reasonOfLeave: 'update leave reason' })
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(400)
                expect(JSON.parse(res.text).message).toBe('Invalid date range!')
            })
            test('should return 200 for leave request updated successfully', async () => {
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set('Authorization', `Bearer ${EToken}`).send({ jobId: userJobId, startDate: '2025-03-05', reasonOfLeave: 'update leave reason' })
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave request updated successfully')
            })
            test('should return 403 for leave already approved or rejected', async () => {
                const LeaveRequest = await leaveRequest.create({
                    userId,
                    jobId: userJobId,
                    status: 'Approved',
                })
                const res = await request(app).post(`/updateLeaveRequest/${LeaveRequest._id}`).set('Authorization', `Bearer ${EToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Leave request has already been Approved.')
            })
            test('should return 403 access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'employee' } }
                )
                const res = await request(app).post(`/updateLeaveRequest/${LRId}`).set(`Authorization`, `Bearer ${EToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ delete own leave requests', () => {
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`)
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for leave request not found', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: false, role: 'Employee' } }
                )
                const res = await request(app).post(`/deleteLeaveRequest/${userId}`).set('Authorization', `Bearer ${EToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('Leave request not found')
            })
            test('should return 403 for leave already approved or rejected', async () => {
                const LeaveRequest = await leaveRequest.create({
                    userId,
                    jobId: userJobId,
                    status: 'Approved',
                })
                const res = await request(app).post(`/deleteLeaveRequest/${LeaveRequest._id}`).set('Authorization', `Bearer ${EToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Leave request has already been Approved.')
            })
            test('should return 200 for leave request deleted successfully', async () => {
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`).set('Authorization', `Bearer ${EToken}`)
                // console.log('res:', JSON.parse(res.text))
                expect(JSON.parse(res.text).status).toBe(200)
                expect(JSON.parse(res.text).message).toBe('Leave reuqest deleted successfully.')
            })
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $set: { isDeleted: true, role: 'employee' } }
                )
                const res = await request(app).post(`/deleteLeaveRequest/${LRId}`).set('Authorization', `Bearer ${EToken}`)
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })
    })

    describe('~ leave request approve and reject', () => {
        describe('Superadmin', () => {
            describe('~ approve leave request only administrator request', () => {
                let SAToken
                let userId
                let userJobId
                let LRId
                test('should return 401 for Unauthorized: Invalid API key', async () => {
                    await User.create({
                        personalDetails: {
                            email: 'superadmintestforleaveapprove@gmail.com'
                        },
                        password: 'Password123',
                        role: 'Superadmin'
                    })
                    const login = await request(app).post('/login').send({ email: 'superadmintestforleaveapprove@gmail.com', password: 'Password123' })
                    expect(JSON.parse(login.text).status).toBe(200)
                    SAToken = JSON.parse(login.text).user.token
                    const user = await User.create({
                        email: 'userfortestleaveapprove@gmail.com',
                        password: 'Password123',
                        jobDetails:[{
                            jobTitle: 'Software Engineer',
                        }]
                    })
                    userId = user._id
                    userJobId = user.jobDetails[0]._id
                    const LeaveReq = await leaveRequest.create({
                        userId: userId,
                        jobId: userJobId,
                        status: 'Pending',
                        leaves: [{
                            leaveDate: '2025-03-12',
                            leaveType: 'Full-Day',
                            isPaidLeave: true,
                            isHalfPaidLeave: false,
                            isApproved: false
                        }]
                    })
                    LRId = LeaveReq._id
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`)
                    expect(JSON.parse(res.text).status).toBe(401)
                    expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
                })
                test('should return 404 for leave request not found', async () => {
                    const res = await request(app).post(`/leaveRequestApprove/${userId}`).set('Authorization', `Bearer ${SAToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(404)
                    expect(JSON.parse(res.text).message).toBe('Leave request not found.')
                })
                test('should return 200 for leave request approved', async () => {
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`).set('Authorization', `Bearer ${SAToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(200)
                    expect(JSON.parse(res.text).message).toBe('Leave request approved.')
                })
                test('should return 403 for access denied', async () => {
                    await User.findOneAndUpdate(
                        { token: SAToken },
                        { $set: { isDeleted: false, role: 'superadmin' } }
                    )
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`).set('Authorization', `Bearer ${SAToken}`)
                    // console.log('res:', JSON.parse(res.text))
                    expect(JSON.parse(res.text).status).toBe(403)
                    expect(JSON.parse(res.text).message).toBe('Access denied')
                })
            })

            describe('~ reject leave request only administrator request', () => {
                let SAToken
                let userId
                let userJobId
                let LRId
                test('should return 401 for Unauthorized: Invalid API key', async () => {
                    await User.create({
                        personalDetails: {
                            email: 'superadmintestforleavereject@gmail.com'
                        },
                        password: 'Password123',
                        role: 'Superadmin'
                    })
                    const login = await request(app).post('/login').send({ email: 'superadmintestforleavereject@gmail.com', password: 'Password123' })
                    expect(JSON.parse(login.text).status).toBe(200)
                    SAToken = JSON.parse(login.text).user.token
                    const user = await User.create({
                        email: 'userfortestleavereject@gmail.com',
                        password: 'Password123',
                        jobDetails:[{
                            jobTitle: 'Software Engineer',
                        }]
                    })
                    userId = user._id
                    userJobId = user.jobDetails[0]._id
                    const LeaveReq = await leaveRequest.create({
                        userId: userId,
                        jobId: userJobId,
                        status: 'Pending',
                        leaves: [{
                            leaveDate: '2025-03-12',
                            leaveType: 'Full-Day',
                            isPaidLeave: true,
                            isHalfPaidLeave: false,
                            isApproved: false
                        }]
                    })
                    LRId = LeaveReq._id
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`)
                    expect(JSON.parse(res.text).status).toBe(401)
                    expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
                })
                test('should return 404 for leave request not found', async () => {
                    const res = await request(app).post(`/leaveRequestReject/${userId}`).set('Authorization', `Bearer ${SAToken}`)
                    expect(JSON.parse(res.text).status).toBe(404)
                    expect(JSON.parse(res.text).message).toBe('Leave request not found.')
                })
                test('should return 200 for leave request approved', async () => {
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`).set('Authorization', `Bearer ${SAToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(200)
                    expect(JSON.parse(res.text).message).toBe('Leave request rejected.')
                })
                test('should return 403 for access denied', async () => {
                    await User.findOneAndUpdate(
                        { token: SAToken },
                        { $set: { isDeleted: false, role: 'superadmin' } }
                    )
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`).set('Authorization', `Bearer ${SAToken}`)
                    // console.log('res:', JSON.parse(res.text))
                    expect(JSON.parse(res.text).status).toBe(403)
                    expect(JSON.parse(res.text).message).toBe('Access denied')
                })
            })
        })

        describe('Administrator', () => {
            describe('~ approve leave request only thier company employees', () => {
                let ADToken
                let userId
                let userJobId
                let LRId
                test('should return 401 for Unauthorized: Invalid API key', async () => {
                    await User.create({
                        personalDetails: {
                            email: 'administratortestforleaveapprove@gmail.com'
                        },
                        password: 'Password123',
                        role: 'Administrator'
                    })
                    const login = await request(app).post('/login').send({ email: 'administratortestforleaveapprove@gmail.com', password: 'Password123' })
                    expect(JSON.parse(login.text).status).toBe(200)
                    ADToken = JSON.parse(login.text).user.token
                    const user = await User.create({
                        email: 'userfortestleaveapprove@gmail.com',
                        password: 'Password123',
                        jobDetails:[{
                            jobTitle: 'Software Engineer',
                        }]
                    })
                    userId = user._id
                    userJobId = user.jobDetails[0]._id
                    const LeaveReq = await leaveRequest.create({
                        userId: userId,
                        jobId: userJobId,
                        status: 'Pending',
                        leaves: [{
                            leaveDate: '2025-03-12',
                            leaveType: 'Full-Day',
                            isPaidLeave: true,
                            isHalfPaidLeave: false,
                            isApproved: false
                        }]
                    })
                    LRId = LeaveReq._id
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`)
                    expect(JSON.parse(res.text).status).toBe(401)
                    expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
                })
                test('should return 404 for leave request not found', async () => {
                    const res = await request(app).post(`/leaveRequestApprove/${userId}`).set('Authorization', `Bearer ${ADToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(404)
                    expect(JSON.parse(res.text).message).toBe('Leave request not found.')
                })
                test('should return 200 for leave request approved', async () => {
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`).set('Authorization', `Bearer ${ADToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(200)
                    expect(JSON.parse(res.text).message).toBe('Leave request approved.')
                })
                test('should return 403 for access denied', async () => {
                    await User.findOneAndUpdate(
                        { token: ADToken },
                        { $set: { isDeleted: false, role: 'administrator' } }
                    )
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`).set('Authorization', `Bearer ${ADToken}`)
                    // console.log('res:', JSON.parse(res.text))
                    expect(JSON.parse(res.text).status).toBe(403)
                    expect(JSON.parse(res.text).message).toBe('Access denied')
                })
            })

            describe('~ reject leave request only thier company employees', () => {
                let ADToken
                let userId
                let userJobId
                let LRId
                test('should return 401 for Unauthorized: Invalid API key', async () => {
                    await User.create({
                        personalDetails: {
                            email: 'administratortestforleavereject@gmail.com'
                        },
                        password: 'Password123',
                        role: 'Administrator'
                    })
                    const login = await request(app).post('/login').send({ email: 'administratortestforleavereject@gmail.com', password: 'Password123' })
                    expect(JSON.parse(login.text).status).toBe(200)
                    ADToken = JSON.parse(login.text).user.token
                    const user = await User.create({
                        email: 'userfortestleavereject@gmail.com',
                        password: 'Password123',
                        jobDetails:[{
                            jobTitle: 'Software Engineer',
                        }]
                    })
                    userId = user._id
                    userJobId = user.jobDetails[0]._id
                    const LeaveReq = await leaveRequest.create({
                        userId: userId,
                        jobId: userJobId,
                        status: 'Pending',
                        leaves: [{
                            leaveDate: '2025-03-12',
                            leaveType: 'Full-Day',
                            isPaidLeave: true,
                            isHalfPaidLeave: false,
                            isApproved: false
                        }]
                    })
                    LRId = LeaveReq._id
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`)
                    expect(JSON.parse(res.text).status).toBe(401)
                    expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
                })
                test('should return 404 for leave request not found', async () => {
                    const res = await request(app).post(`/leaveRequestReject/${userId}`).set('Authorization', `Bearer ${ADToken}`)
                    expect(JSON.parse(res.text).status).toBe(404)
                    expect(JSON.parse(res.text).message).toBe('Leave request not found.')
                })
                test('should return 200 for leave request approved', async () => {
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`).set('Authorization', `Bearer ${ADToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(200)
                    expect(JSON.parse(res.text).message).toBe('Leave request rejected.')
                })
                test('should return 403 for access denied', async () => {
                    await User.findOneAndUpdate(
                        { token: ADToken },
                        { $set: { isDeleted: false, role: 'administrator' } }
                    )
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`).set('Authorization', `Bearer ${ADToken}`)
                    // console.log('res:', JSON.parse(res.text))
                    expect(JSON.parse(res.text).status).toBe(403)
                    expect(JSON.parse(res.text).message).toBe('Access denied')
                })
            })
        })

        describe('Manager', () => {
            describe('~ approve leave request only their team member', () => {
                let ADToken
                let userId
                let userJobId
                let LRId
                test('should return 401 for Unauthorized: Invalid API key', async () => {
                    await User.create({
                        personalDetails: {
                            email: 'managertestforleaveapprove@gmail.com'
                        },
                        password: 'Password123',
                        role: 'Manager'
                    })
                    const login = await request(app).post('/login').send({ email: 'managertestforleaveapprove@gmail.com', password: 'Password123' })
                    expect(JSON.parse(login.text).status).toBe(200)
                    ADToken = JSON.parse(login.text).user.token
                    const user = await User.create({
                        email: 'userfortestleaveapprove@gmail.com',
                        password: 'Password123',
                        jobDetails:[{
                            jobTitle: 'Software Engineer',
                        }]
                    })
                    userId = user._id
                    userJobId = user.jobDetails[0]._id
                    const LeaveReq = await leaveRequest.create({
                        userId: userId,
                        jobId: userJobId,
                        status: 'Pending',
                        leaves: [{
                            leaveDate: '2025-03-12',
                            leaveType: 'Full-Day',
                            isPaidLeave: true,
                            isHalfPaidLeave: false,
                            isApproved: false
                        }]
                    })
                    LRId = LeaveReq._id
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`)
                    expect(JSON.parse(res.text).status).toBe(401)
                    expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
                })
                test('should return 404 for leave request not found', async () => {
                    const res = await request(app).post(`/leaveRequestApprove/${userId}`).set('Authorization', `Bearer ${ADToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(404)
                    expect(JSON.parse(res.text).message).toBe('Leave request not found.')
                })
                test('should return 200 for leave request approved', async () => {
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`).set('Authorization', `Bearer ${ADToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(200)
                    expect(JSON.parse(res.text).message).toBe('Leave request approved.')
                })
                test('should return 403 for access denied', async () => {
                    await User.findOneAndUpdate(
                        { token: ADToken },
                        { $set: { isDeleted: false, role: 'manager' } }
                    )
                    const res = await request(app).post(`/leaveRequestApprove/${LRId}`).set('Authorization', `Bearer ${ADToken}`)
                    // console.log('res:', JSON.parse(res.text))
                    expect(JSON.parse(res.text).status).toBe(403)
                    expect(JSON.parse(res.text).message).toBe('Access denied')
                })
            })

            describe('~ reject leave request only their team member', () => {
                let ADToken
                let userId
                let userJobId
                let LRId
                test('should return 401 for Unauthorized: Invalid API key', async () => {
                    await User.create({
                        personalDetails: {
                            email: 'managertestforleavereject@gmail.com'
                        },
                        password: 'Password123',
                        role: 'Manager'
                    })
                    const login = await request(app).post('/login').send({ email: 'managertestforleavereject@gmail.com', password: 'Password123' })
                    expect(JSON.parse(login.text).status).toBe(200)
                    ADToken = JSON.parse(login.text).user.token
                    const user = await User.create({
                        email: 'userfortestleavereject@gmail.com',
                        password: 'Password123',
                        jobDetails:[{
                            jobTitle: 'Software Engineer',
                        }]
                    })
                    userId = user._id
                    userJobId = user.jobDetails[0]._id
                    const LeaveReq = await leaveRequest.create({
                        userId: userId,
                        jobId: userJobId,
                        status: 'Pending',
                        leaves: [{
                            leaveDate: '2025-03-12',
                            leaveType: 'Full-Day',
                            isPaidLeave: true,
                            isHalfPaidLeave: false,
                            isApproved: false
                        }]
                    })
                    LRId = LeaveReq._id
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`)
                    expect(JSON.parse(res.text).status).toBe(401)
                    expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
                })
                test('should return 404 for leave request not found', async () => {
                    const res = await request(app).post(`/leaveRequestReject/${userId}`).set('Authorization', `Bearer ${ADToken}`)
                    expect(JSON.parse(res.text).status).toBe(404)
                    expect(JSON.parse(res.text).message).toBe('Leave request not found.')
                })
                test('should return 200 for leave request approved', async () => {
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`).set('Authorization', `Bearer ${ADToken}`).send({ approvalReason: 'LR approved' })
                    expect(JSON.parse(res.text).status).toBe(200)
                    expect(JSON.parse(res.text).message).toBe('Leave request rejected.')
                })
                test('should return 403 for access denied', async () => {
                    await User.findOneAndUpdate(
                        { token: ADToken },
                        { $set: { isDeleted: false, role: 'manager' } }
                    )
                    const res = await request(app).post(`/leaveRequestReject/${LRId}`).set('Authorization', `Bearer ${ADToken}`)
                    // console.log('res:', JSON.parse(res.text))
                    expect(JSON.parse(res.text).status).toBe(403)
                    expect(JSON.parse(res.text).message).toBe('Access denied')
                })
            })
        })
    })

    describe('~ Administrator, Manager, Employee can get their allow leave count', () => {
        let userToken
        let userJobId
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const user = await User.create({
                personalDetails: {
                    email: 'testingforgetallowleavecount@gmail.com'
                },
                password: 'Password123',
                role: 'Manager',
                jobDetails:[{
                    jobTitle: 'Manager',
                    sickLeavesAllow: 12,
                    leavesAllow: 12,
                }]
            })
            userJobId = user?.jobDetails[0]?._id
            const login = await request(app).post('/login').send({ email: 'testingforgetallowleavecount@gmail.com', password: 'Password123' })
            userToken = JSON.parse(login.text).user.token
            const res = await request(app).post(`/getAllowLeaveCount`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for jobTitle not found', async () => {
            const res = await request(app).post(`/getAllowLeaveCount`).set('Authorization', `Bearer ${userToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        })
        test('should return 200 for leave count got successfully', async () => {
            const res = await request(app).post(`/getAllowLeaveCount`).set('Authorization', `Bearer ${userToken}`).send({ jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(200)
        })
        test('should return 404 for user not found', async () => {
            await User.findOneAndUpdate(
                { token: userToken },
                { $set: { isDeleted: true } }
            )
            const res = await request(app).post(`/getAllowLeaveCount`).set('Authorization', `Bearer ${userToken}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
    })
})

describe('~ timesheet report', () => {
    describe('~ superadmin can get users timesheet report', () => {
        let SAToken
        let userId
        let userJobId
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'superadmintestforgettimesheet@gmail.com'
                },
                password: 'Password123',
                role: 'Superadmin'
            })
            const user = await User.create({
                personalDetails: {
                    email: 'testinguserforgettimesheetreportbysuperadmin@gmail.com'
                },
                password: 'Password123',
                role: 'Employee',
                jobDetails:[{ jobTitle: 'Software Engineer' }],
            })
            userId = user._id
            userJobId = user.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'superadmintestforgettimesheet@gmail.com', password: 'Password123' })
            SAToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/getTimesheetReport')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for user not found', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ userId })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        // test('should return 404 for jobTitle not found', async () => {
        //     await User.findOneAndUpdate(
        //         { _id: userId },
        //         { $set: { isDeleted: false } }
        //     )
        //     const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ jobId: userJobId })
        //     expect(JSON.parse(res.text).status).toBe(404)
        //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        // })
        test('should return 200 for timesheet report got successfully', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ jobId: userJobId })
            // console.log('res:', res.text)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Timesheet report fetched successfully')
        })
        test('should return 403 for access denied', async () => {
            await User.findOneAndUpdate(
                { token: SAToken },
                { $set: { role: 'superadmin' } }
            )
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe("~ administartor and manager can get thier company employee's timesheet report", () => {
        let ADToken
        let userId
        let userJobId
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'administratortestforgettimesheet@gmail.com'
                },
                password: 'Password123',
                role: 'Administrator'
            })
            const user = await User.create({
                personalDetails: {
                    email: 'testinguserforgettimesheetreportbyadmin@gmail.com'
                },
                password: 'Password123',
                role: 'Employee',
                jobDetails:[{ jobTitle: 'Software Engineer' }],
            })
            userId = user._id
            userJobId = user.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'administratortestforgettimesheet@gmail.com', password: 'Password123' })
            ADToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/getTimesheetReport')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for user not found', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        // test('should return 404 for jobTitle not found', async () => {
        //     await User.findOneAndUpdate(
        //         { _id: userId },
        //         { $set: { isDeleted: false } }
        //     )
        //     const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ jobId: userJobId })
        //     expect(JSON.parse(res.text).status).toBe(404)
        //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        // })
        test('should return 200 for timesheet report got successfully', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Timesheet report fetched successfully')
        })
        test('should return 403 for access denied', async () => {
            await User.findOneAndUpdate(
                { token: ADToken },
                { $set: { role: 'administrator' } }
            )
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe("~ administartor, manager and employee can get own timesheet report", () => {
        let ADToken
        let userId
        let userJobId
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            const user = await User.create({
                personalDetails: {
                    email: 'administratorgetowntimesheetreport@gmail.com'
                },
                jobDetails:[{ jobTitle: 'Software Engineer' }],
                password: 'Password123',
                role: 'Administrator'
            })
            userId = user._id
            userJobId = user.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'administratorgetowntimesheetreport@gmail.com', password: 'Password123' })
            ADToken = JSON.parse(login.text).user.token
            const res = await request(app).post('/getTimesheetReport')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for user not found', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId: userJobId })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        // test('should return 404 for jobTitle not found', async () => {
        //     await User.findOneAndUpdate(
        //         { _id: userId },
        //         { $set: { isDeleted: false } }
        //     )
        //     const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ jobId: userJobId })
        //     expect(JSON.parse(res.text).status).toBe(404)
        //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        // })
        test('should return 200 for timesheet report got successfully', async () => {
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId, jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Timesheet report fetched successfully')
        })
        test('should return 403 for access denied', async () => {
            await User.findOneAndUpdate(
                { token: ADToken },
                { $set: { role: 'administrator' } }
            )
            const res = await request(app).post('/getTimesheetReport').set('Authorization', `Bearer ${ADToken}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('timesheet report download', () => {    
        describe("~ Superadmin can download timesheet report of all users", () => {
            let SAToken
            let userId
            let userJobId
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const company = await Company.create({
                    companyDetails: {
                        businessName: 'testingCompany'
                    }
                })
                const location = await Location.create({
                    companyId: company._id,
                    latitude: "12.121212",
                    longitude: "21.212121",
                    radius: "1000",
                    locationName: "second location",
                    ukviApproved: true
                })
                await User.create({
                    personalDetails: {
                        email: 'testingfordownloadtimesheetreportofuser@gmail.com'
                    },
                    jobDetails:[{ jobTitle: 'Software Engineer' }],
                    password: 'Password123',
                    role: 'Superadmin'
                })
                const user = await User.create({
                    personalDetails: {
                        email: 'testeruserfordownloadreport@gmail.com'
                    },
                    jobDetails:[{ jobTitle: 'Software Engineer', location: location._id }],
                    password: 'Password123',
                    role: 'Manager'
                })
                userId = user._id
                userJobId = user.jobDetails[0]._id
                const login = await request(app).post('/login').send({ email: 'testingfordownloadtimesheetreportofuser@gmail.com', password: 'Password123' })
                SAToken = JSON.parse(login.text).user.token
                const res = await request(app).post('/downloadTimesheetReport')
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ userId: userJobId })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            // test('should return 404 for jobTitle not found', async () => {
            //     const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ jobId: userJobId })
            //     expect(JSON.parse(res.text).status).toBe(404)
            //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            // })
            test('should return 200 for timesheet download successfully', async () => {
                const login = await request(app).post('/login').send({ email: 'testeruserfordownloadreport@gmail.com', password: 'Password123' })
                await request(app).post('/clockIn').set('Authorization', `Bearer ${JSON.parse(login.text).user.token}`).send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
                await request(app).post('/clockOut').set('Authorization', `Bearer ${JSON.parse(login.text).user.token}`).send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
                let startDate = moment().toDate().toISOString().split('T')[0]
                let endDate = moment().add(1, 'days').toDate().toISOString().split('T')[0]
                const res = await request(app).post('/downloadTimesheetReport')
                    .set('Authorization', `Bearer ${SAToken}`)
                    .send({ userId, jobId: userJobId, startDate, endDate, format: 'pdf' })
                    .buffer()
                    .parse((res, callback) => {
                        res.setEncoding('binary'); // Ensure response is treated as binary
                        let data = '';
                        res.on('data', (chunk) => (data += chunk));
                        res.on('end', () => callback(null, Buffer.from(data, 'binary')));
                    });
                    expect(res.status).toBe(200);
                    expect(res.body).toBeInstanceOf(Buffer);
            })
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate({token: SAToken}, {$set:{role:'superadmin'}})
                const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${SAToken}`).send({ userId, jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('~ Administrator and manager can download timesheet report of specific user', () => {
            let ADToken
            let userId
            let userJobId
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const company = await Company.create({
                    companyDetails: {
                        businessName: 'testingCompany'
                    }
                })
                const location = await Location.create({
                    companyId: company._id,
                    latitude: "12.121212",
                    longitude: "21.212121",
                    radius: "1000",
                    locationName: "second location",
                    ukviApproved: true
                })
                await User.create({
                    personalDetails: {
                        email: 'testingfordownloadtimesheetreportoftheiremployee@gmail.com'
                    },
                    jobDetails:[{ jobTitle: 'Software Engineer' }],
                    password: 'Password123',
                    role: 'Administrator'
                })
                const user = await User.create({
                    personalDetails: {
                        email: 'tester2userfordownloadreport@gmail.com'
                    },
                    jobDetails:[{ jobTitle: 'Software Engineer', location: location._id }],
                    password: 'Password123',
                    role: 'Manager'
                })
                userId = user._id
                userJobId = user.jobDetails[0]._id
                const login = await request(app).post('/login').send({ email: 'testingfordownloadtimesheetreportoftheiremployee@gmail.com', password: 'Password123' })
                ADToken = JSON.parse(login.text).user.token
                const res = await request(app).post('/downloadTimesheetReport')
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId: userJobId })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            // test('should return 404 for jobTitle not found', async () => {
            //     const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ jobId: userJobId })
            //     expect(JSON.parse(res.text).status).toBe(404)
            //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            // })
            test('should return 200 for timesheet download successfully', async () => {
                const login = await request(app).post('/login').send({ email: 'tester2userfordownloadreport@gmail.com', password: 'Password123' })
                await request(app).post('/clockIn').set('Authorization', `Bearer ${JSON.parse(login.text).user.token}`).send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
                await request(app).post('/clockOut').set('Authorization', `Bearer ${JSON.parse(login.text).user.token}`).send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
                let startDate = moment().toDate().toISOString().split('T')[0]
                let endDate = moment().add(1, 'days').toDate().toISOString().split('T')[0]
                const res = await request(app).post('/downloadTimesheetReport')
                    .set('Authorization', `Bearer ${ADToken}`)
                    .send({ userId, jobId: userJobId, startDate, endDate, format: 'pdf' })
                    .buffer()
                    .parse((res, callback) => {
                        res.setEncoding('binary'); // Ensure response is treated as binary
                        let data = '';
                        res.on('data', (chunk) => (data += chunk));
                        res.on('end', () => callback(null, Buffer.from(data, 'binary')));
                    });
                    expect(res.status).toBe(200);
                    expect(res.body).toBeInstanceOf(Buffer);
            }, 10000)
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate({token: ADToken}, {$set:{role:'administrator'}})
                const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${ADToken}`).send({ userId, jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })

        describe('Administratoe, Manager and employee can download own timesheet report', () => {
            let EToken
            let userId
            let userJobId
            test('should return 401 for Unauthorized: Invalid API key', async () => {
                const company = await Company.create({
                    companyDetails: {
                        businessName: 'testingCompany'
                    }
                })
                const location = await Location.create({
                    companyId: company._id,
                    latitude: "12.121212",
                    longitude: "21.212121",
                    radius: "1000",
                    locationName: "second location",
                    ukviApproved: true
                })
                const user = await User.create({
                    personalDetails: {
                        email: 'tester2userfordownloadreport@gmail.com'
                    },
                    jobDetails:[{ jobTitle: 'Software Engineer', location: location._id }],
                    password: 'Password123',
                    role: 'Employee'
                })
                userId = user._id
                userJobId = user.jobDetails[0]._id
                const login = await request(app).post('/login').send({ email: 'tester2userfordownloadreport@gmail.com', password: 'Password123' })
                EToken = JSON.parse(login.text).user.token
                const res = await request(app).post('/downloadTimesheetReport')
                expect(JSON.parse(res.text).status).toBe(401)
                expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
            })
            test('should return 404 for user not found', async () => {
                const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${EToken}`).send({ userId: userJobId })
                expect(JSON.parse(res.text).status).toBe(404)
                expect(JSON.parse(res.text).message).toBe('User not found')
            })
            // test('should return 404 for jobTitle not found', async () => {
            //     const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${EToken}`)
            //     expect(JSON.parse(res.text).status).toBe(404)
            //     expect(JSON.parse(res.text).message).toBe('JobTitle not found')
            // })
            test('should return 200 for timesheet download successfully', async () => {
                const login = await request(app).post('/login').send({ email: 'tester2userfordownloadreport@gmail.com', password: 'Password123' })
                await request(app).post('/clockIn').set('Authorization', `Bearer ${JSON.parse(login.text).user.token}`).send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
                await request(app).post('/clockOut').set('Authorization', `Bearer ${JSON.parse(login.text).user.token}`).send({
                    userId,
                    jobId: userJobId,
                    location: { latitude: 12.121212, longitude: 21.212121 }
                })
                let startDate = moment().toDate().toISOString().split('T')[0]
                let endDate = moment().add(1, 'days').toDate().toISOString().split('T')[0]
                const res = await request(app).post('/downloadTimesheetReport')
                    .set('Authorization', `Bearer ${EToken}`)
                    .send({ jobId: userJobId, startDate, endDate, format: 'pdf' })
                    .buffer()
                    .parse((res, callback) => {
                        res.setEncoding('binary'); // Ensure response is treated as binary
                        let data = '';
                        res.on('data', (chunk) => (data += chunk));
                        res.on('end', () => callback(null, Buffer.from(data, 'binary')));
                    });
                    expect(res.status).toBe(200);
                    expect(res.body).toBeInstanceOf(Buffer);
            })
            test('should return 403 for access denied', async () => {
                await User.findOneAndUpdate({token: EToken}, {$set:{role:'employee'}})
                const res = await request(app).post('/downloadTimesheetReport').set('Authorization', `Bearer ${EToken}`).send({ jobId: userJobId })
                expect(JSON.parse(res.text).status).toBe(403)
                expect(JSON.parse(res.text).message).toBe('Access denied')
            })
        })
    })
})

describe('~ Preview template and signed template for users==============================================', () => {
    describe('User can view their template', () => {
        let templateId
        let userId
        let userJobId
        let token
        test('Should return 401 for Unauthorized: Invalid API key', async () => {
            const company = await Company.create({
                companyDetails: {
                    businessName: 'testing Company for preview template'
                }
            })
            const template = await Template.create({
                templateName: 'Full-Time',
                template: 'https://res.cloudinary.com/dwerzoswa/raw/upload/v1741608413/Templates/zvl8nqpsfbqqcediwjp3.docx',
                templateFileName: 'Full-Time',
                isDeleted: true
            })
            templateId = template._id.toString()
            const user = await User.create({
                personalDetails: {
                    email: 'testforpreviewtemplate@example.com'
                },
                password: "AdminManager@Employee",
                jobDetails: [{
                    jobTitle: 'JOB 1',
                    role: 'Manager',
                    templateId: templateId,
                }],
                companyId: company?._id.toString(),
                role: 'Manager',
            })
            userId = user?._id
            userJobId = user?.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'testforpreviewtemplate@example.com', password: 'AdminManager@Employee' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = JSON.parse(login.text).user.token
            const res = await request(app).post('/previewTemplate')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })        
        test('Should return 404 for user not found', async () => {
            await User.findOneAndUpdate({ _id: userId }, { isDeleted: true })
            const res = await request(app).post('/previewTemplate').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        test('Should return 404 for JobTitle not found', async () => {
            await User.findOneAndUpdate({ _id: userId }, { isDeleted: false })
            const res = await request(app).post('/previewTemplate').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        })
        test('Should return 404 for Template not found', async () => {
            const res = await request(app).post('/previewTemplate').set('Authorization', `Bearer ${token}`).send({ jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Template not found')
        })
        test('Should return 200 for preview successfully', async () => {
            await Template.findOneAndUpdate({ _id: templateId }, { isDeleted: false })
            const res = await request(app).post('/previewTemplate').set('Authorization', `Bearer ${token}`).send({ jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(200)
        })
        test('Should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ _id: userId }, { role: 'manager' })
            const res = await request(app).post('/previewTemplate').set('Authorization', `Bearer ${token}`).send({ jobId: userJobId })
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('User can signed their template', () => {
        let userId
        let userJobId
        let token
        test('Should return 401 for Unauthorized: Invalid API key', async () => {
            const company = await Company.create({
                companyDetails: {
                    businessName: 'testing Company for signed template'
                }
            })
            const user = await User.create({
                personalDetails: {
                    email: 'testforsignedtemplate@example.com'
                },
                password: "AdminManager@Employee",
                jobDetails: [{
                    jobTitle: 'JOB 1',
                    role: 'Manager',
                }],
                companyId: company?._id.toString(),
                role: 'Manager',
            })
            userId = user?._id
            userJobId = user?.jobDetails[0]._id
            const login = await request(app).post('/login').send({ email: 'testforsignedtemplate@example.com', password: 'AdminManager@Employee' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = JSON.parse(login.text).user.token
            const res = await request(app).post('/signedTemplate')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 400 for template base64 stringis not defined', async () => {
            const res = await request(app).post('/signedTemplate').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(400)
            expect(JSON.parse(res.text).message).toBe('Please upload the template!')
        })
        test('Should return 404 for user nor found', async () => {
            await User.findOneAndUpdate({ _id: userId }, { isDeleted: true })
            const res = await request(app).post('/signedTemplate').set('Authorization', `Bearer ${token}`).send({ base64OfTemplate: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBAoAAAAAAA1ebVqWJXaW0QEAANEBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPgogIDxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9CiAgICAiYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UucmVsYXRpb25zaGlwcyt4bWwiIC8+CiAgPE92ZXJyaWRlIFBhcnROYW1lPSIvd29yZC9kb2N1bWVudC54bWwiIENvbnRlbnRUeXBlPQogICAgImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50Lm1haW4reG1sIi8+CiAgPE92ZXJyaWRlIFBhcnROYW1lPSIvd29yZC9hZmNodW5rLm1odCIgQ29udGVudFR5cGU9Im1lc3NhZ2UvcmZjODIyIi8+CjwvVHlwZXM+ClBLAwQKAAAAAAANXm1aAAAAAAAAAAAAAAAABgAAAF9yZWxzL1BLAwQKAAAAAAANXm1aD8Iv5UoBAABKAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNoaXBzIj4KICA8UmVsYXRpb25zaGlwCiAgICAgIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiCiAgICAgIFRhcmdldD0iL3dvcmQvZG9jdW1lbnQueG1sIiBJZD0iUjA5YzgzZmFmYzA2NzQ4OGUiIC8+CjwvUmVsYXRpb25zaGlwcz4KUEsDBAoAAAAAAA1ebVoAAAAAAAAAAAAAAAAFAAAAd29yZC9QSwMECgAAAAAADV5tWiI/IeAICAAACAgAABEAAAB3b3JkL2RvY3VtZW50LnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPHc6ZG9jdW1lbnQKICB4bWxuczp3PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvd29yZHByb2Nlc3NpbmdtbC8yMDA2L21haW4iCiAgeG1sbnM6bT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvbWF0aCIKICB4bWxuczpyPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzIgogIHhtbG5zOndwPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvZHJhd2luZ21sLzIwMDYvd29yZHByb2Nlc3NpbmdEcmF3aW5nIgogIHhtbG5zOmE9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9tYWluIgogIHhtbG5zOm5zNj0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3NjaGVtYUxpYnJhcnkvMjAwNi9tYWluIgogIHhtbG5zOmM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9jaGFydCIKICB4bWxuczpuczg9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9jaGFydERyYXdpbmciCiAgeG1sbnM6ZGdtPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvZHJhd2luZ21sLzIwMDYvZGlhZ3JhbSIKICB4bWxuczpwaWM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9waWN0dXJlIgogIHhtbG5zOm5zMTE9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9zcHJlYWRzaGVldERyYXdpbmciCiAgeG1sbnM6ZHNwPSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS9kcmF3aW5nLzIwMDgvZGlhZ3JhbSIKICB4bWxuczpuczEzPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTpleGNlbCIKICB4bWxuczpvPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTpvZmZpY2UiCiAgeG1sbnM6dj0idXJuOnNjaGVtYXMtbWljcm9zb2Z0LWNvbTp2bWwiCiAgeG1sbnM6dzEwPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTp3b3JkIgogIHhtbG5zOm5zMTc9InVybjpzY2hlbWFzLW1pY3Jvc29mdC1jb206b2ZmaWNlOnBvd2VycG9pbnQiCiAgeG1sbnM6b2R4PSJodHRwOi8vb3BlbmRvcGUub3JnL3hwYXRocyIKICB4bWxuczpvZGM9Imh0dHA6Ly9vcGVuZG9wZS5vcmcvY29uZGl0aW9ucyIKICB4bWxuczpvZHE9Imh0dHA6Ly9vcGVuZG9wZS5vcmcvcXVlc3Rpb25zIgogIHhtbG5zOm9kaT0iaHR0cDovL29wZW5kb3BlLm9yZy9jb21wb25lbnRzIgogIHhtbG5zOm9kZ209Imh0dHA6Ly9vcGVuZG9wZS5vcmcvU21hcnRBcnQvRGF0YUhpZXJhcmNoeSIKICB4bWxuczpuczI0PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9iaWJsaW9ncmFwaHkiCiAgeG1sbnM6bnMyNT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L2NvbXBhdGliaWxpdHkiCiAgeG1sbnM6bnMyNj0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L2xvY2tlZENhbnZhcyI+CiAgPHc6Ym9keT4KICAgIDx3OmFsdENodW5rIHI6aWQ9Imh0bWxDaHVuayIgLz4KICAgIDx3OnNlY3RQcj4KICAgICAgPHc6cGdTeiB3Onc9IjEyMjQwIiB3Omg9IjE1ODQwIiB3Om9yaWVudD0icG9ydHJhaXQiIC8+CiAgICAgIDx3OnBnTWFyIHc6dG9wPSIxNDQwIgogICAgICAgICAgICAgICB3OnJpZ2h0PSIxNDQwIgogICAgICAgICAgICAgICB3OmJvdHRvbT0iMTQ0MCIKICAgICAgICAgICAgICAgdzpsZWZ0PSIxNDQwIgogICAgICAgICAgICAgICB3OmhlYWRlcj0iNzIwIgogICAgICAgICAgICAgICB3OmZvb3Rlcj0iNzIwIgogICAgICAgICAgICAgICB3Omd1dHRlcj0iMCIvPgogICAgPC93OnNlY3RQcj4KICA8L3c6Ym9keT4KPC93OmRvY3VtZW50PgpQSwMECgAAAAAADV5tWtKR1wcZNgAAGTYAABAAAAB3b3JkL2FmY2h1bmsubWh0TUlNRS1WZXJzaW9uOiAxLjAKQ29udGVudC1UeXBlOiBtdWx0aXBhcnQvcmVsYXRlZDsKICAgIHR5cGU9InRleHQvaHRtbCI7CiAgICBib3VuZGFyeT0iLS0tLT1taHREb2N1bWVudFBhcnQiCgoKLS0tLS0tPW1odERvY3VtZW50UGFydApDb250ZW50LVR5cGU6IHRleHQvaHRtbDsKICAgIGNoYXJzZXQ9InV0Zi04IgpDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nOiBxdW90ZWQtcHJpbnRhYmxlCkNvbnRlbnQtTG9jYXRpb246IGZpbGU6Ly8vQzovZmFrZS9kb2N1bWVudC5odG1sCgo8aHRtbD4KICAgICAgICA8aGVhZD4KICAgICAgICAgICAgPHN0eWxlPgogICAgICAgICAgICAgICAgYm9keSB7IGJhY2tncm91bmQ6IHdoaXRlICFpbXBvcnRhbnQ7IH0KICAgICAgICAgICAgICAgIHRhYmxlLCB0aCwgdGQsIGRpdiwgcCwgc3BhbiB7IGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7IH0KICAgICAgICAgICAgPC9zdHlsZT4KICAgICAgICA8L2hlYWQ+CiAgICAgICAgPGJvZHk+CiAgICAgICAgICAgIDwhLS1kb2N4anMgbGlicmFyeSBwcmVkZWZpbmVkIHN0eWxlcy0tPjxzdHlsZT4KLmRvY3gtd3JhcHBlciB7IGJhY2tncm91bmQ6IGdyYXk7IHBhZGRpbmc6IDMwcHg7IHBhZGRpbmctYm90dG9tOiAwcHg7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZmxvdzogY29sdW1uOyBhbGlnbi1pdGVtczogY2VudGVyOyB9IAouZG9jeC13cmFwcGVyPnNlY3Rpb24uZG9jeCB7IGJhY2tncm91bmQ6IHdoaXRlOyBib3gtc2hhZG93OiAwIDAgMTBweCByZ2JhKDAsIDAsIDAsIDAuNSk7IG1hcmdpbi1ib3R0b206IDMwcHg7IH0KLmRvY3ggeyBjb2xvcjogYmxhY2s7IGh5cGhlbnM6IGF1dG87IHRleHQtdW5kZXJsaW5lLXBvc2l0aW9uOiBmcm9tLWZvbnQ7IH0Kc2VjdGlvbi5kb2N4IHsgYm94LXNpemluZzogYm9yZGVyLWJveDsgZGlzcGxheTogZmxleDsgZmxleC1mbG93OiBjb2x1bW4gbm93cmFwOyBwb3NpdGlvbjogcmVsYXRpdmU7IG92ZXJmbG93OiBoaWRkZW47IH0Kc2VjdGlvbi5kb2N4PmFydGljbGUgeyBtYXJnaW4tYm90dG9tOiBhdXRvOyB6LWluZGV4OiAxOyB9CnNlY3Rpb24uZG9jeD5mb290ZXIgeyB6LWluZGV4OiAxOyB9Ci5kb2N4IHRhYmxlIHsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgfQouZG9jeCB0YWJsZSB0ZCwgLmRvY3ggdGFibGUgdGggeyB2ZXJ0aWNhbC1hbGlnbjogdG9wOyB9Ci5kb2N4IHAgeyBtYXJnaW46IDBwdDsgbWluLWhlaWdodDogMWVtOyB9Ci5kb2N4IHNwYW4geyB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7IG92ZXJmbG93LXdyYXA6IGJyZWFrLXdvcmQ7IH0KLmRvY3ggYSB7IGNvbG9yOiBpbmhlcml0OyB0ZXh0LWRlY29yYXRpb246IGluaGVyaXQ7IH0KLmRvY3ggc3ZnIHsgZmlsbDogdHJhbnNwYXJlbnQ7IH0KPC9zdHlsZT48ZGl2IGNsYXNzPTNEImRvY3gtd3JhcHBlciI+PHNlY3Rpb24gY2xhc3M9M0QiZG9jeCIgc3R5bGU9M0Qid2lkdGg6IDU5NS41cHQ7IG1pbi1oZWlnaHQ6IDg0Mi4yNXB0OyI+PGFydGljbGU+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGNlbnRlcjsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAzMnB0OyBmb250LXNpemU6IDMycHQ7IHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lIHJnYigwLCAwLCAwKTsiPlRlbXBsYXRlPC9zcGFuPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAzMnB0OyBmb250LXNpemU6IDMycHQ7IHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lIHJnYigwLCAwLCAwKTsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDE0cHQ7IGZvbnQtc2l6ZTogMTRwdDsiPk5hbWUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkVtcGxveWVlIFNoYWg8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDE0cHQ7IGZvbnQtc2l6ZTogMTRwdDsiPkVtYWlsIDogPC9zcGFuPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij5mZW1pbGNoaGV0YS5zaHJlZXNvZnRpY2VAZ21haWwuY29tCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+Q29udGFjdCBOdW1iZXIgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjEyMzQ1Njc4OTAKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxNHB0OyBmb250LXNpemU6IDE0cHQ7Ij5Kb2luaW5nIERhdGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjIwMjQtMDEtMTUKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxNHB0OyBmb250LXNpemU6IDE0cHQ7Ij5Kb2IgVGl0bGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkpPQiAxCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+Sm9iIFJvbGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkVtcGxveWVlCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+V2Vla2x5IFdvcmtpbmcgSG91cnMgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjQwCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+QW5udWFsIFNhbGFyeSA6IDwvc3Bhbj48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+NTAwMDAKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxN3B0OyBmb250LXNpemU6IDE3cHQ7Ij5CZXN0IFJlZ2FyZHMsCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+SFJNUwo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPlNpZ25hdHVyZSA6IDwvc3Bhbj48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+PHNwYW4gc3R5bGU9M0QiZGlzcGxheTogaW5saW5lLWJsb2NrOyBib3JkZXItYm90dG9tOiAycHggc29saWQgYmxhY2s7IHdoaXRlLXNwYWNlOiBub3JtYWw7Ij4KICAgICAgICAgICAgPGltZyBzcmM9M0QiZmlsZTovLy9DOi9mYWtlL2ltYWdlMC5wbmciIHN0eWxlPTNEIndpZHRoOjEwMHB4OyBoZWlnaHQ6MzBweDsgcGFkZGluZy1sZWZ0OiAxNXB4OyBkaXNwbGF5OmlubGluZTsiPgogICAgICAgIDwvc3Bhbj4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuPjwvc3Bhbj48L3A+PGRpdiBzdHlsZT0zRCJkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IHBvc2l0aW9uOiByZWxhdGl2ZTsgdGV4dC1pbmRlbnQ6IDBweDsgd2lkdGg6IDE3NS42NXB0OyBoZWlnaHQ6IDg3LjgycHQ7Ij48aW1nIHNyYz0zRCJibG9iOmh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC81M2YxYzFmOS0xNGYyLTQwNzctYTFmZi01ZjZjYWE3MmY5NGIiIHN0eWxlPTNEInBvc2l0aW9uOiByZWxhdGl2ZTsgbGVmdDogMHB0OyB0b3A6IDBwdDsgd2lkdGg6IDE3NS42NXB0OyBoZWlnaHQ6IDg3LjgycHQ7Ij48L2Rpdj48cD48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+Cjwvc3Bhbj48L3A+PC9hcnRpY2xlPjwvc2VjdGlvbj48L2Rpdj4KICAgICAgICA8L2JvZHk+CiAgICA8L2h0bWw+CgotLS0tLS09bWh0RG9jdW1lbnRQYXJ0CkNvbnRlbnQtVHlwZTogaW1hZ2UvcG5nCkNvbnRlbnQtVHJhbnNmZXItRW5jb2Rpbmc6IGJhc2U2NApDb250ZW50LUxvY2F0aW9uOiBmaWxlOi8vL0M6L2Zha2UvaW1hZ2UwLnBuZwoKaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQVN3QUFBQmtDQVlBQUFBOEFRM0FBQUFBQVhOU1IwSUFyczRjNlFBQUQrWkpSRUZVZUY3dFhUM0lOVWNWUGtFdEJBdUZGSXIvWUdFaGFDQ2l3aWRxWjZHUVFrRUw4U2NSREdrU1FzQlVLaUlXQ1VRTE8wV3RUS0ZFQzFFUS8xRFFRakNDalNqNEZ5UklRSXRnVWdqeFBsLzI4WjczdkRPenM3dXo5ODdlZlJaZTduM3ZuWm1kZldibXVlZWNPZWZNTGFaTENBZ0JJYkFSQkc3WlNEL1ZUU0VnQklTQWliQTBDWVNBRU5nTUFpS3N6UXlWT2lvRWhJQUlTM05BQ0FpQnpTQWd3dHJNVUttalFrQUlpTEN1em9FYlp2WWpNM3ZXek80MnMwYzFSWVNBRU9nSEFSSFcxYkg0clptOVpmam9TVE43UlQ5RHBaNElBU0Vnd3JvNkI1NXovLzdGekY2dktTSUVoRUEvQ0lpd2ptUHhPalA3c3hzYVNWajl6RlAxUkFqY1JFQ0VkWndJSHpPenIwdkMwc29RQXYwaUlNSTZqczFuRG04L0c0WUtLaUZVUTExQ1FBaDBnSUFJNnpnSVB6V3pkNGN4ZWNETUh1NWduTlFGSVNBRXBCSmVtUU93WDhHT2hRdkdkNUQ1NDJaMm0yYUtFQkFDZlNBZ0NlczREbjZIOEJremUvSHcxY2NQUlBhTlBvWkx2UkFDKzBaQWhKVW1MRWhXOU1mNm1abUJ0R1RMMnZkYTBkTjNnSUFJSzAxWWtLaGd6NktLQ0dQODV6b1lMM1ZCQ093YUFSSFdjZmovWldZdkhmNzk5K0g5bHc3dnVXc0k2ZW85a3JKMnZWYjA4QjBnSU1KNmZoQ2kweWcrQXpiZUVDOWJWZ2NUVmwzWU53SWlyT1A0ZTNMQ3AvREJnbHBJWjFMWXNpQmw2UklDUXVCTUNJaXd5b1FGVmRBVG1SeEp6elJSZFZzaFFMVkhTRHlQUUhRY3BRb0lDUXRoTzdqa1NIcFVvVUhtVUtXMWU2b1ZkRElFSkdFZG9mYkVoRTlKV0ZBTFFXYTR2bTFtSHp6WjZQUjFJNURUUndmeXh2di9tdGtUQTJGQlhmNzU4RjRFMXRlNFhWUnZSRmpINFl5eGhONlY0ZTltOXFwaFFlNHQ1UXlKS3NaWjVoWUN5bjFUa3RkRjhVUTNEeVBDT2c2Rmw2VHdLWHl4SUdYaDJwc2RDeVFGUE41c1p2Zk9uSzNBRHBLWEpLNlpBS3JhZFFSRVdIbkM4cnVDWGwzY2t1R2QwaEZlYVcraTZvYm44eGZMZ3FoaUVEakxnWHhBNUg4ZFBualgwRzZ1ZkcyVUFCMTBJY1crNGJBeis5cWhmZDRILytMZXNjOWEwenREUUlSMWRjQ2phd1B4OFlUVnV6L1dGQlVPRHJML01MTi9Ga2dLQ0lFb29PYmxZaXFqZlNzdUk2OG1ranc5MlpHd3hwWWZTUXQ5RVhtTm9YV0IzNHV3cmc1cTNDbWtOT1h0V3owVFZpcW4xNUpwQzIvL0wwOVU2OUFIN0twR0V2cVBtZUh2MWlVZGNuVkJuZ2lYa3NyWkNOQXROQ1BDdWpwS3VaM0NMUkJXaWF5d3FIOWpacmNuaUNRM1Q3RWpDamVPT1lRQXNuckl6RDZ3OGlKNDJzeStjampsNk5NcjMwZk5kNEtBQ092cVFPUU03ejU5Y284U1ZpUmEybngrWW1aL3kwZzhOVk1RS3VQdnpld2pFNGdMR05MOW9lWWVMQU1WRDFreWNQMHUzSytrUHNLOTRrVlRicVN5MjBWQWhIVjk3THdkaTRiM25na3JKVmxCS3NKZnpoZ2VuL3JYWnZZZE03dW5JSUdWM0JYR2JGaXBGWUwrUFdobXVQY1VLZTZ4QTdIZEVScmMwa2JJZHRtaWc1NkxzTXFFaFcreEdDQXgwQStwTjI5M24yV2lka3Job05pbkRyNWxYdzFwYzhhSUorNzYxUnI0UVVqZlRiaElRS1Y3ZjZVQm5YR2QwVGFtR00vYVViK0FjaUtzNjRNWUpSWVExdHZON0Z0RDBaNElLNnF3cFNsSmx3UzROWXp0c0lFVW9HYW1KRFFTTjhvd1pDa25RZEV3enU5enBGUEtOMWJxQzlwRlFQclk4MXpBVXRVakFBRVIxdlY1RUVtQXpxUE0ydEJiTXIrU2hEV0ZwRklyWXVxdUkrOVhTbllJQW9KYXg0eXV2Qy9xb2g2ZFRlbThpajZrM0I2VW8yeUhIQ2JDU2c5NnpJT0ZVaVFzN3dFZmE0UHNzTUNRQ0JBcTBDbXlsTjR3cy91SGUySmhjOEhYU0ZLbEtVOTE3MU5tOXZKTVFlOUlPaVh2ZmEwcVdTdTU3WERwN3ZPUlJWanBjZmU3YmxpSVdKaFVoVW8ya3lqdFVHcVlzcGpQT1JPaDRzSEx2T1R0anY3QlJlS3REVG9LNG9Mdlc2M2pLSDRFN3B0b3BHL1FUVFhSQ3dJaXJQUkllTFdRRWd2dE5Ua0pLNVcxRkszM1RGcGo0VGlVb0Q1aFpxOEpVTFdhT3pYU0Z2ckIyTVJlMW83NmNRWUVXazI2TTNSOTlWdFNMUVJoNFc5TXd2S0VCWDhpcUlXVUhIcGFjQ0JqK0RYbHNpOVFvdlFaRjd4YkI0RnY3VW9Bck9CbytzcWczaTVWYlZlZktMckI2UkFRWWVXeEptRlJ5aGdqTExUazYyRDNDdi96UWp2blNFMHpKa1d4ZjA4ZWRrTi9PSkRGOXdJc1gwellzVFIzVHJkT2RhY0JBVTI2L0ZUd1VnV2tEcXFFSlJ1V0p5em1oR2Z5UDZxSGE1TVdkOWRnaTBwSlVTQ21uQkc5ZG1ISTk2a1dLWlZyaW9BSUt3OG5kdDkrTVh5TnVEckd4WlhjR2xKcGFLSnJ3QnFMZlV5S29wVDRCek9EdEZScjVNNmhJOStucHN0UWpkVWlJTUlxSTBXSnlSTldpWEE4T1hrYlQ4d0NVWEtOcUJrN1NsR3dSYVdjTjNQdUJyNGZTRy84cDhFK043WXI2UHYwWVRON3RLYVRLbk1UQVdBcng5WkdrMEdFVlVkWWlIZUR0enV1VWw1M3IwWjZLU1R1SUNKZzk1T0YvRktwWHBXa3FCb0hVWVRoM09rYWpsSVNGdGJuRDgvM3BrTUlEWUtldlJTbVBGVGxlZUkzVitnYWdrMExSZ3BzeGEybEVhMnMxNHdJcTR3dEpSSnY5OEVPNEcyWmFxVWc2YmpUVnJOemlEcVFvakR4UFlGdzU3SjJCeTE2NzB1bG03K20vRGpnUGNZSG1WRXhKdmlmZ2Vmejc2Q2FXUVJFV09YSlFadVVKNnpTYnQrSFhNemhPODNzbDZINVh6bEpEVi81dGpEWktVWGhGVzRSQ0Y4aE9hRjhMVUg1MjBicERrbjU0SHlwcXc0QkVoUmVvZkpEY3NLbGZQVjErRFV0SmNJcXc1bnlQMEtOSEc1ZWtrbEpNWmowTWFnWVpJanNDVndZSkNqK2FrOUp2Wko2R2g5bWRDN1hpcWFUZHFYR2lEL1ZPSjlYbmxMVDByRllxZXY3YVZhRVZSN3JYRGFFbk5Oa2pyQzhxOEY3ZzVTRkhpRGtCTDVQclgrMS9TYUF5T280MXA2Y1FFejRjWUJxUndsV3hOUXBCNHF3eWdPVEM3ZXBJU3lvWHZSMjkybGErR3NkUDF2RFA4dExWNzFsbVRqRmtvakVoSHZTenRSS2dqM0ZjK2dlQXdJaXJQR3BFRS9TUVkyNEE0Z0VmN2p1R2c1Y1phdmNYY09ydHorbFZNT2xyZzd4U2ZZb1hYbEpsc1NFMTl6Ulp1T2pyeEpkSVNEQ0doK09GR0dCWExnNGZBdmUvV0VzMWk1S2J5MVZ0dGoycFVwWDlFR0RPb2NMR0VKeTRnL0YrT2lxeEtZUUVHR05EOWNQRG5uSFlYZUtsM2ZPOUF2a3VhSGdHR0doV1BTQ2IzWEFoWGNRYlVtRTQyaXRVNEk3cUhUeG9Gb05jcEtQMHpxWWQ5bXFDT3Y2c0pRY05GazZSMFplc3FuQkZ1VjlQcWdXNUJLbHF5MzVYSG1iRTZVbXFuWlM2N3Fra05OMnFtWlJuYlpINTdsYnlrR1RweDIvemN5UWRkTmZOWVJWSTJHaHpWUks1aVZTZzVldW9LSys0enlRVnQzVjI1eDhDQXZKU2J0MVZURHVwOUJlQ1lzNW9mQktCMDJRUk9wWC9GNHplNlNTc0ZEc21TRzBCVVJSdStCODBEVENZbDQyY3dwR3Y3RldLdWJNN3Z5L0dsVTZlb1pMYWxxSzZFN3I3NFd3dkFjNXcxeThnMlpKb3ZIZTY1d21PVFZycWtySTlsQVB0ckkzRGgvTU5aTEhEWUp6alMrTjRVeTNES3psUnJCVGttbjUyT2VhMEMyZklkY1dnMUR4NnIzSUVWb3h4VUV6NVl1Vmsxem1FaGFld2RlRlpBWlNySlhRVUQ5S1YzTkpyM1pzb21jNFhEdElUUElNcjBWUjVTWWhjRW1FNWFVby9zTG4wcXlVUU1MT0hTNmVlRE9Yc0dwdFdMNHZmdGR3YXQ2c21NSm16djF6dUhpVmptVzhaemcrbTBLdWt5YXBDZ3NCSXJCMXdpSkpSU2tLaTMzT0VWdGVTdkVwVzN6V1VHQlhJMkhOSVl5NGExaHJnNHJTMVJJblZFOU9QcDZPT1oxRVRPS1BzeUd3UmNJaVNmbjB2N1JIelNFcEQzNUtta0x1cWhlR0VhcXhZYzBocktqYTFibzVSTnRWclN1RFQvdE1nN2gyNk02MkhIWGpNUVMyUWxpUnBPYW9lbU5ZOFBzVUlmcTZKUkx4aEZkTEdxbCtlZlZ1ekJhVms2NjRFMGZYQWZUYmt4THVPOFdXVjR1ZnlnbUIxUkRvbWJCUzZoNlBvRm9xU2RVQW1zdlVVQ0tpc2ZReU5mZEZtU2tHK0hoNEt6QkNQK2ltNFRjY3BNN1Zqb0RLZFlsQWI0UkZhY0RuS20rbDdzMFpBTnFVWG4xSUgveUNvWUVTWnA2dzVxcUU3S2VYc21pVDhvNldlSSswelhTRlFEM2thUCtDSktjNVE2MDZXMENnRjhLS2gzdFM1Zk9IZVo0YlQ5cUpTa1RVUWlXazBmdjJJZGJ3SllrSForemkrOHpzVnZmOVVwSThOOGE2dnhBb0luQnV3a3J0eXZWRVVoNDhFbFlybGRCTFM3alAyTWsxeUV6Nm9BdjJiYmt6cUdVaUJEYUJ3RGtJQzc1R1BpUUdSdVV0Uk4xVFJTdTVHcVJVd3FqRzhmL1VCRW5sejNyTXpPNFlDdnQ3citsM3RZbkpxMDd1RDRGVEVSWkppbGsydDBKU2ZrYlFxVE8zYXdjaXdtR3JEdzJWZkc2c0hEbVJvRXFIUzBRRGZPcEU2U1YrVi91YjlYcml6U0t3Sm1IRjBCanVXaTNKUkhCT29Dazk0VnpDN3g4T2syQ2NIRzFPcGI0eFZBVWJDSE5PdnZIQjBRK1kyVDNoMks4bExoVG54RlQzRmdLVEVHaEpXRnk0aUNuekRvbHp2YzRuUFVqanduUUZZT3JqTWZ0UzZ2Ykk2YzZESlpaMkwrWFF5amFuaHZBczdZdnFDNEd6SWJDVXNHaVB3Y0xHb3FZa0FjTjU3NUlVU1FuOWhyVEVaK0huWTROQ255WStKejNFWVp6SDFYckhMdHFzMkQ5SlYyTWpwZTh2Qm9HNWhCVVQzdEZYcXJjZFBwSVBQYndwQmZvVGE4WUcweE1UY21NaGYxYk5xVG10Q1N0S1dlZ1hqUENNOFJ0N0RuMHZCRGFQUUMxaDVSdzZwNlpxV1FNd2toQmVLU21WZHVKeWZZZ1NVMnJua3E0TmF3VS9qK0Z6dzh6dVArd2FQajR6dUh1c2ZYMHZCTHBHWUl5d0dCN0RRR01zYW9URm5FUGRZMThBNkJ4SkNmVklTajZHYm9wVU9PYmFnSDc5Y1FpV2JpMWhkVDJSMURraGNBb0VVb1JGWW1ES2xsTjZuWE5uMFV0TnRUWWxqeGNKQ1gzbnNVKzByeTNCbGJ0MU9UZUNWckdFUy9xb3VrTGdZaEdJaEJVUDM4VENiQjFvekJURmM5VTNTa2srcStXcHpxS2pkM21Pc0x6M2VXMHVxNHVkWEhvd0lkQWFBVTlZbEI1YUdITlQzdDAxL2twNHZxZk43S25oUWIzcTFrTk9jQkpTenBWQWhOVjZocW85SWVBUThJU0ZBMENmTmJPN3c4bTVJQnFmbG9RN2JGVFZwa2hLSmVtSTNXcWh1cTAxeUZUNWNqbXhSRmhySWE5MmhjQkIzZk9FaGFPc3NHMC85L0trNXRVMXROZURkRFQzdVdLOTBzbk9JcXhXS0tzZElaQkFJTnF3dlB1Q0w0N1B2YjhQQ0lqWDNuSjlsOUxNZU1JYXl4U3FDU2tFaE1CRUJNYmNHaVkydDR2aUpkY0dUMWdLU043RmROQkRuaElCRWRaMHRMazVrZG9GOUx1c0lxenAyS3FHRUNnaUlNS2FQa0ZLYVdhOGhLV2c1T25ZcW9ZUUVHRTFuZ1BjS1V4SlVDS3N4bUNyT1NIZ0VaQ0VOWDArMUJLV1ZNTHAyS3FHRUpDRTFYZ09NR3ZDRTJhRzAzVDhKUnRXWTdEVm5CQ1FoTFY4RHRBWHF4VGFKQWxyT2M1cVFRaGNRVUFxNGJ3SlFkZUdtSkZCYmczejhGUXRJVkNGZ0FpckNxWnJoZWc4R3ZHVDQrZzhQRlZMQ0ZRaElNS3FnaWxMV0NVSlM1N3U4N0JWTFNHUVJVQ0VOVzl5NUNRc2IzVEhJUlQzeld0ZXRZU0FFRWdoSU1LYU55OXlSbmQvNk9uWHpPeXVlYzJybGhBUUFpS3Nkbk1nbDdIQm54OG9sYkFkM21wSkNOeEVRQkxXOUluZ1Q2K0pOaXgvRkpkQ2M2WmpxeHBDb0lpQUNHdjZCQ2tSbHBld1JGalRzVlVOSVNEQ1dtRU81STc3OG9TVnkwcTZRbmZVcEJEWUJ3S1NzT2FOTTFXL1NFcWVzS1J5ejhOV3RZUkFGZ0VSMXJ6SmdWVFNTQ21OeXg4Vkg0K1RGNzd6OEZVdElaQkVRQXRxM3NTQUhRdmt4QU02UUZxUXRxZ3FvbFdwaFBPd1ZTMGhJQWxyaFRuZ3czQkFUajgyc3p2ZGZSVDh2QUxvYW5MZkNFakNXamIrM3JNOXRxU0RWSmRocTlwQzRCb0NJcXpsa3lKRlduSnBXSTZyV2hBQzF4RDRIOUtlbEpMV0owemhBQUFBQUVsRlRrU3VRbUNDCgoKLS0tLS0tPW1odERvY3VtZW50UGFydC0tClBLAwQKAAAAAAANXm1aAAAAAAAAAAAAAAAACwAAAHdvcmQvX3JlbHMvUEsDBAoAAAAAAA1ebVpZIVOaMgEAADIBAAAcAAAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsczw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+CiAgPFJlbGF0aW9uc2hpcCBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL2FGQ2h1bmsiCiAgICBUYXJnZXQ9Ii93b3JkL2FmY2h1bmsubWh0IiBJZD0iaHRtbENodW5rIiAvPgo8L1JlbGF0aW9uc2hpcHM+ClBLAQIUAAoAAAAAAA1ebVqWJXaW0QEAANEBAAATAAAAAAAAAAAAAAAAAAAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQACgAAAAAADV5tWgAAAAAAAAAAAAAAAAYAAAAAAAAAAAAQAAAAAgIAAF9yZWxzL1BLAQIUAAoAAAAAAA1ebVoPwi/lSgEAAEoBAAALAAAAAAAAAAAAAAAAACYCAABfcmVscy8ucmVsc1BLAQIUAAoAAAAAAA1ebVoAAAAAAAAAAAAAAAAFAAAAAAAAAAAAEAAAAJkDAAB3b3JkL1BLAQIUAAoAAAAAAA1ebVoiPyHgCAgAAAgIAAARAAAAAAAAAAAAAAAAALwDAAB3b3JkL2RvY3VtZW50LnhtbFBLAQIUAAoAAAAAAA1ebVrSkdcHGTYAABk2AAAQAAAAAAAAAAAAAAAAAPMLAAB3b3JkL2FmY2h1bmsubWh0UEsBAhQACgAAAAAADV5tWgAAAAAAAAAAAAAAAAsAAAAAAAAAAAAQAAAAOkIAAHdvcmQvX3JlbHMvUEsBAhQACgAAAAAADV5tWlkhU5oyAQAAMgEAABwAAAAAAAAAAAAAAAAAY0IAAHdvcmQvX3JlbHMvZG9jdW1lbnQueG1sLnJlbHNQSwUGAAAAAAgACADhAQAAz0MAAAAA" })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('User not found')
        })
        test('Should return 404 for jobTitle not found', async () => {
            await User.findOneAndUpdate({ _id: userId }, { isDeleted: false })
            const res = await request(app).post('/signedTemplate').set('Authorization', `Bearer ${token}`).send({ base64OfTemplate: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBAoAAAAAAA1ebVqWJXaW0QEAANEBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPgogIDxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9CiAgICAiYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UucmVsYXRpb25zaGlwcyt4bWwiIC8+CiAgPE92ZXJyaWRlIFBhcnROYW1lPSIvd29yZC9kb2N1bWVudC54bWwiIENvbnRlbnRUeXBlPQogICAgImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50Lm1haW4reG1sIi8+CiAgPE92ZXJyaWRlIFBhcnROYW1lPSIvd29yZC9hZmNodW5rLm1odCIgQ29udGVudFR5cGU9Im1lc3NhZ2UvcmZjODIyIi8+CjwvVHlwZXM+ClBLAwQKAAAAAAANXm1aAAAAAAAAAAAAAAAABgAAAF9yZWxzL1BLAwQKAAAAAAANXm1aD8Iv5UoBAABKAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNoaXBzIj4KICA8UmVsYXRpb25zaGlwCiAgICAgIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiCiAgICAgIFRhcmdldD0iL3dvcmQvZG9jdW1lbnQueG1sIiBJZD0iUjA5YzgzZmFmYzA2NzQ4OGUiIC8+CjwvUmVsYXRpb25zaGlwcz4KUEsDBAoAAAAAAA1ebVoAAAAAAAAAAAAAAAAFAAAAd29yZC9QSwMECgAAAAAADV5tWiI/IeAICAAACAgAABEAAAB3b3JkL2RvY3VtZW50LnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPHc6ZG9jdW1lbnQKICB4bWxuczp3PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvd29yZHByb2Nlc3NpbmdtbC8yMDA2L21haW4iCiAgeG1sbnM6bT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvbWF0aCIKICB4bWxuczpyPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzIgogIHhtbG5zOndwPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvZHJhd2luZ21sLzIwMDYvd29yZHByb2Nlc3NpbmdEcmF3aW5nIgogIHhtbG5zOmE9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9tYWluIgogIHhtbG5zOm5zNj0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3NjaGVtYUxpYnJhcnkvMjAwNi9tYWluIgogIHhtbG5zOmM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9jaGFydCIKICB4bWxuczpuczg9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9jaGFydERyYXdpbmciCiAgeG1sbnM6ZGdtPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvZHJhd2luZ21sLzIwMDYvZGlhZ3JhbSIKICB4bWxuczpwaWM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9waWN0dXJlIgogIHhtbG5zOm5zMTE9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9zcHJlYWRzaGVldERyYXdpbmciCiAgeG1sbnM6ZHNwPSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS9kcmF3aW5nLzIwMDgvZGlhZ3JhbSIKICB4bWxuczpuczEzPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTpleGNlbCIKICB4bWxuczpvPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTpvZmZpY2UiCiAgeG1sbnM6dj0idXJuOnNjaGVtYXMtbWljcm9zb2Z0LWNvbTp2bWwiCiAgeG1sbnM6dzEwPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTp3b3JkIgogIHhtbG5zOm5zMTc9InVybjpzY2hlbWFzLW1pY3Jvc29mdC1jb206b2ZmaWNlOnBvd2VycG9pbnQiCiAgeG1sbnM6b2R4PSJodHRwOi8vb3BlbmRvcGUub3JnL3hwYXRocyIKICB4bWxuczpvZGM9Imh0dHA6Ly9vcGVuZG9wZS5vcmcvY29uZGl0aW9ucyIKICB4bWxuczpvZHE9Imh0dHA6Ly9vcGVuZG9wZS5vcmcvcXVlc3Rpb25zIgogIHhtbG5zOm9kaT0iaHR0cDovL29wZW5kb3BlLm9yZy9jb21wb25lbnRzIgogIHhtbG5zOm9kZ209Imh0dHA6Ly9vcGVuZG9wZS5vcmcvU21hcnRBcnQvRGF0YUhpZXJhcmNoeSIKICB4bWxuczpuczI0PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9iaWJsaW9ncmFwaHkiCiAgeG1sbnM6bnMyNT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L2NvbXBhdGliaWxpdHkiCiAgeG1sbnM6bnMyNj0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L2xvY2tlZENhbnZhcyI+CiAgPHc6Ym9keT4KICAgIDx3OmFsdENodW5rIHI6aWQ9Imh0bWxDaHVuayIgLz4KICAgIDx3OnNlY3RQcj4KICAgICAgPHc6cGdTeiB3Onc9IjEyMjQwIiB3Omg9IjE1ODQwIiB3Om9yaWVudD0icG9ydHJhaXQiIC8+CiAgICAgIDx3OnBnTWFyIHc6dG9wPSIxNDQwIgogICAgICAgICAgICAgICB3OnJpZ2h0PSIxNDQwIgogICAgICAgICAgICAgICB3OmJvdHRvbT0iMTQ0MCIKICAgICAgICAgICAgICAgdzpsZWZ0PSIxNDQwIgogICAgICAgICAgICAgICB3OmhlYWRlcj0iNzIwIgogICAgICAgICAgICAgICB3OmZvb3Rlcj0iNzIwIgogICAgICAgICAgICAgICB3Omd1dHRlcj0iMCIvPgogICAgPC93OnNlY3RQcj4KICA8L3c6Ym9keT4KPC93OmRvY3VtZW50PgpQSwMECgAAAAAADV5tWtKR1wcZNgAAGTYAABAAAAB3b3JkL2FmY2h1bmsubWh0TUlNRS1WZXJzaW9uOiAxLjAKQ29udGVudC1UeXBlOiBtdWx0aXBhcnQvcmVsYXRlZDsKICAgIHR5cGU9InRleHQvaHRtbCI7CiAgICBib3VuZGFyeT0iLS0tLT1taHREb2N1bWVudFBhcnQiCgoKLS0tLS0tPW1odERvY3VtZW50UGFydApDb250ZW50LVR5cGU6IHRleHQvaHRtbDsKICAgIGNoYXJzZXQ9InV0Zi04IgpDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nOiBxdW90ZWQtcHJpbnRhYmxlCkNvbnRlbnQtTG9jYXRpb246IGZpbGU6Ly8vQzovZmFrZS9kb2N1bWVudC5odG1sCgo8aHRtbD4KICAgICAgICA8aGVhZD4KICAgICAgICAgICAgPHN0eWxlPgogICAgICAgICAgICAgICAgYm9keSB7IGJhY2tncm91bmQ6IHdoaXRlICFpbXBvcnRhbnQ7IH0KICAgICAgICAgICAgICAgIHRhYmxlLCB0aCwgdGQsIGRpdiwgcCwgc3BhbiB7IGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7IH0KICAgICAgICAgICAgPC9zdHlsZT4KICAgICAgICA8L2hlYWQ+CiAgICAgICAgPGJvZHk+CiAgICAgICAgICAgIDwhLS1kb2N4anMgbGlicmFyeSBwcmVkZWZpbmVkIHN0eWxlcy0tPjxzdHlsZT4KLmRvY3gtd3JhcHBlciB7IGJhY2tncm91bmQ6IGdyYXk7IHBhZGRpbmc6IDMwcHg7IHBhZGRpbmctYm90dG9tOiAwcHg7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZmxvdzogY29sdW1uOyBhbGlnbi1pdGVtczogY2VudGVyOyB9IAouZG9jeC13cmFwcGVyPnNlY3Rpb24uZG9jeCB7IGJhY2tncm91bmQ6IHdoaXRlOyBib3gtc2hhZG93OiAwIDAgMTBweCByZ2JhKDAsIDAsIDAsIDAuNSk7IG1hcmdpbi1ib3R0b206IDMwcHg7IH0KLmRvY3ggeyBjb2xvcjogYmxhY2s7IGh5cGhlbnM6IGF1dG87IHRleHQtdW5kZXJsaW5lLXBvc2l0aW9uOiBmcm9tLWZvbnQ7IH0Kc2VjdGlvbi5kb2N4IHsgYm94LXNpemluZzogYm9yZGVyLWJveDsgZGlzcGxheTogZmxleDsgZmxleC1mbG93OiBjb2x1bW4gbm93cmFwOyBwb3NpdGlvbjogcmVsYXRpdmU7IG92ZXJmbG93OiBoaWRkZW47IH0Kc2VjdGlvbi5kb2N4PmFydGljbGUgeyBtYXJnaW4tYm90dG9tOiBhdXRvOyB6LWluZGV4OiAxOyB9CnNlY3Rpb24uZG9jeD5mb290ZXIgeyB6LWluZGV4OiAxOyB9Ci5kb2N4IHRhYmxlIHsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgfQouZG9jeCB0YWJsZSB0ZCwgLmRvY3ggdGFibGUgdGggeyB2ZXJ0aWNhbC1hbGlnbjogdG9wOyB9Ci5kb2N4IHAgeyBtYXJnaW46IDBwdDsgbWluLWhlaWdodDogMWVtOyB9Ci5kb2N4IHNwYW4geyB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7IG92ZXJmbG93LXdyYXA6IGJyZWFrLXdvcmQ7IH0KLmRvY3ggYSB7IGNvbG9yOiBpbmhlcml0OyB0ZXh0LWRlY29yYXRpb246IGluaGVyaXQ7IH0KLmRvY3ggc3ZnIHsgZmlsbDogdHJhbnNwYXJlbnQ7IH0KPC9zdHlsZT48ZGl2IGNsYXNzPTNEImRvY3gtd3JhcHBlciI+PHNlY3Rpb24gY2xhc3M9M0QiZG9jeCIgc3R5bGU9M0Qid2lkdGg6IDU5NS41cHQ7IG1pbi1oZWlnaHQ6IDg0Mi4yNXB0OyI+PGFydGljbGU+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGNlbnRlcjsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAzMnB0OyBmb250LXNpemU6IDMycHQ7IHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lIHJnYigwLCAwLCAwKTsiPlRlbXBsYXRlPC9zcGFuPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAzMnB0OyBmb250LXNpemU6IDMycHQ7IHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lIHJnYigwLCAwLCAwKTsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDE0cHQ7IGZvbnQtc2l6ZTogMTRwdDsiPk5hbWUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkVtcGxveWVlIFNoYWg8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDE0cHQ7IGZvbnQtc2l6ZTogMTRwdDsiPkVtYWlsIDogPC9zcGFuPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij5mZW1pbGNoaGV0YS5zaHJlZXNvZnRpY2VAZ21haWwuY29tCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+Q29udGFjdCBOdW1iZXIgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjEyMzQ1Njc4OTAKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxNHB0OyBmb250LXNpemU6IDE0cHQ7Ij5Kb2luaW5nIERhdGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjIwMjQtMDEtMTUKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxNHB0OyBmb250LXNpemU6IDE0cHQ7Ij5Kb2IgVGl0bGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkpPQiAxCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+Sm9iIFJvbGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkVtcGxveWVlCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+V2Vla2x5IFdvcmtpbmcgSG91cnMgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjQwCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+QW5udWFsIFNhbGFyeSA6IDwvc3Bhbj48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+NTAwMDAKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxN3B0OyBmb250LXNpemU6IDE3cHQ7Ij5CZXN0IFJlZ2FyZHMsCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+SFJNUwo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPlNpZ25hdHVyZSA6IDwvc3Bhbj48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+PHNwYW4gc3R5bGU9M0QiZGlzcGxheTogaW5saW5lLWJsb2NrOyBib3JkZXItYm90dG9tOiAycHggc29saWQgYmxhY2s7IHdoaXRlLXNwYWNlOiBub3JtYWw7Ij4KICAgICAgICAgICAgPGltZyBzcmM9M0QiZmlsZTovLy9DOi9mYWtlL2ltYWdlMC5wbmciIHN0eWxlPTNEIndpZHRoOjEwMHB4OyBoZWlnaHQ6MzBweDsgcGFkZGluZy1sZWZ0OiAxNXB4OyBkaXNwbGF5OmlubGluZTsiPgogICAgICAgIDwvc3Bhbj4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuPjwvc3Bhbj48L3A+PGRpdiBzdHlsZT0zRCJkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IHBvc2l0aW9uOiByZWxhdGl2ZTsgdGV4dC1pbmRlbnQ6IDBweDsgd2lkdGg6IDE3NS42NXB0OyBoZWlnaHQ6IDg3LjgycHQ7Ij48aW1nIHNyYz0zRCJibG9iOmh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC81M2YxYzFmOS0xNGYyLTQwNzctYTFmZi01ZjZjYWE3MmY5NGIiIHN0eWxlPTNEInBvc2l0aW9uOiByZWxhdGl2ZTsgbGVmdDogMHB0OyB0b3A6IDBwdDsgd2lkdGg6IDE3NS42NXB0OyBoZWlnaHQ6IDg3LjgycHQ7Ij48L2Rpdj48cD48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+Cjwvc3Bhbj48L3A+PC9hcnRpY2xlPjwvc2VjdGlvbj48L2Rpdj4KICAgICAgICA8L2JvZHk+CiAgICA8L2h0bWw+CgotLS0tLS09bWh0RG9jdW1lbnRQYXJ0CkNvbnRlbnQtVHlwZTogaW1hZ2UvcG5nCkNvbnRlbnQtVHJhbnNmZXItRW5jb2Rpbmc6IGJhc2U2NApDb250ZW50LUxvY2F0aW9uOiBmaWxlOi8vL0M6L2Zha2UvaW1hZ2UwLnBuZwoKaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQVN3QUFBQmtDQVlBQUFBOEFRM0FBQUFBQVhOU1IwSUFyczRjNlFBQUQrWkpSRUZVZUY3dFhUM0lOVWNWUGtFdEJBdUZGSXIvWUdFaGFDQ2l3aWRxWjZHUVFrRUw4U2NSREdrU1FzQlVLaUlXQ1VRTE8wV3RUS0ZFQzFFUS8xRFFRakNDalNqNEZ5UklRSXRnVWdqeFBsLzI4WjczdkRPenM3dXo5ODdlZlJaZTduM3ZuWm1kZldibXVlZWNPZWZNTGFaTENBZ0JJYkFSQkc3WlNEL1ZUU0VnQklTQWliQTBDWVNBRU5nTUFpS3N6UXlWT2lvRWhJQUlTM05BQ0FpQnpTQWd3dHJNVUttalFrQUlpTEN1em9FYlp2WWpNM3ZXek80MnMwYzFSWVNBRU9nSEFSSFcxYkg0clptOVpmam9TVE43UlQ5RHBaNElBU0Vnd3JvNkI1NXovLzdGekY2dktTSUVoRUEvQ0lpd2ptUHhPalA3c3hzYVNWajl6RlAxUkFqY1JFQ0VkWndJSHpPenIwdkMwc29RQXYwaUlNSTZqczFuRG04L0c0WUtLaUZVUTExQ1FBaDBnSUFJNnpnSVB6V3pkNGN4ZWNETUh1NWduTlFGSVNBRXBCSmVtUU93WDhHT2hRdkdkNUQ1NDJaMm0yYUtFQkFDZlNBZ0NlczREbjZIOEJremUvSHcxY2NQUlBhTlBvWkx2UkFDKzBaQWhKVW1MRWhXOU1mNm1abUJ0R1RMMnZkYTBkTjNnSUFJSzAxWWtLaGd6NktLQ0dQODV6b1lMM1ZCQ093YUFSSFdjZmovWldZdkhmNzk5K0g5bHc3dnVXc0k2ZW85a3JKMnZWYjA4QjBnSU1KNmZoQ2kweWcrQXpiZUVDOWJWZ2NUVmwzWU53SWlyT1A0ZTNMQ3AvREJnbHBJWjFMWXNpQmw2UklDUXVCTUNJaXd5b1FGVmRBVG1SeEp6elJSZFZzaFFMVkhTRHlQUUhRY3BRb0lDUXRoTzdqa1NIcFVvVUhtVUtXMWU2b1ZkRElFSkdFZG9mYkVoRTlKV0ZBTFFXYTR2bTFtSHp6WjZQUjFJNURUUndmeXh2di9tdGtUQTJGQlhmNzU4RjRFMXRlNFhWUnZSRmpINFl5eGhONlY0ZTltOXFwaFFlNHQ1UXlKS3NaWjVoWUN5bjFUa3RkRjhVUTNEeVBDT2c2Rmw2VHdLWHl4SUdYaDJwc2RDeVFGUE41c1p2Zk9uSzNBRHBLWEpLNlpBS3JhZFFSRVdIbkM4cnVDWGwzY2t1R2QwaEZlYVcraTZvYm44eGZMZ3FoaUVEakxnWHhBNUg4ZFBualgwRzZ1ZkcyVUFCMTBJY1crNGJBeis5cWhmZDRILytMZXNjOWEwenREUUlSMWRjQ2phd1B4OFlUVnV6L1dGQlVPRHJML01MTi9Ga2dLQ0lFb29PYmxZaXFqZlNzdUk2OG1ranc5MlpHd3hwWWZTUXQ5RVhtTm9YV0IzNHV3cmc1cTNDbWtOT1h0V3owVFZpcW4xNUpwQzIvL0wwOVU2OUFIN0twR0V2cVBtZUh2MWlVZGNuVkJuZ2lYa3NyWkNOQXROQ1BDdWpwS3VaM0NMUkJXaWF5d3FIOWpacmNuaUNRM1Q3RWpDamVPT1lRQXNuckl6RDZ3OGlKNDJzeStjampsNk5NcjMwZk5kNEtBQ092cVFPUU03ejU5Y284U1ZpUmEybngrWW1aL3kwZzhOVk1RS3VQdnpld2pFNGdMR05MOW9lWWVMQU1WRDFreWNQMHUzSytrUHNLOTRrVlRicVN5MjBWQWhIVjk3THdkaTRiM25na3JKVmxCS3NKZnpoZ2VuL3JYWnZZZE03dW5JSUdWM0JYR2JGaXBGWUwrUFdobXVQY1VLZTZ4QTdIZEVScmMwa2JJZHRtaWc1NkxzTXFFaFcreEdDQXgwQStwTjI5M24yV2lka3Job05pbkRyNWxYdzFwYzhhSUorNzYxUnI0UVVqZlRiaElRS1Y3ZjZVQm5YR2QwVGFtR00vYVViK0FjaUtzNjRNWUpSWVExdHZON0Z0RDBaNElLNnF3cFNsSmx3UzROWXp0c0lFVW9HYW1KRFFTTjhvd1pDa25RZEV3enU5enBGUEtOMWJxQzlwRlFQclk4MXpBVXRVakFBRVIxdlY1RUVtQXpxUE0ydEJiTXIrU2hEV0ZwRklyWXVxdUkrOVhTbllJQW9KYXg0eXV2Qy9xb2g2ZFRlbThpajZrM0I2VW8yeUhIQ2JDU2c5NnpJT0ZVaVFzN3dFZmE0UHNzTUNRQ0JBcTBDbXlsTjR3cy91SGUySmhjOEhYU0ZLbEtVOTE3MU5tOXZKTVFlOUlPaVh2ZmEwcVdTdTU3WERwN3ZPUlJWanBjZmU3YmxpSVdKaFVoVW8ya3lqdFVHcVlzcGpQT1JPaDRzSEx2T1R0anY3QlJlS3REVG9LNG9Mdlc2M2pLSDRFN3B0b3BHL1FUVFhSQ3dJaXJQUkllTFdRRWd2dE5Ua0pLNVcxRkszM1RGcGo0VGlVb0Q1aFpxOEpVTFdhT3pYU0Z2ckIyTVJlMW83NmNRWUVXazI2TTNSOTlWdFNMUVJoNFc5TXd2S0VCWDhpcUlXVUhIcGFjQ0JqK0RYbHNpOVFvdlFaRjd4YkI0RnY3VW9Bck9CbytzcWczaTVWYlZlZktMckI2UkFRWWVXeEptRlJ5aGdqTExUazYyRDNDdi96UWp2blNFMHpKa1d4ZjA4ZWRrTi9PSkRGOXdJc1gwellzVFIzVHJkT2RhY0JBVTI2L0ZUd1VnV2tEcXFFSlJ1V0p5em1oR2Z5UDZxSGE1TVdkOWRnaTBwSlVTQ21uQkc5ZG1ISTk2a1dLWlZyaW9BSUt3OG5kdDkrTVh5TnVEckd4WlhjR2xKcGFLSnJ3QnFMZlV5S29wVDRCek9EdEZScjVNNmhJOStucHN0UWpkVWlJTUlxSTBXSnlSTldpWEE4T1hrYlQ4d0NVWEtOcUJrN1NsR3dSYVdjTjNQdUJyNGZTRy84cDhFK043WXI2UHYwWVRON3RLYVRLbk1UQVdBcng5WkdrMEdFVlVkWWlIZUR0enV1VWw1M3IwWjZLU1R1SUNKZzk1T0YvRktwWHBXa3FCb0hVWVRoM09rYWpsSVNGdGJuRDgvM3BrTUlEWUtldlJTbVBGVGxlZUkzVitnYWdrMExSZ3BzeGEybEVhMnMxNHdJcTR3dEpSSnY5OEVPNEcyWmFxVWc2YmpUVnJOemlEcVFvakR4UFlGdzU3SjJCeTE2NzB1bG03K20vRGpnUGNZSG1WRXhKdmlmZ2Vmejc2Q2FXUVJFV09YSlFadVVKNnpTYnQrSFhNemhPODNzbDZINVh6bEpEVi81dGpEWktVWGhGVzRSQ0Y4aE9hRjhMVUg1MjBicERrbjU0SHlwcXc0QkVoUmVvZkpEY3NLbGZQVjErRFV0SmNJcXc1bnlQMEtOSEc1ZWtrbEpNWmowTWFnWVpJanNDVndZSkNqK2FrOUp2Wko2R2g5bWRDN1hpcWFUZHFYR2lEL1ZPSjlYbmxMVDByRllxZXY3YVZhRVZSN3JYRGFFbk5Oa2pyQzhxOEY3ZzVTRkhpRGtCTDVQclgrMS9TYUF5T280MXA2Y1FFejRjWUJxUndsV3hOUXBCNHF3eWdPVEM3ZXBJU3lvWHZSMjkybGErR3NkUDF2RFA4dExWNzFsbVRqRmtvakVoSHZTenRSS2dqM0ZjK2dlQXdJaXJQR3BFRS9TUVkyNEE0Z0VmN2p1R2c1Y1phdmNYY09ydHorbFZNT2xyZzd4U2ZZb1hYbEpsc1NFMTl6Ulp1T2pyeEpkSVNEQ0doK09GR0dCWExnNGZBdmUvV0VzMWk1S2J5MVZ0dGoycFVwWDlFR0RPb2NMR0VKeTRnL0YrT2lxeEtZUUVHR05EOWNQRG5uSFlYZUtsM2ZPOUF2a3VhSGdHR0doV1BTQ2IzWEFoWGNRYlVtRTQyaXRVNEk3cUhUeG9Gb05jcEtQMHpxWWQ5bXFDT3Y2c0pRY05GazZSMFplc3FuQkZ1VjlQcWdXNUJLbHF5MzVYSG1iRTZVbXFuWlM2N3Fra05OMnFtWlJuYlpINTdsYnlrR1RweDIvemN5UWRkTmZOWVJWSTJHaHpWUks1aVZTZzVldW9LSys0enlRVnQzVjI1eDhDQXZKU2J0MVZURHVwOUJlQ1lzNW9mQktCMDJRUk9wWC9GNHplNlNTc0ZEc21TRzBCVVJSdStCODBEVENZbDQyY3dwR3Y3RldLdWJNN3Z5L0dsVTZlb1pMYWxxSzZFN3I3NFd3dkFjNXcxeThnMlpKb3ZIZTY1d21PVFZycWtySTlsQVB0ckkzRGgvTU5aTEhEWUp6alMrTjRVeTNES3psUnJCVGttbjUyT2VhMEMyZklkY1dnMUR4NnIzSUVWb3h4VUV6NVl1Vmsxem1FaGFld2RlRlpBWlNySlhRVUQ5S1YzTkpyM1pzb21jNFhEdElUUElNcjBWUjVTWWhjRW1FNWFVby9zTG4wcXlVUU1MT0hTNmVlRE9Yc0dwdFdMNHZmdGR3YXQ2c21NSm16djF6dUhpVmptVzhaemcrbTBLdWt5YXBDZ3NCSXJCMXdpSkpSU2tLaTMzT0VWdGVTdkVwVzN6V1VHQlhJMkhOSVl5NGExaHJnNHJTMVJJblZFOU9QcDZPT1oxRVRPS1BzeUd3UmNJaVNmbjB2N1JIelNFcEQzNUtta0x1cWhlR0VhcXhZYzBocktqYTFibzVSTnRWclN1RFQvdE1nN2gyNk02MkhIWGpNUVMyUWxpUnBPYW9lbU5ZOFBzVUlmcTZKUkx4aEZkTEdxbCtlZlZ1ekJhVms2NjRFMGZYQWZUYmt4THVPOFdXVjR1ZnlnbUIxUkRvbWJCUzZoNlBvRm9xU2RVQW1zdlVVQ0tpc2ZReU5mZEZtU2tHK0hoNEt6QkNQK2ltNFRjY3BNN1Zqb0RLZFlsQWI0UkZhY0RuS20rbDdzMFpBTnFVWG4xSUgveUNvWUVTWnA2dzVxcUU3S2VYc21pVDhvNldlSSswelhTRlFEM2thUCtDSktjNVE2MDZXMENnRjhLS2gzdFM1Zk9IZVo0YlQ5cUpTa1RVUWlXazBmdjJJZGJ3SllrSForemkrOHpzVnZmOVVwSThOOGE2dnhBb0luQnV3a3J0eXZWRVVoNDhFbFlybGRCTFM3alAyTWsxeUV6Nm9BdjJiYmt6cUdVaUJEYUJ3RGtJQzc1R1BpUUdSdVV0Uk4xVFJTdTVHcVJVd3FqRzhmL1VCRW5sejNyTXpPNFlDdnQ3citsM3RZbkpxMDd1RDRGVEVSWkppbGsydDBKU2ZrYlFxVE8zYXdjaXdtR3JEdzJWZkc2c0hEbVJvRXFIUzBRRGZPcEU2U1YrVi91YjlYcml6U0t3Sm1IRjBCanVXaTNKUkhCT29Dazk0VnpDN3g4T2syQ2NIRzFPcGI0eFZBVWJDSE5PdnZIQjBRK1kyVDNoMks4bExoVG54RlQzRmdLVEVHaEpXRnk0aUNuekRvbHp2YzRuUFVqanduUUZZT3JqTWZ0UzZ2Ykk2YzZESlpaMkwrWFF5amFuaHZBczdZdnFDNEd6SWJDVXNHaVB3Y0xHb3FZa0FjTjU3NUlVU1FuOWhyVEVaK0huWTROQ255WStKejNFWVp6SDFYckhMdHFzMkQ5SlYyTWpwZTh2Qm9HNWhCVVQzdEZYcXJjZFBwSVBQYndwQmZvVGE4WUcweE1UY21NaGYxYk5xVG10Q1N0S1dlZ1hqUENNOFJ0N0RuMHZCRGFQUUMxaDVSdzZwNlpxV1FNd2toQmVLU21WZHVKeWZZZ1NVMnJua3E0TmF3VS9qK0Z6dzh6dVArd2FQajR6dUh1c2ZYMHZCTHBHWUl5d0dCN0RRR01zYW9URm5FUGRZMThBNkJ4SkNmVklTajZHYm9wVU9PYmFnSDc5Y1FpV2JpMWhkVDJSMURraGNBb0VVb1JGWW1ES2xsTjZuWE5uMFV0TnRUWWxqeGNKQ1gzbnNVKzByeTNCbGJ0MU9UZUNWckdFUy9xb3VrTGdZaEdJaEJVUDM4VENiQjFvekJURmM5VTNTa2srcStXcHpxS2pkM21Pc0x6M2VXMHVxNHVkWEhvd0lkQWFBVTlZbEI1YUdITlQzdDAxL2twNHZxZk43S25oUWIzcTFrTk9jQkpTenBWQWhOVjZocW85SWVBUThJU0ZBMENmTmJPN3c4bTVJQnFmbG9RN2JGVFZwa2hLSmVtSTNXcWh1cTAxeUZUNWNqbXhSRmhySWE5MmhjQkIzZk9FaGFPc3NHMC85L0trNXRVMXROZURkRFQzdVdLOTBzbk9JcXhXS0tzZElaQkFJTnF3dlB1Q0w0N1B2YjhQQ0lqWDNuSjlsOUxNZU1JYXl4U3FDU2tFaE1CRUJNYmNHaVkydDR2aUpkY0dUMWdLU043RmROQkRuaElCRWRaMHRMazVrZG9GOUx1c0lxenAyS3FHRUNnaUlNS2FQa0ZLYVdhOGhLV2c1T25ZcW9ZUUVHRTFuZ1BjS1V4SlVDS3N4bUNyT1NIZ0VaQ0VOWDArMUJLV1ZNTHAyS3FHRUpDRTFYZ09NR3ZDRTJhRzAzVDhKUnRXWTdEVm5CQ1FoTFY4RHRBWHF4VGFKQWxyT2M1cVFRaGNRVUFxNGJ3SlFkZUdtSkZCYmczejhGUXRJVkNGZ0FpckNxWnJoZWc4R3ZHVDQrZzhQRlZMQ0ZRaElNS3FnaWxMV0NVSlM1N3U4N0JWTFNHUVJVQ0VOVzl5NUNRc2IzVEhJUlQzeld0ZXRZU0FFRWdoSU1LYU55OXlSbmQvNk9uWHpPeXVlYzJybGhBUUFpS3Nkbk1nbDdIQm54OG9sYkFkM21wSkNOeEVRQkxXOUluZ1Q2K0pOaXgvRkpkQ2M2WmpxeHBDb0lpQUNHdjZCQ2tSbHBld1JGalRzVlVOSVNEQ1dtRU81STc3OG9TVnkwcTZRbmZVcEJEWUJ3S1NzT2FOTTFXL1NFcWVzS1J5ejhOV3RZUkFGZ0VSMXJ6SmdWVFNTQ21OeXg4Vkg0K1RGNzd6OEZVdElaQkVRQXRxM3NTQUhRdmt4QU02UUZxUXRxZ3FvbFdwaFBPd1ZTMGhJQWxyaFRuZ3czQkFUajgyc3p2ZGZSVDh2QUxvYW5MZkNFakNXamIrM3JNOXRxU0RWSmRocTlwQzRCb0NJcXpsa3lKRlduSnBXSTZyV2hBQzF4RDRIOUtlbEpMV0owemhBQUFBQUVsRlRrU3VRbUNDCgoKLS0tLS0tPW1odERvY3VtZW50UGFydC0tClBLAwQKAAAAAAANXm1aAAAAAAAAAAAAAAAACwAAAHdvcmQvX3JlbHMvUEsDBAoAAAAAAA1ebVpZIVOaMgEAADIBAAAcAAAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsczw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+CiAgPFJlbGF0aW9uc2hpcCBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL2FGQ2h1bmsiCiAgICBUYXJnZXQ9Ii93b3JkL2FmY2h1bmsubWh0IiBJZD0iaHRtbENodW5rIiAvPgo8L1JlbGF0aW9uc2hpcHM+ClBLAQIUAAoAAAAAAA1ebVqWJXaW0QEAANEBAAATAAAAAAAAAAAAAAAAAAAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQACgAAAAAADV5tWgAAAAAAAAAAAAAAAAYAAAAAAAAAAAAQAAAAAgIAAF9yZWxzL1BLAQIUAAoAAAAAAA1ebVoPwi/lSgEAAEoBAAALAAAAAAAAAAAAAAAAACYCAABfcmVscy8ucmVsc1BLAQIUAAoAAAAAAA1ebVoAAAAAAAAAAAAAAAAFAAAAAAAAAAAAEAAAAJkDAAB3b3JkL1BLAQIUAAoAAAAAAA1ebVoiPyHgCAgAAAgIAAARAAAAAAAAAAAAAAAAALwDAAB3b3JkL2RvY3VtZW50LnhtbFBLAQIUAAoAAAAAAA1ebVrSkdcHGTYAABk2AAAQAAAAAAAAAAAAAAAAAPMLAAB3b3JkL2FmY2h1bmsubWh0UEsBAhQACgAAAAAADV5tWgAAAAAAAAAAAAAAAAsAAAAAAAAAAAAQAAAAOkIAAHdvcmQvX3JlbHMvUEsBAhQACgAAAAAADV5tWlkhU5oyAQAAMgEAABwAAAAAAAAAAAAAAAAAY0IAAHdvcmQvX3JlbHMvZG9jdW1lbnQueG1sLnJlbHNQSwUGAAAAAAgACADhAQAAz0MAAAAA" })
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('JobTitle not found')
        })
        test('Should return 200 for save signed template successfully', async () => {
            const res = await request(app).post('/signedTemplate').set('Authorization', `Bearer ${token}`).send({ jobId: userJobId, base64OfTemplate: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBAoAAAAAAA1ebVqWJXaW0QEAANEBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPgogIDxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9CiAgICAiYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UucmVsYXRpb25zaGlwcyt4bWwiIC8+CiAgPE92ZXJyaWRlIFBhcnROYW1lPSIvd29yZC9kb2N1bWVudC54bWwiIENvbnRlbnRUeXBlPQogICAgImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50Lm1haW4reG1sIi8+CiAgPE92ZXJyaWRlIFBhcnROYW1lPSIvd29yZC9hZmNodW5rLm1odCIgQ29udGVudFR5cGU9Im1lc3NhZ2UvcmZjODIyIi8+CjwvVHlwZXM+ClBLAwQKAAAAAAANXm1aAAAAAAAAAAAAAAAABgAAAF9yZWxzL1BLAwQKAAAAAAANXm1aD8Iv5UoBAABKAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNoaXBzIj4KICA8UmVsYXRpb25zaGlwCiAgICAgIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiCiAgICAgIFRhcmdldD0iL3dvcmQvZG9jdW1lbnQueG1sIiBJZD0iUjA5YzgzZmFmYzA2NzQ4OGUiIC8+CjwvUmVsYXRpb25zaGlwcz4KUEsDBAoAAAAAAA1ebVoAAAAAAAAAAAAAAAAFAAAAd29yZC9QSwMECgAAAAAADV5tWiI/IeAICAAACAgAABEAAAB3b3JkL2RvY3VtZW50LnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPHc6ZG9jdW1lbnQKICB4bWxuczp3PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvd29yZHByb2Nlc3NpbmdtbC8yMDA2L21haW4iCiAgeG1sbnM6bT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvbWF0aCIKICB4bWxuczpyPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzIgogIHhtbG5zOndwPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvZHJhd2luZ21sLzIwMDYvd29yZHByb2Nlc3NpbmdEcmF3aW5nIgogIHhtbG5zOmE9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9tYWluIgogIHhtbG5zOm5zNj0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3NjaGVtYUxpYnJhcnkvMjAwNi9tYWluIgogIHhtbG5zOmM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9jaGFydCIKICB4bWxuczpuczg9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9jaGFydERyYXdpbmciCiAgeG1sbnM6ZGdtPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvZHJhd2luZ21sLzIwMDYvZGlhZ3JhbSIKICB4bWxuczpwaWM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9waWN0dXJlIgogIHhtbG5zOm5zMTE9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9zcHJlYWRzaGVldERyYXdpbmciCiAgeG1sbnM6ZHNwPSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS9kcmF3aW5nLzIwMDgvZGlhZ3JhbSIKICB4bWxuczpuczEzPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTpleGNlbCIKICB4bWxuczpvPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTpvZmZpY2UiCiAgeG1sbnM6dj0idXJuOnNjaGVtYXMtbWljcm9zb2Z0LWNvbTp2bWwiCiAgeG1sbnM6dzEwPSJ1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOm9mZmljZTp3b3JkIgogIHhtbG5zOm5zMTc9InVybjpzY2hlbWFzLW1pY3Jvc29mdC1jb206b2ZmaWNlOnBvd2VycG9pbnQiCiAgeG1sbnM6b2R4PSJodHRwOi8vb3BlbmRvcGUub3JnL3hwYXRocyIKICB4bWxuczpvZGM9Imh0dHA6Ly9vcGVuZG9wZS5vcmcvY29uZGl0aW9ucyIKICB4bWxuczpvZHE9Imh0dHA6Ly9vcGVuZG9wZS5vcmcvcXVlc3Rpb25zIgogIHhtbG5zOm9kaT0iaHR0cDovL29wZW5kb3BlLm9yZy9jb21wb25lbnRzIgogIHhtbG5zOm9kZ209Imh0dHA6Ly9vcGVuZG9wZS5vcmcvU21hcnRBcnQvRGF0YUhpZXJhcmNoeSIKICB4bWxuczpuczI0PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9iaWJsaW9ncmFwaHkiCiAgeG1sbnM6bnMyNT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L2NvbXBhdGliaWxpdHkiCiAgeG1sbnM6bnMyNj0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L2xvY2tlZENhbnZhcyI+CiAgPHc6Ym9keT4KICAgIDx3OmFsdENodW5rIHI6aWQ9Imh0bWxDaHVuayIgLz4KICAgIDx3OnNlY3RQcj4KICAgICAgPHc6cGdTeiB3Onc9IjEyMjQwIiB3Omg9IjE1ODQwIiB3Om9yaWVudD0icG9ydHJhaXQiIC8+CiAgICAgIDx3OnBnTWFyIHc6dG9wPSIxNDQwIgogICAgICAgICAgICAgICB3OnJpZ2h0PSIxNDQwIgogICAgICAgICAgICAgICB3OmJvdHRvbT0iMTQ0MCIKICAgICAgICAgICAgICAgdzpsZWZ0PSIxNDQwIgogICAgICAgICAgICAgICB3OmhlYWRlcj0iNzIwIgogICAgICAgICAgICAgICB3OmZvb3Rlcj0iNzIwIgogICAgICAgICAgICAgICB3Omd1dHRlcj0iMCIvPgogICAgPC93OnNlY3RQcj4KICA8L3c6Ym9keT4KPC93OmRvY3VtZW50PgpQSwMECgAAAAAADV5tWtKR1wcZNgAAGTYAABAAAAB3b3JkL2FmY2h1bmsubWh0TUlNRS1WZXJzaW9uOiAxLjAKQ29udGVudC1UeXBlOiBtdWx0aXBhcnQvcmVsYXRlZDsKICAgIHR5cGU9InRleHQvaHRtbCI7CiAgICBib3VuZGFyeT0iLS0tLT1taHREb2N1bWVudFBhcnQiCgoKLS0tLS0tPW1odERvY3VtZW50UGFydApDb250ZW50LVR5cGU6IHRleHQvaHRtbDsKICAgIGNoYXJzZXQ9InV0Zi04IgpDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nOiBxdW90ZWQtcHJpbnRhYmxlCkNvbnRlbnQtTG9jYXRpb246IGZpbGU6Ly8vQzovZmFrZS9kb2N1bWVudC5odG1sCgo8aHRtbD4KICAgICAgICA8aGVhZD4KICAgICAgICAgICAgPHN0eWxlPgogICAgICAgICAgICAgICAgYm9keSB7IGJhY2tncm91bmQ6IHdoaXRlICFpbXBvcnRhbnQ7IH0KICAgICAgICAgICAgICAgIHRhYmxlLCB0aCwgdGQsIGRpdiwgcCwgc3BhbiB7IGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7IH0KICAgICAgICAgICAgPC9zdHlsZT4KICAgICAgICA8L2hlYWQ+CiAgICAgICAgPGJvZHk+CiAgICAgICAgICAgIDwhLS1kb2N4anMgbGlicmFyeSBwcmVkZWZpbmVkIHN0eWxlcy0tPjxzdHlsZT4KLmRvY3gtd3JhcHBlciB7IGJhY2tncm91bmQ6IGdyYXk7IHBhZGRpbmc6IDMwcHg7IHBhZGRpbmctYm90dG9tOiAwcHg7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZmxvdzogY29sdW1uOyBhbGlnbi1pdGVtczogY2VudGVyOyB9IAouZG9jeC13cmFwcGVyPnNlY3Rpb24uZG9jeCB7IGJhY2tncm91bmQ6IHdoaXRlOyBib3gtc2hhZG93OiAwIDAgMTBweCByZ2JhKDAsIDAsIDAsIDAuNSk7IG1hcmdpbi1ib3R0b206IDMwcHg7IH0KLmRvY3ggeyBjb2xvcjogYmxhY2s7IGh5cGhlbnM6IGF1dG87IHRleHQtdW5kZXJsaW5lLXBvc2l0aW9uOiBmcm9tLWZvbnQ7IH0Kc2VjdGlvbi5kb2N4IHsgYm94LXNpemluZzogYm9yZGVyLWJveDsgZGlzcGxheTogZmxleDsgZmxleC1mbG93OiBjb2x1bW4gbm93cmFwOyBwb3NpdGlvbjogcmVsYXRpdmU7IG92ZXJmbG93OiBoaWRkZW47IH0Kc2VjdGlvbi5kb2N4PmFydGljbGUgeyBtYXJnaW4tYm90dG9tOiBhdXRvOyB6LWluZGV4OiAxOyB9CnNlY3Rpb24uZG9jeD5mb290ZXIgeyB6LWluZGV4OiAxOyB9Ci5kb2N4IHRhYmxlIHsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgfQouZG9jeCB0YWJsZSB0ZCwgLmRvY3ggdGFibGUgdGggeyB2ZXJ0aWNhbC1hbGlnbjogdG9wOyB9Ci5kb2N4IHAgeyBtYXJnaW46IDBwdDsgbWluLWhlaWdodDogMWVtOyB9Ci5kb2N4IHNwYW4geyB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7IG92ZXJmbG93LXdyYXA6IGJyZWFrLXdvcmQ7IH0KLmRvY3ggYSB7IGNvbG9yOiBpbmhlcml0OyB0ZXh0LWRlY29yYXRpb246IGluaGVyaXQ7IH0KLmRvY3ggc3ZnIHsgZmlsbDogdHJhbnNwYXJlbnQ7IH0KPC9zdHlsZT48ZGl2IGNsYXNzPTNEImRvY3gtd3JhcHBlciI+PHNlY3Rpb24gY2xhc3M9M0QiZG9jeCIgc3R5bGU9M0Qid2lkdGg6IDU5NS41cHQ7IG1pbi1oZWlnaHQ6IDg0Mi4yNXB0OyI+PGFydGljbGU+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGNlbnRlcjsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAzMnB0OyBmb250LXNpemU6IDMycHQ7IHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lIHJnYigwLCAwLCAwKTsiPlRlbXBsYXRlPC9zcGFuPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAzMnB0OyBmb250LXNpemU6IDMycHQ7IHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lIHJnYigwLCAwLCAwKTsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDE0cHQ7IGZvbnQtc2l6ZTogMTRwdDsiPk5hbWUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkVtcGxveWVlIFNoYWg8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDE0cHQ7IGZvbnQtc2l6ZTogMTRwdDsiPkVtYWlsIDogPC9zcGFuPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij5mZW1pbGNoaGV0YS5zaHJlZXNvZnRpY2VAZ21haWwuY29tCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+Q29udGFjdCBOdW1iZXIgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjEyMzQ1Njc4OTAKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxNHB0OyBmb250LXNpemU6IDE0cHQ7Ij5Kb2luaW5nIERhdGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjIwMjQtMDEtMTUKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxNHB0OyBmb250LXNpemU6IDE0cHQ7Ij5Kb2IgVGl0bGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkpPQiAxCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+Sm9iIFJvbGUgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPkVtcGxveWVlCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+V2Vla2x5IFdvcmtpbmcgSG91cnMgOiA8L3NwYW4+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPjQwCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyBCb2xkJnF1b3Q7OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTRwdDsgZm9udC1zaXplOiAxNHB0OyI+QW5udWFsIFNhbGFyeSA6IDwvc3Bhbj48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+NTAwMDAKPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zIEJvbGQmcXVvdDs7IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxN3B0OyBmb250LXNpemU6IDE3cHQ7Ij5CZXN0IFJlZ2FyZHMsCjwvc3Bhbj48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+SFJNUwo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMmcXVvdDs7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPgo8L3NwYW4+PC9wPjxwIHN0eWxlPTNEIm1hcmdpbi10b3A6IDZwdDsgbWFyZ2luLWJvdHRvbTogNnB0OyBsaW5lLWhlaWdodDogMS40OyB0ZXh0LWluZGVudDogMHB0OyBtYXJnaW4tbGVmdDogMHB0OyB0ZXh0LWFsaWduOiBsZWZ0OyI+PHNwYW4gc3R5bGU9M0QiZm9udC1mYW1pbHk6ICZxdW90O0NhbnZhIFNhbnMgQm9sZCZxdW90OzsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiByZ2IoMCwgMCwgMCk7IG1pbi1oZWlnaHQ6IDEycHQ7IGZvbnQtc2l6ZTogMTJwdDsiPlNpZ25hdHVyZSA6IDwvc3Bhbj48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+PHNwYW4gc3R5bGU9M0QiZGlzcGxheTogaW5saW5lLWJsb2NrOyBib3JkZXItYm90dG9tOiAycHggc29saWQgYmxhY2s7IHdoaXRlLXNwYWNlOiBub3JtYWw7Ij4KICAgICAgICAgICAgPGltZyBzcmM9M0QiZmlsZTovLy9DOi9mYWtlL2ltYWdlMC5wbmciIHN0eWxlPTNEIndpZHRoOjEwMHB4OyBoZWlnaHQ6MzBweDsgcGFkZGluZy1sZWZ0OiAxNXB4OyBkaXNwbGF5OmlubGluZTsiPgogICAgICAgIDwvc3Bhbj4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgbGluZS1oZWlnaHQ6IDEuNDsgdGV4dC1pbmRlbnQ6IDBwdDsgbWFyZ2luLWxlZnQ6IDBwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuIHN0eWxlPTNEImZvbnQtZmFtaWx5OiAmcXVvdDtDYW52YSBTYW5zJnF1b3Q7OyBjb2xvcjogcmdiKDAsIDAsIDApOyBtaW4taGVpZ2h0OiAxMnB0OyBmb250LXNpemU6IDEycHQ7Ij4KPC9zcGFuPjwvcD48cCBzdHlsZT0zRCJtYXJnaW4tdG9wOiA2cHQ7IG1hcmdpbi1ib3R0b206IDZwdDsgdGV4dC1hbGlnbjogbGVmdDsiPjxzcGFuPjwvc3Bhbj48L3A+PGRpdiBzdHlsZT0zRCJkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IHBvc2l0aW9uOiByZWxhdGl2ZTsgdGV4dC1pbmRlbnQ6IDBweDsgd2lkdGg6IDE3NS42NXB0OyBoZWlnaHQ6IDg3LjgycHQ7Ij48aW1nIHNyYz0zRCJibG9iOmh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC81M2YxYzFmOS0xNGYyLTQwNzctYTFmZi01ZjZjYWE3MmY5NGIiIHN0eWxlPTNEInBvc2l0aW9uOiByZWxhdGl2ZTsgbGVmdDogMHB0OyB0b3A6IDBwdDsgd2lkdGg6IDE3NS42NXB0OyBoZWlnaHQ6IDg3LjgycHQ7Ij48L2Rpdj48cD48L3A+PHAgc3R5bGU9M0QibWFyZ2luLXRvcDogNnB0OyBtYXJnaW4tYm90dG9tOiA2cHQ7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtaW5kZW50OiAwcHQ7IG1hcmdpbi1sZWZ0OiAwcHQ7IHRleHQtYWxpZ246IGxlZnQ7Ij48c3BhbiBzdHlsZT0zRCJmb250LWZhbWlseTogJnF1b3Q7Q2FudmEgU2FucyZxdW90OzsgY29sb3I6IHJnYigwLCAwLCAwKTsgbWluLWhlaWdodDogMTJwdDsgZm9udC1zaXplOiAxMnB0OyI+Cjwvc3Bhbj48L3A+PC9hcnRpY2xlPjwvc2VjdGlvbj48L2Rpdj4KICAgICAgICA8L2JvZHk+CiAgICA8L2h0bWw+CgotLS0tLS09bWh0RG9jdW1lbnRQYXJ0CkNvbnRlbnQtVHlwZTogaW1hZ2UvcG5nCkNvbnRlbnQtVHJhbnNmZXItRW5jb2Rpbmc6IGJhc2U2NApDb250ZW50LUxvY2F0aW9uOiBmaWxlOi8vL0M6L2Zha2UvaW1hZ2UwLnBuZwoKaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQVN3QUFBQmtDQVlBQUFBOEFRM0FBQUFBQVhOU1IwSUFyczRjNlFBQUQrWkpSRUZVZUY3dFhUM0lOVWNWUGtFdEJBdUZGSXIvWUdFaGFDQ2l3aWRxWjZHUVFrRUw4U2NSREdrU1FzQlVLaUlXQ1VRTE8wV3RUS0ZFQzFFUS8xRFFRakNDalNqNEZ5UklRSXRnVWdqeFBsLzI4WjczdkRPenM3dXo5ODdlZlJaZTduM3ZuWm1kZldibXVlZWNPZWZNTGFaTENBZ0JJYkFSQkc3WlNEL1ZUU0VnQklTQWliQTBDWVNBRU5nTUFpS3N6UXlWT2lvRWhJQUlTM05BQ0FpQnpTQWd3dHJNVUttalFrQUlpTEN1em9FYlp2WWpNM3ZXek80MnMwYzFSWVNBRU9nSEFSSFcxYkg0clptOVpmam9TVE43UlQ5RHBaNElBU0Vnd3JvNkI1NXovLzdGekY2dktTSUVoRUEvQ0lpd2ptUHhPalA3c3hzYVNWajl6RlAxUkFqY1JFQ0VkWndJSHpPenIwdkMwc29RQXYwaUlNSTZqczFuRG04L0c0WUtLaUZVUTExQ1FBaDBnSUFJNnpnSVB6V3pkNGN4ZWNETUh1NWduTlFGSVNBRXBCSmVtUU93WDhHT2hRdkdkNUQ1NDJaMm0yYUtFQkFDZlNBZ0NlczREbjZIOEJremUvSHcxY2NQUlBhTlBvWkx2UkFDKzBaQWhKVW1MRWhXOU1mNm1abUJ0R1RMMnZkYTBkTjNnSUFJSzAxWWtLaGd6NktLQ0dQODV6b1lMM1ZCQ093YUFSSFdjZmovWldZdkhmNzk5K0g5bHc3dnVXc0k2ZW85a3JKMnZWYjA4QjBnSU1KNmZoQ2kweWcrQXpiZUVDOWJWZ2NUVmwzWU53SWlyT1A0ZTNMQ3AvREJnbHBJWjFMWXNpQmw2UklDUXVCTUNJaXd5b1FGVmRBVG1SeEp6elJSZFZzaFFMVkhTRHlQUUhRY3BRb0lDUXRoTzdqa1NIcFVvVUhtVUtXMWU2b1ZkRElFSkdFZG9mYkVoRTlKV0ZBTFFXYTR2bTFtSHp6WjZQUjFJNURUUndmeXh2di9tdGtUQTJGQlhmNzU4RjRFMXRlNFhWUnZSRmpINFl5eGhONlY0ZTltOXFwaFFlNHQ1UXlKS3NaWjVoWUN5bjFUa3RkRjhVUTNEeVBDT2c2Rmw2VHdLWHl4SUdYaDJwc2RDeVFGUE41c1p2Zk9uSzNBRHBLWEpLNlpBS3JhZFFSRVdIbkM4cnVDWGwzY2t1R2QwaEZlYVcraTZvYm44eGZMZ3FoaUVEakxnWHhBNUg4ZFBualgwRzZ1ZkcyVUFCMTBJY1crNGJBeis5cWhmZDRILytMZXNjOWEwenREUUlSMWRjQ2phd1B4OFlUVnV6L1dGQlVPRHJML01MTi9Ga2dLQ0lFb29PYmxZaXFqZlNzdUk2OG1ranc5MlpHd3hwWWZTUXQ5RVhtTm9YV0IzNHV3cmc1cTNDbWtOT1h0V3owVFZpcW4xNUpwQzIvL0wwOVU2OUFIN0twR0V2cVBtZUh2MWlVZGNuVkJuZ2lYa3NyWkNOQXROQ1BDdWpwS3VaM0NMUkJXaWF5d3FIOWpacmNuaUNRM1Q3RWpDamVPT1lRQXNuckl6RDZ3OGlKNDJzeStjampsNk5NcjMwZk5kNEtBQ092cVFPUU03ejU5Y284U1ZpUmEybngrWW1aL3kwZzhOVk1RS3VQdnpld2pFNGdMR05MOW9lWWVMQU1WRDFreWNQMHUzSytrUHNLOTRrVlRicVN5MjBWQWhIVjk3THdkaTRiM25na3JKVmxCS3NKZnpoZ2VuL3JYWnZZZE03dW5JSUdWM0JYR2JGaXBGWUwrUFdobXVQY1VLZTZ4QTdIZEVScmMwa2JJZHRtaWc1NkxzTXFFaFcreEdDQXgwQStwTjI5M24yV2lka3Job05pbkRyNWxYdzFwYzhhSUorNzYxUnI0UVVqZlRiaElRS1Y3ZjZVQm5YR2QwVGFtR00vYVViK0FjaUtzNjRNWUpSWVExdHZON0Z0RDBaNElLNnF3cFNsSmx3UzROWXp0c0lFVW9HYW1KRFFTTjhvd1pDa25RZEV3enU5enBGUEtOMWJxQzlwRlFQclk4MXpBVXRVakFBRVIxdlY1RUVtQXpxUE0ydEJiTXIrU2hEV0ZwRklyWXVxdUkrOVhTbllJQW9KYXg0eXV2Qy9xb2g2ZFRlbThpajZrM0I2VW8yeUhIQ2JDU2c5NnpJT0ZVaVFzN3dFZmE0UHNzTUNRQ0JBcTBDbXlsTjR3cy91SGUySmhjOEhYU0ZLbEtVOTE3MU5tOXZKTVFlOUlPaVh2ZmEwcVdTdTU3WERwN3ZPUlJWanBjZmU3YmxpSVdKaFVoVW8ya3lqdFVHcVlzcGpQT1JPaDRzSEx2T1R0anY3QlJlS3REVG9LNG9Mdlc2M2pLSDRFN3B0b3BHL1FUVFhSQ3dJaXJQUkllTFdRRWd2dE5Ua0pLNVcxRkszM1RGcGo0VGlVb0Q1aFpxOEpVTFdhT3pYU0Z2ckIyTVJlMW83NmNRWUVXazI2TTNSOTlWdFNMUVJoNFc5TXd2S0VCWDhpcUlXVUhIcGFjQ0JqK0RYbHNpOVFvdlFaRjd4YkI0RnY3VW9Bck9CbytzcWczaTVWYlZlZktMckI2UkFRWWVXeEptRlJ5aGdqTExUazYyRDNDdi96UWp2blNFMHpKa1d4ZjA4ZWRrTi9PSkRGOXdJc1gwellzVFIzVHJkT2RhY0JBVTI2L0ZUd1VnV2tEcXFFSlJ1V0p5em1oR2Z5UDZxSGE1TVdkOWRnaTBwSlVTQ21uQkc5ZG1ISTk2a1dLWlZyaW9BSUt3OG5kdDkrTVh5TnVEckd4WlhjR2xKcGFLSnJ3QnFMZlV5S29wVDRCek9EdEZScjVNNmhJOStucHN0UWpkVWlJTUlxSTBXSnlSTldpWEE4T1hrYlQ4d0NVWEtOcUJrN1NsR3dSYVdjTjNQdUJyNGZTRy84cDhFK043WXI2UHYwWVRON3RLYVRLbk1UQVdBcng5WkdrMEdFVlVkWWlIZUR0enV1VWw1M3IwWjZLU1R1SUNKZzk1T0YvRktwWHBXa3FCb0hVWVRoM09rYWpsSVNGdGJuRDgvM3BrTUlEWUtldlJTbVBGVGxlZUkzVitnYWdrMExSZ3BzeGEybEVhMnMxNHdJcTR3dEpSSnY5OEVPNEcyWmFxVWc2YmpUVnJOemlEcVFvakR4UFlGdzU3SjJCeTE2NzB1bG03K20vRGpnUGNZSG1WRXhKdmlmZ2Vmejc2Q2FXUVJFV09YSlFadVVKNnpTYnQrSFhNemhPODNzbDZINVh6bEpEVi81dGpEWktVWGhGVzRSQ0Y4aE9hRjhMVUg1MjBicERrbjU0SHlwcXc0QkVoUmVvZkpEY3NLbGZQVjErRFV0SmNJcXc1bnlQMEtOSEc1ZWtrbEpNWmowTWFnWVpJanNDVndZSkNqK2FrOUp2Wko2R2g5bWRDN1hpcWFUZHFYR2lEL1ZPSjlYbmxMVDByRllxZXY3YVZhRVZSN3JYRGFFbk5Oa2pyQzhxOEY3ZzVTRkhpRGtCTDVQclgrMS9TYUF5T280MXA2Y1FFejRjWUJxUndsV3hOUXBCNHF3eWdPVEM3ZXBJU3lvWHZSMjkybGErR3NkUDF2RFA4dExWNzFsbVRqRmtvakVoSHZTenRSS2dqM0ZjK2dlQXdJaXJQR3BFRS9TUVkyNEE0Z0VmN2p1R2c1Y1phdmNYY09ydHorbFZNT2xyZzd4U2ZZb1hYbEpsc1NFMTl6Ulp1T2pyeEpkSVNEQ0doK09GR0dCWExnNGZBdmUvV0VzMWk1S2J5MVZ0dGoycFVwWDlFR0RPb2NMR0VKeTRnL0YrT2lxeEtZUUVHR05EOWNQRG5uSFlYZUtsM2ZPOUF2a3VhSGdHR0doV1BTQ2IzWEFoWGNRYlVtRTQyaXRVNEk3cUhUeG9Gb05jcEtQMHpxWWQ5bXFDT3Y2c0pRY05GazZSMFplc3FuQkZ1VjlQcWdXNUJLbHF5MzVYSG1iRTZVbXFuWlM2N3Fra05OMnFtWlJuYlpINTdsYnlrR1RweDIvemN5UWRkTmZOWVJWSTJHaHpWUks1aVZTZzVldW9LSys0enlRVnQzVjI1eDhDQXZKU2J0MVZURHVwOUJlQ1lzNW9mQktCMDJRUk9wWC9GNHplNlNTc0ZEc21TRzBCVVJSdStCODBEVENZbDQyY3dwR3Y3RldLdWJNN3Z5L0dsVTZlb1pMYWxxSzZFN3I3NFd3dkFjNXcxeThnMlpKb3ZIZTY1d21PVFZycWtySTlsQVB0ckkzRGgvTU5aTEhEWUp6alMrTjRVeTNES3psUnJCVGttbjUyT2VhMEMyZklkY1dnMUR4NnIzSUVWb3h4VUV6NVl1Vmsxem1FaGFld2RlRlpBWlNySlhRVUQ5S1YzTkpyM1pzb21jNFhEdElUUElNcjBWUjVTWWhjRW1FNWFVby9zTG4wcXlVUU1MT0hTNmVlRE9Yc0dwdFdMNHZmdGR3YXQ2c21NSm16djF6dUhpVmptVzhaemcrbTBLdWt5YXBDZ3NCSXJCMXdpSkpSU2tLaTMzT0VWdGVTdkVwVzN6V1VHQlhJMkhOSVl5NGExaHJnNHJTMVJJblZFOU9QcDZPT1oxRVRPS1BzeUd3UmNJaVNmbjB2N1JIelNFcEQzNUtta0x1cWhlR0VhcXhZYzBocktqYTFibzVSTnRWclN1RFQvdE1nN2gyNk02MkhIWGpNUVMyUWxpUnBPYW9lbU5ZOFBzVUlmcTZKUkx4aEZkTEdxbCtlZlZ1ekJhVms2NjRFMGZYQWZUYmt4THVPOFdXVjR1ZnlnbUIxUkRvbWJCUzZoNlBvRm9xU2RVQW1zdlVVQ0tpc2ZReU5mZEZtU2tHK0hoNEt6QkNQK2ltNFRjY3BNN1Zqb0RLZFlsQWI0UkZhY0RuS20rbDdzMFpBTnFVWG4xSUgveUNvWUVTWnA2dzVxcUU3S2VYc21pVDhvNldlSSswelhTRlFEM2thUCtDSktjNVE2MDZXMENnRjhLS2gzdFM1Zk9IZVo0YlQ5cUpTa1RVUWlXazBmdjJJZGJ3SllrSForemkrOHpzVnZmOVVwSThOOGE2dnhBb0luQnV3a3J0eXZWRVVoNDhFbFlybGRCTFM3alAyTWsxeUV6Nm9BdjJiYmt6cUdVaUJEYUJ3RGtJQzc1R1BpUUdSdVV0Uk4xVFJTdTVHcVJVd3FqRzhmL1VCRW5sejNyTXpPNFlDdnQ3citsM3RZbkpxMDd1RDRGVEVSWkppbGsydDBKU2ZrYlFxVE8zYXdjaXdtR3JEdzJWZkc2c0hEbVJvRXFIUzBRRGZPcEU2U1YrVi91YjlYcml6U0t3Sm1IRjBCanVXaTNKUkhCT29Dazk0VnpDN3g4T2syQ2NIRzFPcGI0eFZBVWJDSE5PdnZIQjBRK1kyVDNoMks4bExoVG54RlQzRmdLVEVHaEpXRnk0aUNuekRvbHp2YzRuUFVqanduUUZZT3JqTWZ0UzZ2Ykk2YzZESlpaMkwrWFF5amFuaHZBczdZdnFDNEd6SWJDVXNHaVB3Y0xHb3FZa0FjTjU3NUlVU1FuOWhyVEVaK0huWTROQ255WStKejNFWVp6SDFYckhMdHFzMkQ5SlYyTWpwZTh2Qm9HNWhCVVQzdEZYcXJjZFBwSVBQYndwQmZvVGE4WUcweE1UY21NaGYxYk5xVG10Q1N0S1dlZ1hqUENNOFJ0N0RuMHZCRGFQUUMxaDVSdzZwNlpxV1FNd2toQmVLU21WZHVKeWZZZ1NVMnJua3E0TmF3VS9qK0Z6dzh6dVArd2FQajR6dUh1c2ZYMHZCTHBHWUl5d0dCN0RRR01zYW9URm5FUGRZMThBNkJ4SkNmVklTajZHYm9wVU9PYmFnSDc5Y1FpV2JpMWhkVDJSMURraGNBb0VVb1JGWW1ES2xsTjZuWE5uMFV0TnRUWWxqeGNKQ1gzbnNVKzByeTNCbGJ0MU9UZUNWckdFUy9xb3VrTGdZaEdJaEJVUDM4VENiQjFvekJURmM5VTNTa2srcStXcHpxS2pkM21Pc0x6M2VXMHVxNHVkWEhvd0lkQWFBVTlZbEI1YUdITlQzdDAxL2twNHZxZk43S25oUWIzcTFrTk9jQkpTenBWQWhOVjZocW85SWVBUThJU0ZBMENmTmJPN3c4bTVJQnFmbG9RN2JGVFZwa2hLSmVtSTNXcWh1cTAxeUZUNWNqbXhSRmhySWE5MmhjQkIzZk9FaGFPc3NHMC85L0trNXRVMXROZURkRFQzdVdLOTBzbk9JcXhXS0tzZElaQkFJTnF3dlB1Q0w0N1B2YjhQQ0lqWDNuSjlsOUxNZU1JYXl4U3FDU2tFaE1CRUJNYmNHaVkydDR2aUpkY0dUMWdLU043RmROQkRuaElCRWRaMHRMazVrZG9GOUx1c0lxenAyS3FHRUNnaUlNS2FQa0ZLYVdhOGhLV2c1T25ZcW9ZUUVHRTFuZ1BjS1V4SlVDS3N4bUNyT1NIZ0VaQ0VOWDArMUJLV1ZNTHAyS3FHRUpDRTFYZ09NR3ZDRTJhRzAzVDhKUnRXWTdEVm5CQ1FoTFY4RHRBWHF4VGFKQWxyT2M1cVFRaGNRVUFxNGJ3SlFkZUdtSkZCYmczejhGUXRJVkNGZ0FpckNxWnJoZWc4R3ZHVDQrZzhQRlZMQ0ZRaElNS3FnaWxMV0NVSlM1N3U4N0JWTFNHUVJVQ0VOVzl5NUNRc2IzVEhJUlQzeld0ZXRZU0FFRWdoSU1LYU55OXlSbmQvNk9uWHpPeXVlYzJybGhBUUFpS3Nkbk1nbDdIQm54OG9sYkFkM21wSkNOeEVRQkxXOUluZ1Q2K0pOaXgvRkpkQ2M2WmpxeHBDb0lpQUNHdjZCQ2tSbHBld1JGalRzVlVOSVNEQ1dtRU81STc3OG9TVnkwcTZRbmZVcEJEWUJ3S1NzT2FOTTFXL1NFcWVzS1J5ejhOV3RZUkFGZ0VSMXJ6SmdWVFNTQ21OeXg4Vkg0K1RGNzd6OEZVdElaQkVRQXRxM3NTQUhRdmt4QU02UUZxUXRxZ3FvbFdwaFBPd1ZTMGhJQWxyaFRuZ3czQkFUajgyc3p2ZGZSVDh2QUxvYW5MZkNFakNXamIrM3JNOXRxU0RWSmRocTlwQzRCb0NJcXpsa3lKRlduSnBXSTZyV2hBQzF4RDRIOUtlbEpMV0owemhBQUFBQUVsRlRrU3VRbUNDCgoKLS0tLS0tPW1odERvY3VtZW50UGFydC0tClBLAwQKAAAAAAANXm1aAAAAAAAAAAAAAAAACwAAAHdvcmQvX3JlbHMvUEsDBAoAAAAAAA1ebVpZIVOaMgEAADIBAAAcAAAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsczw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+CiAgPFJlbGF0aW9uc2hpcCBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL2FGQ2h1bmsiCiAgICBUYXJnZXQ9Ii93b3JkL2FmY2h1bmsubWh0IiBJZD0iaHRtbENodW5rIiAvPgo8L1JlbGF0aW9uc2hpcHM+ClBLAQIUAAoAAAAAAA1ebVqWJXaW0QEAANEBAAATAAAAAAAAAAAAAAAAAAAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQACgAAAAAADV5tWgAAAAAAAAAAAAAAAAYAAAAAAAAAAAAQAAAAAgIAAF9yZWxzL1BLAQIUAAoAAAAAAA1ebVoPwi/lSgEAAEoBAAALAAAAAAAAAAAAAAAAACYCAABfcmVscy8ucmVsc1BLAQIUAAoAAAAAAA1ebVoAAAAAAAAAAAAAAAAFAAAAAAAAAAAAEAAAAJkDAAB3b3JkL1BLAQIUAAoAAAAAAA1ebVoiPyHgCAgAAAgIAAARAAAAAAAAAAAAAAAAALwDAAB3b3JkL2RvY3VtZW50LnhtbFBLAQIUAAoAAAAAAA1ebVrSkdcHGTYAABk2AAAQAAAAAAAAAAAAAAAAAPMLAAB3b3JkL2FmY2h1bmsubWh0UEsBAhQACgAAAAAADV5tWgAAAAAAAAAAAAAAAAsAAAAAAAAAAAAQAAAAOkIAAHdvcmQvX3JlbHMvUEsBAhQACgAAAAAADV5tWlkhU5oyAQAAMgEAABwAAAAAAAAAAAAAAAAAY0IAAHdvcmQvX3JlbHMvZG9jdW1lbnQueG1sLnJlbHNQSwUGAAAAAAgACADhAQAAz0MAAAAA" })
            expect(JSON.parse(res.text).status).toBe(200)
        })
        test('Should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ _id: userId }, { role: 'manager' })
            const res = await request(app).post('/signedTemplate').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })
})

describe('Task===================================================', () => {
    let userId
    let jobRoleId
    describe('Administrator and Manager can create task', () => {
        let token
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingfortask@gmail.com'
                },
                password: 'Password@123',
                isDeleted: false,
                role: 'Administrator'
            })

            const user = await User.create({
                personalDetails: {
                    email: 'testeremployeefortask@gmail.com'
                },
                role: 'Employee',
                isDeleted: false,
                password: 'Password@123',
                jobDetails: [{
                    jobTitle: 'job-1',
                    role: 'Employee'
                }]
            })
            userId = user?._id
            jobRoleId = user.jobDetails?.[0]?._id
            const login = await request(app).post('/login').send({ email: 'testingfortask@gmail.com', password: 'Password@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = await JSON.parse(login.text).user.token
            const res = await request(app).post('/createTask')
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('Should return 200 for task created successfully', async () => {
            const res = await request(app).post('/createTask').set('Authorization', `Bearer ${token}`).send({
                "taskName": "first test task",
                "taskDescription": "do task",
                "taskDate": "2025-04-01",
                "startTime": "12:00",
                "endTime": "12:00",
                "userId": userId,
                "jobId": jobRoleId
            })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Task created successfully')
        })
        test('Should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ token }, { $set: { role: 'administrator' } })
            const res = await request(app).post('/createTask').set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('Superadmin, Administrator, Manager and Employee can get single task', () => {
        let taskId
        let token
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingforgettask@gmail.com'
                },
                password: 'Password@123',
                isDeleted: false,
                role: 'Manager'
            })

            const task = await Task.create({
                "taskName": "first test task",
                "taskDescription": "do task",
                "taskDate": "2025-04-01",
                "startTime": "12:00",
                "endTime": "12:00",
                "userId": userId,
                "jobId": jobRoleId
            })
            taskId = task._id
            const login = await request(app).post('/login').send({ email: 'testingforgettask@gmail.com', password: 'Password@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = await JSON.parse(login.text).user.token
            const res = await request(app).get(`/getTask/${taskId}`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for task not found', async () => {
            const res = await request(app).get(`/getTask/${userId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Task not found')
        })
        test('should return 200 for task fetched successsfully', async () => {
            const res = await request(app).get(`/getTask/${taskId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Task fetched successfully')
        })
        test('Should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ token }, { $set: { role: 'superadmin' } })
            const res = await request(app).get(`/getTask/${taskId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('Superadmin, Administrator, Manager and Employee can get all tasks', () => {
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingforgetalltask@gmail.com'
                },
                password: 'Password@123',
                isDeleted: false,
                role: 'Superadmin'
            })

            const login = await request(app).post('/login').send({ email: 'testingforgetalltask@gmail.com', password: 'Password@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = await JSON.parse(login.text).user.token
            const res = await request(app).get(`/getAllTasks`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 200 for task fetched successsfully', async () => {
            const res = await request(app).get(`/getAllTasks`).set('Authorization', `Bearer ${token}`).send({ userId, jobId: jobRoleId })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('All tasks fetched successfully')
        })
        test('Should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ token }, { $set: { role: 'superadmin' } })
            const res = await request(app).get(`/getAllTasks`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('Administrator and Manager can update task', () => {
        let taskId
        let token
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingforupdatetask@gmail.com'
                },
                password: 'Password@123',
                isDeleted: false,
                role: 'Administrator'
            })

            const task = await Task.create({
                "taskName": "second test task",
                "taskDescription": "do task",
                "taskDate": "2025-04-01",
                "startTime": "12:00",
                "endTime": "12:00",
                "userId": userId,
                "jobId": jobRoleId
            })
            taskId = task._id
            const login = await request(app).post('/login').send({ email: 'testingforupdatetask@gmail.com', password: 'Password@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = await JSON.parse(login.text).user.token
            const res = await request(app).post(`/updateTask/${taskId}`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for task not found', async () => {
            const res = await request(app).post(`/updateTask/${userId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Task not found')
        })
        test('should return 200 for task fetched successsfully', async () => {
            const res = await request(app).post(`/updateTask/${taskId}`).set('Authorization', `Bearer ${token}`).send({
                "taskName": "second test task",
                "taskDescription": "do updated task",
                "taskDate": "2025-04-01",
                "startTime": "12:00",
                "endTime": "12:00"
            })
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Task updated successfully')
        })
        test('Should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ token }, { $set: { role: 'administrator' } })
            const res = await request(app).post(`/updateTask/${taskId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })

    describe('Administrator and Manager can cancel task', () => {
        let taskId
        let token
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingfordeletetask@gmail.com'
                },
                password: 'Password@123',
                isDeleted: false,
                role: 'Manager'
            })

            const task = await Task.create({
                "taskName": "first test task",
                "taskDescription": "do task",
                "taskDate": "2025-04-01",
                "startTime": "12:00",
                "endTime": "12:00",
                "userId": userId,
                "jobId": jobRoleId
            })
            taskId = task._id
            const login = await request(app).post('/login').send({ email: 'testingfordeletetask@gmail.com', password: 'Password@123' })
            expect(JSON.parse(login.text).status).toBe(200)
            token = await JSON.parse(login.text).user.token
            const res = await request(app).post(`/cancelTask/${taskId}`)
            expect(JSON.parse(res.text).status).toBe(401)
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key')
        })
        test('should return 404 for task not found', async () => {
            const res = await request(app).post(`/cancelTask/${userId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(404)
            expect(JSON.parse(res.text).message).toBe('Task not found')
        })
        test('should return 200 for task fetched successsfully', async () => {
            const res = await request(app).post(`/cancelTask/${taskId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(200)
            expect(JSON.parse(res.text).message).toBe('Task cancelled successfully')
        })
        test('Should return 403 for Access denied', async () => {
            await User.findOneAndUpdate({ token }, { $set: { role: 'superadmin' } })
            const res = await request(app).post(`/cancelTask/${taskId}`).set('Authorization', `Bearer ${token}`)
            expect(JSON.parse(res.text).status).toBe(403)
            expect(JSON.parse(res.text).message).toBe('Access denied')
        })
    })
})

describe('Get logged in all users', () => {
    describe('Superadmin get all logged in users', () => {
        let createdSAToken
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingsuperadminforgetloggedinuser@example.com',
                },
                password: 'Password@123',
                isDeleted: false,
                role: 'Superadmin'
            });
            const userRes = await request(app)
                .post('/login')
                .send({
                    email: 'testingsuperadminforgetloggedinuser@example.com',
                    password: 'Password@123',
                });

            expect(JSON.parse(userRes.text).status).toBe(200);
            expect(JSON.parse(userRes.text).message).toBe('User login successfully');
            expect(JSON.parse(userRes.text).user).toHaveProperty('token');
            createdSAToken = JSON.parse(userRes.text).user.token
            const res = await request(app)
                .get('/getAllLoggedInOutUsers')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for fetch all users', async () => {
            const res = await request(app).get('/getAllLoggedInOutUsers').set('Authorization', `Bearer ${createdSAToken}`)
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('Users fetched successfully.');
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
            const res1 = await request(app).get('/getAllLoggedInOutUsers').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe("~ Administrator get own company's employees", () => {
        let createdADToken
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingadministratorforgetloggedinusers@example.com',
                },
                password: 'Password@123',
                isDeleted: false,
                role: 'Administrator'
            });
            const userRes = await request(app)
                .post('/login')
                .send({
                    email: 'testingadministratorforgetloggedinusers@example.com',
                    password: 'Password@123',
                });

            expect(JSON.parse(userRes.text).status).toBe(200);
            expect(JSON.parse(userRes.text).message).toBe('User login successfully');
            expect(JSON.parse(userRes.text).user).toHaveProperty('token');
            createdADToken = JSON.parse(userRes.text).user.token
            const res = await request(app)
                .get('/getAllLoggedInOutUsers')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for fetch all own companys employee', async () => {
            const res = await request(app).get('/getAllLoggedInOutUsers').set('Authorization', `Bearer ${createdADToken}`)
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('Users fetched successfully.');
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
            const res1 = await request(app).get('/getAllLoggedInOutUsers').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })

    describe("~ Manager can get their under employees", () => {
        let createdMToken
        test('should return 401 for Unauthorized: Invalid API key', async () => {
            await User.create({
                personalDetails: {
                    email: 'testingmanagerforgetloggedinuser@example.com',
                },
                password: 'Password@123',
                isDeleted: false,
                role: 'Manager'
            });
            const userRes = await request(app)
                .post('/login')
                .send({
                    email: 'testingmanagerforgetloggedinuser@example.com',
                    password: 'Password@123',
                });

            expect(JSON.parse(userRes.text).status).toBe(200);
            expect(JSON.parse(userRes.text).message).toBe('User login successfully');
            expect(JSON.parse(userRes.text).user).toHaveProperty('token');
            createdMToken = JSON.parse(userRes.text).user.token
            const res = await request(app)
                .get('/getAllLoggedInOutUsers')
            expect(JSON.parse(res.text).status).toBe(401);
            expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
        })
        test('should return 200 for fetch all their companys employee', async () => {
            const res = await request(app).get('/getAllLoggedInOutUsers').set('Authorization', `Bearer ${createdMToken}`)
            expect(JSON.parse(res.text).status).toBe(200);
            expect(JSON.parse(res.text).message).toBe('Users fetched successfully.');
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
            const res1 = await request(app).get('/getAllLoggedInOutUsers').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
            expect(JSON.parse(res1.text).status).toBe(403);
            expect(JSON.parse(res1.text).message).toBe('Access denied');
        });
    })
})
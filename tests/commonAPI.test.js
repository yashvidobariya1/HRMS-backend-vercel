const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const bcrypt = require('bcrypt');
const Timesheet = require('../models/timeSheet');

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

describe('~ Login API', () => {
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

describe('~ Logout API', () => {
    test('Should return 200 for logout successfully', async () => {
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
        usertoken = JSON.parse(res.text).user.token
        const res2 = await request(app).post('/logOut').set('Authorization', `Bearer ${usertoken}`)
        expect(JSON.parse(res2.text).status).toBe(200)
        expect(JSON.parse(res2.text).message).toBe('Logging out successfully.')
    })
})

describe('~ Update password API', () => {
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

describe('~ Forgot Password process API', () => {
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
            const otp = JSON.parse(res.text).message;
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

describe('~ get user job titles', () => {
    let createdToken
    test('Should return 200 for job title get successfully', async () => {
        const hashedPassword = await bcrypt.hash('Password@123', 10);
        await User.create({
            personalDetails: {
                email: 'test@example.com',
            },
            jobDetails: [{ jobTitle: '' }],
            password: hashedPassword,
            isDeleted: false,
        });

        await request(app)
            .post('/login')
            .send({
                email: 'test@example.com',
                password: 'Password@123',
            });
        const res = await request(app)
        .get('/getJobTitle')
        .set("Authorization", "Bearer " + token)
        expect(JSON.parse(res.text).status).toBe(200);
        expect(JSON.parse(res.text).message).toBe('User job titles get successfully.')
    })
})

describe('~ Get Users Details', () => {
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
    test('should return 403 for forbidden roles', async () => {
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

describe('~ Get all Users', () => {
    let token
    test('should return 401 for Unauthorized: Invalid API key', async () => {
        const hashedPassword = await bcrypt.hash('Super@123', 10);
        await User.create({
            personalDetails: {
                email: 'super@example.com',
            },
            password: hashedPassword,
            isDeleted: false,
            role: 'Superadmin'
        });
        const userRes = await request(app)
            .post('/login')
            .send({
                email: 'super@example.com',
                password: 'Super@123',
            });

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
        const res1 = await request(app).get('/getAllUsers').set('Authorization', `Bearer ${token}`);
        expect(JSON.parse(res1.text).status).toBe(200);
        expect(JSON.parse(res1.text).message).toBe('Users get successfully.');
    });
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
        const res1 = await request(app).get('/getAllUsers').set('Authorization', `Bearer ${JSON.parse(res.text).user.token}`);
        expect(JSON.parse(res1.text).status).toBe(403);
        expect(JSON.parse(res1.text).message).toBe('Access denied');
    });
})

describe('~ ClockIn or ClockOut for employees and managers', () => {
    // describe('ClockIn', () => {
    //     let userId
    //     let token
    //     let jobTitle
    //     test('should return 401 for Unauthorized: Invalid API key', async () => {
    //         const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
    //         const user = await User.create({
    //             personalDetails: {
    //                 email: 'abcd@example.com',
    //             },
    //             jobDetails: [{
    //                 jobTitle: 'webDeveloper'
    //             }],
    //             password: hashedPassword,
    //             isDeleted: false,
    //             role: 'Administrator'
    //         })
    //         userId = (user._id).toString()
    //         jobTitle = user?.jobDetails[0]?.jobTitle
    //         const userRes = await request(app)
    //             .post('/login')
    //             .send({
    //                 email: 'test123@example.com',
    //                 password: 'Test@123',
    //             });

    //         expect(JSON.parse(userRes.text).status).toBe(200);
    //         expect(JSON.parse(userRes.text).message).toBe('User login successfully');
    //         expect(JSON.parse(userRes.text).user).toHaveProperty('token');
    //         token = JSON.parse(userRes.text).user.token
    //         const res = await request(app)
    //             .post('/clockIn')
    //         expect(JSON.parse(res.text).status).toBe(401);
    //         expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
    //     })
    //     test('should return 200 for clock-In', async () => {
    //         const res = await request(app)
    //             .post('/clockIn')
    //             .send({ userId, location: { latitude: 21.2337, longitude: 72.8138 }, jobTitle })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(200);
    //     })
    //     test('should return 404 for non-existing user', async () => {
    //         const res = await request(app)
    //             .post('/clockIn').send({
    //                 userId: "677bcb7b726c3fb89e7a03b4"
    //             }).set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(404);
    //         expect(JSON.parse(res.text).message).toBe('User not found');
    //     })
    //     test("should return 400 for, location coordinator data not found", async () => {
    //         const res = await request(app)
    //             .post('/clockIn')
    //             .send({ userId })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(400);
    //         expect(JSON.parse(res.text).message).toBe('Location coordinator data is not found!');
    //     })
    //     // for new method
    //     // test("should return 400 for, existing role is not match", async () => {
    //     //     const res = await request(app)
    //     //         .post('/clockIn')
    //     //         .send({ userId, location: { latitude: 21.2337, longitude: 72.8138 } })
    //     //         .set('Authorization', `Bearer ${token}`)
    //     //     expect(JSON.parse(res.text).status).toBe(400);
    //     //     expect(JSON.parse(res.text).message).toBe('You cannot access the clock-in feature for this role, please switch to the appropriate role!');
    //     // })
    //     test('should return 403 for outside the geofenc area', async () => {
    //         const res = await request(app)
    //             .post('/clockIn')
    //             .send({ userId, location: { latitude: "72.8302", longitude: "21.1959" }, jobTitle })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(403);
    //         expect(JSON.parse(res.text).message).toBe('You are outside the geofence area.');
    //     })
    //     test('should return 400 for clockIn before clockOut', async () => {
    //         Timesheet.create({
    //             userId,
    //             date: 'YYYY-MM-DD',
    //             clockinTime: []
    //         })
    //         const res = await request(app)
    //             .post('/clockIn')
    //             .send({ userId, location: { latitude: 21.2337, longitude: 72.8138 }, jobTitle })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(400);
    //         expect(JSON.parse(res.text).message).toBe('Please clock out before clockin again.')
    //     })
    //     test('should return 403 for Access denied', async () => {
    //         const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
    //         const user = await User.create({
    //             personalDetails: {
    //                 email: 'xyz@example.com',
    //             },
    //             password: hashedPassword,
    //             isDeleted: false,
    //             role: 'Superadmin'
    //         });

    //         const userRes = await request(app)
    //             .post('/login')
    //             .send({
    //                 email: 'xyz@example.com',
    //                 password: 'Abcd@1234',
    //             });

    //         expect(JSON.parse(userRes.text).status).toBe(200);
    //         expect(JSON.parse(userRes.text).message).toBe('User login successfully');
    //         expect(JSON.parse(userRes.text).user).toHaveProperty('token');

    //         const token = JSON.parse(userRes.text).user.token;
    //         const res = await request(app)
    //             .post('/clockIn')
    //             .send({ userId, location: { latitude: "21.1959", longitude: "72.8302" } })
    //             .set('Authorization', `Bearer ${token}`);

    //         expect(JSON.parse(res.text).status).toBe(403);
    //         expect(JSON.parse(res.text).message).toBe('Access denied');
    //     });
    // })
    // describe('ClockOut', () => {
    //     let userId
    //     let token
    //     let jobTitle
    //     test('should return 401 for Unauthorized: Invalid API key', async () => {
    //         const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
    //         const user = await User.create({
    //             personalDetails: {
    //                 email: 'abcd@example.com',
    //             },
    //             jobDetails: [{
    //                 jobTitle: 'webDeveloper'
    //             }],
    //             password: hashedPassword
    //         })
    //         userId = (user._id).toString()
    //         const userRes = await request(app)
    //             .post('/login')
    //             .send({
    //                 email: 'test123@example.com',
    //                 password: 'Test@123',
    //             });

    //         expect(JSON.parse(userRes.text).status).toBe(200);
    //         expect(JSON.parse(userRes.text).message).toBe('User login successfully');
    //         expect(JSON.parse(userRes.text).user).toHaveProperty('token');
    //         jobTitle = user.jobDetails[0].jobTitle
    //         token = JSON.parse(userRes.text).user.token
    //         const res = await request(app)
    //             .post('/clockOut')
    //         expect(JSON.parse(res.text).status).toBe(401);
    //         expect(JSON.parse(res.text).message).toBe('Unauthorized: Invalid API key');
    //     })
    //     test('should return 404 for non-existing user', async () => {
    //         const res = await request(app)
    //             .post('/clockOut').send({
    //                 userId: "677bcb7b726c3fb89e7a03b4"
    //             }).set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(404);
    //         expect(JSON.parse(res.text).message).toBe('User not found');
    //     })
    //     test('should return 404 for time sheet not found', async () => {
    //         const res = await request(app)
    //             .post('/clockOut')
    //             .send({ userId, location: { latitude: "72.8302", longitude: "21.1959" }, jobTitle })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(404);
    //         expect(JSON.parse(res.text).message).toBe('No timesheet found for today.');
    //     })
    //     test("should return 400 for, location coordinator data not found", async () => {
    //         const res = await request(app)
    //             .post('/clockOut')
    //             .send({ userId })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(400);
    //         expect(JSON.parse(res.text).message).toBe('Location coordinator data is not found!');
    //     })
    //     test('should return 404 for time sheet not found', async () => {
    //         const res = await request(app)
    //             .post('/clockOut')
    //             .send({ userId, location: { latitude: "21.1959", longitude: "72.8302" } })
    //             .set('Authorization', `Bearer ${token}`);
    //         expect(JSON.parse(res.text).status).toBe(404);
    //         expect(JSON.parse(res.text).message).toBe('No timesheet found for today.');
    //     })
    //     test('should return 200 for clock-Out', async () => {            
    //         const resclockin = await request(app)
    //             .post('/clockIn')
    //             .send({ userId, location: { latitude: 21.2337, longitude: 72.8138 }, jobTitle })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(resclockin.text).status).toBe(200);
    //         const resclockout = await request(app)
    //             .post('/clockOut')
    //             .send({ userId, location: { latitude: 21.2337, longitude: 72.8138 }, jobTitle })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(resclockout.text).status).toBe(200);
    //     })
    //     test('should return 400 for not clock-out without an active clock-in.', async () => {
    //         const res = await request(app)
    //             .post('/clockOut')
    //             .send({ userId, location: { latitude: 21.2337, longitude: 72.8138 }, jobTitle })
    //             .set('Authorization', `Bearer ${token}`)
    //         expect(JSON.parse(res.text).status).toBe(400);
    //         expect(JSON.parse(res.text).message).toBe("You can't clock-out without an active clock-in.");
    //     })
    //     test('should return 403 for Access denied for unauthorized role', async () => {
    //         const hashedPassword = await bcrypt.hash('Abcd@1234', 10);
    //         const user = await User.create({
    //             personalDetails: {
    //                 email: 'superadmin@example.com',
    //             },
    //             password: hashedPassword,
    //             isDeleted: false,
    //             role: 'User'
    //         });

    //         const userRes = await request(app)
    //             .post('/login')
    //             .send({
    //                 email: 'superadmin@example.com',
    //                 password: 'Abcd@1234',
    //             });

    //         expect(JSON.parse(userRes.text).status).toBe(200);
    //         expect(JSON.parse(userRes.text).message).toBe('User login successfully');
    //         expect(JSON.parse(userRes.text).user).toHaveProperty('token');
    //         const token = JSON.parse(userRes.text).user.token;

    //         const res = await request(app)
    //             .post('/clockOut')
    //             .send({ userId: user._id.toString(), location: { latitude: "21.1959", longitude: "72.8302" } })
    //             .set('Authorization', `Bearer ${token}`);

    //         expect(JSON.parse(res.text).status).toBe(403);
    //         expect(JSON.parse(res.text).message).toBe('Access denied');
    //     });
    // })
})
require('dotenv').config();
const nodemailer = require('nodemailer');

exports.transporter = nodemailer.createTransport({
    host: "send.one.com",
    port: 587, // Use 587 if TLS, 465 for SSL
    // secure: true, // True for SSL, false for TLS // Use SSL encryption (only works with port: 465)
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
    },
    tls: {
        rejectUnauthorized: false,
    }
})
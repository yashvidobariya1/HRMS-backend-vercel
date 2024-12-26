const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const Company = require('../models/company')

const mongoURI = "mongodb://localhost:27017/HRMS-testing"

beforeAll(async () => {
    try {
        await mongoose.connect(mongoURI)
        console.log("Connected to MongoDB")
    } catch (error) {
        console.error("Error connecting to MongoDB:", error)
        process.exit(1)
    }
})

afterAll(async () => {
    await mongoose.connection.close()
})

let employee;
let companies;

beforeEach(async () => {
    employee = await User.find()
    // console.log('employees/...', employee)
    companies = await Company.find()
    // console.log('companies/...', companies)
});


// this all function called by employee



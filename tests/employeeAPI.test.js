const request = require('supertest')
const app = require('../server')
const mongoose = require('mongoose')
const User = require('../models/user')
const Company = require('../models/company')

afterAll(async () => {
    await mongoose.connection.close()
})

let employee;
let companies;

beforeAll(async () => {
    employee = await User.find()
    // console.log('employees/...', employee)
    companies = await Company.find()
    // console.log('companies/...', companies)
});


// this all function called by employee



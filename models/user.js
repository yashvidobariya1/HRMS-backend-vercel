const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  personalDetails: {
    firstName: String,
    middleName: String,
    lastName: String,
    dateOfBirth: Date,
    gender: { type: String, enum: ['Male', 'Female'] },
    maritalStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'] },
    phone: String,
    homeTelephone: String,
    email: String,
    niNumber: String,
    sendRegistrationLink: { type: Boolean, default: false },
  },
  addressDetails: {
    address: String,
    addressLine2: String,
    city: String,
    postCode: String,
  },
  kinDetails: {
    kinName: String,
    relationshipToYou: String,
    address: String,
    postCode: String,
    emergencyContactNumber: String,
    email: String,
  },
  financialDetails: {
    bankName: String,
    holderName: String,
    sortCode: String,
    accountNumber: String,
    payrollFrequency: String,
    pension: String,
  },
  jobDetails: {
    jobTitle: String,
    jobDescription: String,
    annualSalary: Number,
    hourlyRate: Number,
    weeklyWorkingHours: String,
    weeklyWorkingHoursPattern: String,
    weeklySalary: Number,
    joiningDate: Date,
    socCode: String,
    sickLeavesAllow: String,
    leavesAllow: String,
    location: String,
    assignManager: String,
    role: String
  },
  immigrationDetails: {
    passportNumber: String,
    countryOfIssue: String,
    passportExpiry: String,
    nationality: String,
    visaCategory: String,
    visaValidFrom: Date,
    visaValidTo: Date,
    brpNumber: String,
    cosNumber: String,
    restriction: String,
    shareCode: String,
    rightToWorkCheckDate: Date,
    rightToWorkEndDate: Date
  },
  documentDetails: [{
    documentType: String,
    document: String,
  }],
  contractDetails: {
    contractType: String,
    contractDocument: String,
  },
  role: {
    type: String, enum: ['Administrator', 'Manager', 'Employee']
  },
  createdBy: {
    type: String, enum: ['Superadmin', 'Administrator', 'Manager']
  },
  initiatorUserId: {
    type: mongoose.Schema.Types.ObjectId
  },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;

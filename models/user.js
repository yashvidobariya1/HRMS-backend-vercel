const mongoose = require('mongoose');
const jwt = require('jsonwebtoken')

const userSchema = new mongoose.Schema({
  isDeleted: {
    type: Boolean, default: false
  },
  personalDetails: {
    firstName: String,
    middleName: String,
    lastName: String,
    dateOfBirth: String,
    gender: String,
    maritalStatus: String,
    phone: String,
    homeTelephone: String,
    email: String,
    niNumber: String,
    sendRegistrationLink: Boolean,
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
    sortCode: String, // only 6 digit
    accountNumber: String, // only 8 digit
    payrollFrequency: String,
    pension: String,
  },
  jobDetails: {
    jobTitle: String,
    jobDescription: String,
    annualSalary: Number,
    hourlyRate: Number,
    weeklyWorkingHours: Number,
    weeklyWorkingHoursPattern: String,
    weeklySalary: Number,
    joiningDate: String,
    socCode: String, // only four digit
    modeOfTransfer: String,
    sickLeavesAllow: Number,
    leavesAllow: Number,
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
    visaValidFrom: String,
    visaValidTo: String,
    brpNumber: String,
    cosNumber: String,
    restriction: String,
    shareCode: String,
    rightToWorkCheckDate: String,
    rightToWorkEndDate: String
  },
  documentDetails: [{
    documentType: String,
    document: String,
  }],
  contractDetails: {
    contractType: String,
    contractDocument: String,
  },
  password: String,
  role: {
    type: String
  },
  password: String,
  lastKnownLocation: {
    latitude: String,
    longitude: String
  },
  otp: {
    type: Number
  },
  token: {
    type: String,
    default: ""
  },
  createdBy: {
    type: String
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId
  },
  canceledAt: Date,
}, { timestamps: true });

userSchema.methods.generateAuthToken = async function() {
  const user = this
  const token = jwt.sign({_id: user._id.toString()}, process.env.JWT_SECRET)

  user.token = user.token
  await user.save()

  return token
}

const User = mongoose.model('User', userSchema);

module.exports = User;

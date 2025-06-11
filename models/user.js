const mongoose = require('mongoose');
const jwt = require('jsonwebtoken')

const userSchema = new mongoose.Schema({
  unique_ID: { type: Number, unique: true },
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
    phone: { type: String, unique: true },
    homeTelephone: String,
    email: { type: String, unique: true },
    niNumber: String,
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
  jobDetails: [{
    jobTitle: String,
    jobDescription: String,
    annualSalary: String,
    hourlyRate: Number,
    weeklyWorkingHours: Number,
    weeklyWorkingHoursPattern: String,
    weeklySalary: Number,
    joiningDate: String,
    socCode: String, // only four digit
    modeOfTransfer: String,
    sickLeavesAllow: {
      leaveType: {
        type: String,
        enum: ['Day', 'Hour'],
        default: 'Day'
      },
      allowedLeavesCounts: Number
    },
    leavesAllow: {
      leaveType: {
        type: String,
        enum: ['Day', 'Hour'],
        default: 'Day'
      },
      allowedLeavesCounts: Number
    },    
    // location: String,
    location: [{ type: String, ref: 'Location' }],
    assignManager: { type: String, ref: 'User' },
    assignClient: [{ type: String, ref: 'Client' }],
    isWorkFromOffice: Boolean,
    // templateId: { type: String, ref: 'Templates' },
    // isTemplateSigned: {
    //   type: Boolean,
    //   default: true
    // },
    // signedTemplateURL: String,
    role: String
  }],
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
  // documentDetails: [{
  //   documentType: String,
  //   documentName: String,
  //   document: String
  // }],
  documentDetails: [{
    documentType: String,
    documents: [{
      documentName: String,
      document: String
    }]
  }],
  contractDetails: {
    contractType: String,
    // contractDocument: {
    //   fileName: String,
    //   fileURL: String,
    // },
    contractDocument: { type: String, ref: 'Contract' }
  },
  userContractURL: String,
  password: String,
  role: {
    type: String
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  locationId: [{
    type: String,
    ref: 'Location'
  }],
  // clientId: [{
  //   type: String,
  //   ref: 'Client'
  // }],
  lastKnownLocation: {
    latitude: String,
    longitude: String
  },
  templates: [{
    templateId: { type: String, ref: 'Templates'},
    isSignRequired: Boolean,
    isReadRequired: Boolean,
    templateURL: String,
    isTemplateVerify: Boolean,
  }],
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isOTPVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFormFilled: { type: Boolean, default: true},
  isLoggedIn: Boolean,
  usedBrowser: String,
  userIPAddess: String,
  lastTimeAccess: Date,
  lastTimeLoggedIn: Date,
  lastTimeLoggedOut: Date,
  canceledAt: Date,
}, { timestamps: true });

userSchema.methods.generateAuthToken = async function() {
  const user = this
  const token = jwt.sign({_id: user._id.toString()}, process.env.JWT_SECRET)
  return token
}

const User = mongoose.model('User', userSchema);

module.exports = User;

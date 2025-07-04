const User = require("../models/user");
const Location = require("../models/location");
const Company = require("../models/company");
const Contract = require("../models/contract");
const bcrypt = require("bcrypt");
const { promisify } = require("util");
const { transporter } = require("../utils/nodeMailer");
const moment = require("moment");
const { default: axios } = require("axios");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const useragent = require("useragent");
const Template = require("../models/template");
const Task = require("../models/task");
const Timesheet = require("../models/timeSheet");
const Client = require("../models/client");
const LoginAudit = require("../models/loginAudit");
const { unique_Id, uploadToS3, uploadBufferToS3 } = require("../utils/AWS_S3");
const { getAllLoggedInOutUsers } = require("./loggedInUser");

// exports.login = async (req, res) => {
//     try {
//         if (!req.body.email || !req.body.password) {
//             return res.send({ status: 400, message: "Email and password are required" });
//         }

//         const isExist = await User.findOne({ "personalDetails.email": req.body.email, isDeleted: false });

//         if (!isExist) {
//             return res.send({ status: 404, message: "User not found" });
//         }

//         if(isExist && isExist?.isActive === false){
//             return res.send({ status: 400, message: 'You do not have permission to logIn!' })
//         }

//         const token = await isExist.generateAuthToken()
//         const browser = useragent.parse(req.headers["user-agent"]);
//         isExist.token = token
//         // isExist.token = token.JWTToken
//         isExist.lastTimeLoggedIn = moment().toDate()
//         isExist.isLoggedIn = true
//         isExist.usedBrowser = browser
//         await isExist.save()

//         const personalDetails = isExist?.personalDetails
//         const role = isExist?.role
//         const createdAt = isExist?.createdAt
//         const _id = isExist?._id

//         if (isExist.password == req.body.password) {
//             return res.send({
//                 status: 200,
//                 message: "User login successfully",
//                 user: { personalDetails, role, token, createdAt, _id },
//                 // user: { personalDetails, role, token: token.encrypted_token, createdAt, _id },
//             });
//         } else {
//             const hashedPassword = isExist.password;
//             bcrypt.compare(req.body.password, hashedPassword, async (err, result) => {
//                 if (err) {
//                     console.error("Error comparing passwords:", err);
//                     return res.send({ status: 500, message: "Internal server error" });
//                 }
//                 if (!result) {
//                     return res.send({ status: 401, message: "Invalid credential" });
//                 }
//                 return res.send({
//                     status: 200,
//                     message: "User login successfully",
//                     user: { personalDetails, role, token, createdAt, _id },
//                     // user: { personalDetails, role, token: token.encrypted_token, createdAt, _id },
//                 });
//             });
//         }
//     } catch (error) {
//         console.error("Error occurred while logging in:", error);
//         return res.send({ status: 500, message: "Something went wrong while login!" })
//     }
// };

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.send({ status: 400, message: "Email or password is required" });
  }

  try {
    const isExist = await User.findOne(
      { "personalDetails.email": email, isDeleted: false },
      {
        password: 1,
        isActive: 1,
        companyId: 1,
        personalDetails: 1,
        role: 1,
        createdAt: 1,
        isFormFilled: 1,
      }
    );

    if (!isExist) {
      return res.send({ status: 404, message: "User not found" });
    }

    const ipAddress =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const browser = useragent.parse(req.headers["user-agent"]);

    if (!isExist.isActive) {
      await LoginAudit.create({
        userId: isExist?._id,
        companyId: isExist?.companyId,
        reason: "Inactive user tried to login",
        attemptTime: moment().toDate(),
        isLoggedIn: false,
        ipAddress,
        browser,
      });
      return res.send({
        status: 403,
        message: "You do not have permission to log in!",
      });
    }

    let passwordValid = false;

    if (isExist.password === password) {
      passwordValid = true;
    } else {
      const compareAsync = promisify(bcrypt.compare);
      passwordValid = await compareAsync(password, isExist.password);
    }

    if (!passwordValid) {
      await LoginAudit.create({
        userId: isExist?._id,
        companyId: isExist?.companyId,
        reason: "Login attempt with invalid credentials",
        attemptTime: moment().toDate(),
        isLoggedIn: false,
        ipAddress,
        browser,
      });
      return res.send({ status: 401, message: "Invalid credential" });
    }

    const token = await isExist.generateAuthToken();
    isExist.token = token;
    await isExist.save();

    const loggedInAudit = await LoginAudit.findOne({
      userId: isExist?._id,
      companyId: isExist?.companyId,
      isLoggedIn: true,
    });

    if (loggedInAudit) {
      loggedInAudit.lastTimeLoggedIn = moment().toDate();
      loggedInAudit.isLoggedIn = false;
      await loggedInAudit.save();
    }

    await LoginAudit.create({
      userId: isExist?._id,
      companyId: isExist?.companyId,
      attemptTime: moment().toDate(),
      isLoggedIn: true,
      ipAddress,
      lastTimeAccess: moment().toDate(),
      lastTimeLoggedIn: moment().toDate(),
      browser,
    });

    const personalDetails = isExist?.personalDetails;
    const role = isExist?.role;
    const createdAt = isExist?.createdAt;
    const _id = isExist?._id;
    const isFormFilled = isExist?.isFormFilled;

    return res.send({
      status: 200,
      message: "User login successfully",
      user: { personalDetails, role, token, createdAt, _id, isFormFilled },
    });
  } catch (error) {
    console.error("Error occurred while login:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while login!",
    });
  }
};

exports.logOut = async (req, res) => {
  try {
    const userId = req.query.userId;

    const existUser = await User.findOne({
      _id: userId,
      isDeleted: { $ne: true },
    });
    if (!existUser) {
      return res.send({ status: 404, message: "User not found" });
    }

    existUser.token = "";
    await existUser.save();

    await LoginAudit.findOneAndUpdate(
      { userId: existUser._id, isLoggedIn: true },
      {
        lastTimeLoggedOut: moment().toDate(),
        isLoggedIn: false,
      },
      { new: true }
    );

    return res.send({ status: 200, message: "Logging out successfully." });
  } catch (error) {
    console.error("Error occurred while logging out:", error);
    return res.send({
      status: 500,
      message: "Error occurred while logging out!",
    });
  }
};

exports.emailVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.send({
        status: 400,
        message: "Please enter valid email address.",
      });
    }

    const findUser = await User.findOne({ "personalDetails.email": email });
    if (!findUser) {
      return res.send({ status: 404, message: "User not found." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    findUser.otp = otp;
    await findUser.save();

    if (otp) {
      let mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: findUser.personalDetails.email,
        subject: "City Clean London: Password recovery",
        html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="text-align: center; color: #4CAF50;">OTP Verification</h2>
                        <p>Dear ${findUser.personalDetails.firstName},</p>
                        <p>We received a request to verify your email address. Please use the OTP below to complete the verification process:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <span style="font-size: 24px; font-weight: bold; color: #333; padding: 10px 20px; background-color: #f4f4f4; border-radius: 5px; display: inline-block;">
                                ${otp}
                            </span>
                        </div>
                        <p style="text-align: center;">This OTP is valid for the next 10 minutes.</p>
                        <p>If you did not request this verification, please ignore this email or contact support if you have concerns.</p>
                        <hr style="border: none; border-top: 1px solid #ddd;">
                        <p style="font-size: 12px; color: #888; text-align: center;">
                            This is an automated message. Please do not reply.
                        </p>
                    </div>
                `,
      };

      await transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          if (error.code == "EENVELOPE") {
            console.warn(
              "Invalid email address, while email verification:",
              findUser.personalDetails.email
            );
          } else {
            console.error("Error while email verification:", error);
          }
        }
        if (info) {
          console.log("Email sent successfully:", info.response);
        }
      });

      findUser.isEmailVerified = true;
      await findUser.save();

      return res.send({
        status: 200,
        message: "OTP will be send to your registered email",
        otp,
      });
    } else {
      return res.send({ status: 400, message: "OTP not generated." });
    }
  } catch (error) {
    console.error("Error occurred while email verification:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while email verification!",
    });
  }
};

exports.otpVerification = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const findUser = await User.findOne({
      "personalDetails.email": email,
      isDeleted: false,
    });

    if (!findUser) {
      return res.send({ status: 404, message: "User not found." });
    }

    if (findUser?.isEmailVerified !== true) {
      return res.send({
        status: 400,
        message: "Email is not verified, please verify your email!",
      });
    }
    if (findUser.otp === otp) {
      findUser.isOTPVerified = true;
      await findUser.save();
      return res.send({ status: 200, message: "OTP verified successfully." });
    } else {
      return res.send({ status: 409, message: "Invalid OTP." });
    }
  } catch (error) {
    console.error("Error occurred while OTP verification:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while OTP verification!",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    const user = await User.findOne({
      "personalDetails.email": email,
      isDeleted: false,
    });
    if (!user) {
      return res.send({ status: 404, message: "User not found" });
    }

    if (user?.isEmailVerified !== true) {
      return res.send({
        status: 400,
        message: "Email is not verified, please verify your email!",
      });
    }

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.send({
        status: 401,
        message:
          "Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.send({
        status: 400,
        message: "New password and confirm password do not match.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.isEmailVerified = false;
    user.isOTPVerified = false;
    await user.save();
    res.send({ status: 200, message: "Password updated successfully." });
  } catch (error) {
    console.error("Error occurred while forgot password:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while forgot password!",
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { userId, oldPassword, newPassword, confirmPassword } = req.body;

    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.send({ status: 404, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.send({ status: 400, message: "Old password is incorrect." });
    }

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.send({
        status: 401,
        message:
          "Password must one capital letter, contain at least one symbol and one numeric, and be at least 8 characters long.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.send({
        status: 400,
        message: "New password and confirm password do not match.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    return res.send({ status: 200, message: "Password updated successfully." });
  } catch (error) {
    console.error("Error occurred while updating password:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while updating password!",
    });
  }
};

exports.getDetails = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager", "Employee"];
    if (allowedRoles.includes(req.user.role)) {
      const userId = req.user._id;
      const user = await User.findOne({
        _id: userId,
        isDeleted: { $ne: true },
      });
      if (!user) {
        return res.send({ status: 404, message: "User not found" });
      }
      const userDetails = {
        personalDetails: user?.personalDetails,
        documentDetails: user?.documentDetails,
      };
      return res.send({ status: 200, user: userDetails });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while getting details:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while getting details!",
    });
  }
};

exports.updateProfileDetails = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager", "Employee"];
    if (allowedRoles.includes(req.user.role)) {
      const userId = req.user._id;

      const {
        firstName,
        middleName,
        lastName,
        dateOfBirth,
        gender,
        maritalStatus,
        phone,
        homeTelephone,
        email,
        documentDetails,
      } = req.body;

      const user = await User.findOne({
        _id: userId,
        isDeleted: { $ne: true },
      });
      if (!user) {
        return res.send({ status: 404, message: "User not found" });
      }

      let documentDetailsFile = [];
      // if (documentDetails && Array.isArray(documentDetails)) {
      //     for (let i = 0; i < documentDetails.length; i++) {
      //         const gettedDocument = documentDetails[i].document;

      //         if (!gettedDocument || typeof gettedDocument !== 'string') {
      //             console.log(`Invalid or missing document for item ${i}`)
      //         }
      //         try {
      //             if(gettedDocument.startsWith('data:')){
      //                 const fileName = unique_Id()
      //                 let element = await uploadToS3(gettedDocument, userDocuments, fileName)
      //                 documentDetailsFile.push({
      //                     documentType: documentDetails[i].documentType,
      //                     documentName: documentDetails[i].documentName,
      //                     document: element?.fileUrl
      //                 })
      //             } else {
      //                 documentDetailsFile.push({
      //                     documentType: documentDetails[i].documentType,
      //                     documentName: documentDetails[i].documentName,
      //                     document: gettedDocument
      //                 })
      //             }
      //         } catch (uploadError) {
      //             console.error("Error occurred while uploading file to AWS:", uploadError);
      //             return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
      //         }
      //     }
      // }
      if (documentDetails && Array.isArray(documentDetails)) {
        for (let i = 0; i < documentDetails.length; i++) {
          const currentItem = documentDetails[i];

          if (!Array.isArray(currentItem.documents)) {
            console.log(`Invalid documents structure at index ${i}`);
            return res.send({
              status: 400,
              message: `Invalid document structure at index ${i}`,
            });
          }

          const documentGroup = {
            documentType: currentItem.documentType,
            documents: [],
          };

          for (let j = 0; j < currentItem.documents.length; j++) {
            const docItem = currentItem.documents[j];

            if (
              !docItem ||
              typeof docItem !== "object" ||
              !docItem.documentName ||
              !docItem.document
            ) {
              console.log(`Invalid document object at item ${i}, file ${j}`);
              continue;
            }

            try {
              if (docItem.document.startsWith("data:")) {
                const uniqueFileName = unique_Id();
                const uploaded = await uploadToS3(
                  docItem.document,
                  "userDocuments",
                  uniqueFileName
                );
                documentGroup.documents.push({
                  documentName: docItem.documentName,
                  document: uploaded?.fileUrl,
                });
              } else {
                documentGroup.documents.push({
                  documentName: docItem.documentName,
                  document: docItem.document,
                });
              }
            } catch (uploadError) {
              console.error(
                `Error uploading file at index ${i}, file ${j}:`,
                uploadError
              );
              return res.send({
                status: 500,
                message:
                  "Error occurred while uploading file. Please try again.",
              });
            }
          }

          documentDetailsFile.push(documentGroup);
        }
      }

      const updatedUser = await User.findByIdAndUpdate(
        { _id: user._id, isDeleted: { $ne: true } },
        {
          $set: {
            personalDetails: {
              firstName,
              middleName,
              lastName,
              dateOfBirth,
              gender,
              maritalStatus,
              phone,
              homeTelephone,
              email,
              niNumber: user?.personalDetails?.niNumber,
            },
            addressDetails: user?.addressDetails,
            kinDetails: user?.kinDetails,
            financialDetails: user?.financialDetails,
            immigrationDetails: user?.immigrationDetails,
            jobDetails: user?.jobDetails,
            documentDetails: documentDetailsFile,
            contractDetails: user?.contractDetails,
          },
        },
        { new: true }
      );

      let uUser = {
        firstName: updatedUser?.personalDetails?.firstName,
        middleName: updatedUser?.personalDetails?.middleName,
        lastName: updatedUser?.personalDetails?.lastName,
        dateOfBirth: updatedUser?.personalDetails?.dateOfBirth,
        gender: updatedUser?.personalDetails?.gender,
        maritalStatus: updatedUser?.personalDetails?.maritalStatus,
        phone: updatedUser?.personalDetails?.phone,
        homeTelephone: updatedUser?.personalDetails?.homeTelephone,
        email: updatedUser?.personalDetails?.email,
        documentDetails: updatedUser?.documentDetails,
      };

      return res.send({
        status: 200,
        message: "Profile updated successfully.",
        updatedUser: uUser,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while updating profile details:", error);
    return res.send({
      status: 500,
      message: "Error occurred while updating profile details!",
    });
  }
};

const generateContractForUser = async (userData, contractId) => {
  try {
    const contract = await Contract.findOne({
      _id: contractId,
      isDeleted: { $ne: true },
    });

    const response = await axios.get(contract?.contract, {
      responseType: "arraybuffer",
    });
    const content = response.data;

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip);

    doc.render(userData);

    const modifiedDoc = doc.getZip().generate({ type: "nodebuffer" });

    return modifiedDoc;
  } catch (error) {
    console.error("Error occurred while generating contract:", error);
    return { message: "Error occurred while generating contract:" };
  }
};

const uploadBufferToAWS_S3 = async (buffer, folder = "contracts") => {
  let fileName = unique_Id();
  const element = await uploadBufferToS3(buffer, folder, fileName);

  return element?.fileUrl;
};

async function generateUserId() {
  const lastUser = await User.findOne()
    .sort({ unique_ID: -1 })
    .select("unique_ID");

  let newId =
    lastUser && typeof lastUser.unique_ID === "number"
      ? lastUser.unique_ID + 1
      : 1001;

  if (newId > 9999) {
    return new Error("User ID limit exceeded. No available IDs.");
  }

  let existingUser = await User.findOne({ unique_ID: newId });
  while (existingUser) {
    newId++;
    if (newId > 9999) {
      return new Error("User ID limit exceeded. No available IDs.");
    }
    existingUser = await User.findOne({ unique_ID: newId });
  }

  return newId;
}

exports.addUser = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager"];
    if (allowedRoles.includes(req.user.role)) {
      let {
        personalDetails,
        addressDetails,
        kinDetails,
        financialDetails,
        jobDetails,
        companyId,
        // locationId,
        immigrationDetails,
        documentDetails,
        contractDetails,
        isFormFilled,
      } = req.body;

      const lowerCaseEmail = personalDetails?.email.toLowerCase();

      // let companyId
      // const locationId = jobDetails[0]?.location
      // const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
      // companyId = location?.companyId

      let company;
      let FormFilled = true;

      if (companyId && companyId !== "allCompany") {
        company = await Company.findOne({
          _id: companyId,
          isDeleted: { $ne: true },
        });
      } else if (req.user.role !== "Superadmin") {
        company = await Company.findOne({
          _id: req.user.companyId.toString(),
          isDeleted: { $ne: true },
        });
      } else {
        return res.send({
          status: 400,
          message: "Kindly select a specific company.",
        });
      }

      if (!company) {
        return res.send({ status: 404, message: "Company not found" });
      }

      const allCompanysEmployees = await User.find({
        companyId,
        isDeleted: { $ne: false },
      }).countDocuments();
      // console.log('allCompanysEmployees:', allCompanysEmployees)
      // console.log('company?.contractDetails?.maxEmployeesAllowed:', company?.contractDetails?.maxEmployeesAllowed)
      if (
        allCompanysEmployees > company?.contractDetails?.maxEmployeesAllowed
      ) {
        return res.send({
          status: 409,
          message: "Maximum employee limit reached. Cannot add more employees.",
        });
      }

      if (personalDetails && personalDetails.email) {
        const user = await User.findOne({
          "personalDetails.email": lowerCaseEmail,
          isDeleted: { $ne: true },
        });
        if (user) {
          return res.send({ status: 409, message: "Email already exists." });
        }
      }

      if (personalDetails && personalDetails.phone) {
        const user = await User.findOne({
          "personalDetails.phone": personalDetails.phone,
          isDeleted: { $ne: true },
        });
        if (user) {
          return res.send({
            status: 409,
            message: "Phone number already exists.",
          });
        }
      }

      if (
        !personalDetails?.firstName ||
        !personalDetails?.lastName ||
        !personalDetails?.dateOfBirth ||
        !personalDetails?.gender ||
        !personalDetails?.maritalStatus ||
        !personalDetails?.phone ||
        !personalDetails?.email ||
        !addressDetails?.address ||
        !addressDetails?.city ||
        !addressDetails?.postCode ||
        !kinDetails?.kinName ||
        !kinDetails?.postCode ||
        !kinDetails?.address ||
        !kinDetails?.emergencyContactNumber ||
        !financialDetails?.bankName ||
        !financialDetails?.holderName ||
        !financialDetails?.sortCode ||
        !financialDetails?.accountNumber ||
        !financialDetails?.payrollFrequency ||
        !financialDetails?.pension ||
        !immigrationDetails?.passportNumber ||
        !immigrationDetails?.countryOfIssue ||
        !immigrationDetails?.passportExpiry ||
        !immigrationDetails?.nationality ||
        !immigrationDetails?.rightToWorkCheckDate
      ) {
        FormFilled = false;
      }

      if (isFormFilled == true && FormFilled == true) FormFilled = true;
      else if (isFormFilled == false && FormFilled == false) FormFilled = false;
      else if (isFormFilled == false && FormFilled == true) FormFilled = true;
      else if (isFormFilled == true && FormFilled == false) FormFilled = false;

      let locationIds = [];
      if (jobDetails) {
        for (const JD of jobDetails) {
          if (JD?.isWorkFromOffice) {
            for (const loc of JD?.location) {
              const location = await Location.findOne({
                _id: loc,
                companyId,
                isDeleted: { $ne: true },
              });
              if (!location) {
                return res.send({ status: 404, message: "Location not found" });
              }
              locationIds.push(loc);
            }
          } else if (JD?.assignClient.length > 0) {
            for (const clientId of JD?.assignClient) {
              const existingClient = await Client.findOne({
                _id: clientId,
                companyId,
                isDeleted: { $ne: true },
              });
              if (!existingClient) {
                return res
                  .status(404)
                  .send({ status: 404, message: "Client not found" });
              }
            }
          }

          // if (JD?.assignClient && JD.assignClient !== "") {
          //     const existingClient = await Client.findOne({ _id: JD.assignClient, companyId, isDeleted: { $ne: true } });
          //     if (!existingClient) {
          //         return res.status(404).send({ status: 404, message: 'Client not found' });
          //     }
          //     clientIds.push(JD?.assignClient)
          //     JD.isAssignClient = true
          // } else if(JD?.location && JD.location !== ""){
          //     const location = await Location.findOne({ _id: JD?.location, companyId, isDeleted: { $ne: true } })
          //     if(!location){
          //         return res.send({ status: 404, message: 'Location not found' })
          //     }
          //     locationIds.push(JD?.location)
          //     JD.isAssignLocation = true
          // }
          // for check template assigned or not
          // if(JD.templateId && JD.templateId !== ""){
          //     const template = await Template.findOne({ _id: JD.templateId, isDeleted: { $ne: true } })
          //     if(!template){
          //         return res.send({ status: 404, message: 'Template not found' })
          //     }
          //     JD.isTemplateSigned = false
          // }
        }
      }

      let documentDetailsFile = [];
      // if (documentDetails && Array.isArray(documentDetails)) {
      //     for (let i = 0; i < documentDetails.length; i++) {
      //         const gettedDocument = documentDetails[i].document;

      //         if (!gettedDocument || typeof gettedDocument !== 'string') {
      //             console.log(`Invalid or missing document for item ${i}`)
      //         }
      //         try {
      //             let fileName = unique_Id()

      //             let element = await uploadToS3(gettedDocument, 'userDocuments', fileName)
      //             // console.log('AWS response:', element);
      //             documentDetailsFile.push({
      //                 documentType: documentDetails[i].documentType,
      //                 documentName: documentDetails[i].documentName,
      //                 document: element?.fileUrl
      //             })
      //         } catch (uploadError) {
      //             console.error("Error occurred while uploading file to AWS:", uploadError);
      //             return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
      //         }
      //     }
      // }
      if (documentDetails && Array.isArray(documentDetails)) {
        for (let i = 0; i < documentDetails.length; i++) {
          const currentItem = documentDetails[i];

          if (!Array.isArray(currentItem.documents)) {
            console.log(`Invalid documents structure at index ${i}`);
            return res.status(400).send({
              status: 400,
              message: `Invalid document structure at index ${i}`,
            });
          }

          const documentGroup = {
            documentType: currentItem.documentType,
            documents: [],
          };

          for (let j = 0; j < currentItem.documents.length; j++) {
            const docItem = currentItem.documents[j];

            if (
              !docItem ||
              typeof docItem !== "object" ||
              !docItem.document ||
              typeof docItem.document !== "string" ||
              !docItem.documentName
            ) {
              console.log(
                `Invalid or missing document at item ${i}, file ${j}`
              );
              continue;
            }

            try {
              let fileName = unique_Id(); // Generate unique filename
              let uploaded = await uploadToS3(
                docItem.document,
                "userDocuments",
                fileName
              );

              documentGroup.documents.push({
                documentName: docItem.documentName,
                document: uploaded?.fileUrl,
              });
            } catch (uploadError) {
              console.error(
                `Error uploading file at item ${i}, file ${j}:`,
                uploadError
              );
              return res.status(400).send({
                status: 500,
                message:
                  "Error occurred while uploading file. Please try again.",
              });
            }
          }

          documentDetailsFile.push(documentGroup);
        }
      }

      let contractDetailsFile;
      // if (contractDetails?.contractDocument) {
      //     const document = contractDetails.contractDocument
      //     if (!document || typeof document !== 'string') {
      //         console.log('Invalid or missing contract document')
      //     }
      //     try {
      //         let element = await cloudinary.uploader.upload(document, {
      //             resource_type: "auto",
      //             folder: "userContracts",
      //         });
      //         // console.log('Cloudinary response:', element);
      //         contractDetailsFile = {
      //             contractType: contractDetails.contractType,
      //             contractDocument: {
      //                 fileURL: element.secure_url,
      //                 fileName: contractDetails.fileName,
      //             }
      //         };
      //     } catch (uploadError) {
      //         console.error("Error occurred while uploading file to Cloudinary:", uploadError);
      //         return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
      //     }
      // }

      const generatePass = () => {
        const fname = `${personalDetails.firstName}`;
        const capitalizeWords = (username) =>
          username
            .split(" ")
            .map(
              (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            );
        const formatName = capitalizeWords(fname);
        const uname = formatName[0];
        // console.log('uname', uname)
        const lastFourDigits = personalDetails.phone.slice(-4);
        // console.log('lastFourDigits', lastFourDigits)
        const pass = `${uname}@${lastFourDigits}`;
        // console.log('pass', pass)
        return pass;
      };

      const pass = generatePass();
      const hashedPassword = await bcrypt.hash(pass, 10);

      let userData = {
        EMPLOYEE_NAME: `${personalDetails?.firstName} ${personalDetails?.lastName}`,
        EMPLOYEE_EMAIL: lowerCaseEmail,
        EMPLOYEE_CONTACT_NUMBER: personalDetails?.phone,
        JOB_ROLE: "JOB_ROLE",
        JOB_START_DATE: "START_DATE",
        JOB_TITLE: "JOB_TITLE",
        WEEKLY_HOURS: "WEEKLY_HOURS",
        ANNUAL_SALARY: "ANNUAL_SALARY",
        COMPANY_NAME: company?.companyDetails?.businessName,
      };

      let contractURL;
      let generatedContract;

      if (contractDetails?.contractDocument) {
        contractDetailsFile = {
          // contractId: contractDetails?.contractType,
          contractDocument: contractDetails?.contractDocument,
          contractType: contractDetails?.contractType,
        };

        const contractId = contractDetails?.contractDocument;

        const contract = await Contract.findOne({
          _id: contractId,
          isDeleted: { $ne: true },
        });
        if (!contract) {
          return res.send({ status: 404, message: "Contract not found" });
        }
        generatedContract = await generateContractForUser(userData, contractId);

        contractURL = await uploadBufferToAWS_S3(generatedContract);
        // console.log('contractURL?.fileUrl:', contractURL?.fileUrl)
      }

      const newUser = {
        personalDetails: {
          ...personalDetails,
          email: lowerCaseEmail,
        },
        addressDetails,
        kinDetails,
        financialDetails,
        jobDetails,
        companyId: company._id,
        locationId: locationIds,
        immigrationDetails,
        role: jobDetails[0]?.role,
        password: hashedPassword,
        documentDetails: documentDetailsFile,
        contractDetails: contractDetailsFile,
        createdBy: req.user.role,
        creatorId: req.user._id,
      };

      try {
        const attachedFileName = `${newUser?.personalDetails?.firstName}${
          newUser?.personalDetails?.lastName
        }-contract-${
          moment().format("YYYYMMDDHHmmssSSS") +
          Math.floor(Math.random() * 1000)
        }.pdf`;
        let mailOptions = {
          from: process.env.NODEMAILER_EMAIL,
          to: lowerCaseEmail,
          subject: `Welcome to ${company?.companyDetails?.businessName}'s City Clean Portal`,
          html: `
                        <p>Welcome to City Clean Portal!</p>

                        <p>We are pleased to inform you that a new ${
                          newUser.role
                        } account has been successfully created by the Manager under your supervision in the City Clean portal. Below are the details:</p>

                        <ul>
                            <li><b>Name:</b> ${personalDetails.firstName} ${
            personalDetails.lastName
          }</li>
                            <li><b>Email:</b> ${lowerCaseEmail}</li>
                            <li><b>Position:</b> ${jobDetails[0].jobTitle}</li>
                            <li><b>Joining Date:</b> ${
                              jobDetails[0].joiningDate
                            }</li>
                        </ul>

                        <p>Please ensure the ${
                          newUser.role
                        } logs into the City Cleam portal using their temporary credentials and updates their password promptly. Here are the login details for their reference:</p>

                        <ul>
                            <li><b>City Clean Portal Link:</b> <a href="${
                              process.env.FRONTEND_URL
                            }">City Clean Portal</a></li>
                            <li><b>Username/Email:</b> ${lowerCaseEmail}</li>
                            <li><b>Temporary Password:</b> ${generatePass()}</li>
                        </ul>

                        <p>If you have any questions or need further assistance, feel free to reach out to the HR manager or HR department.</p>

                        <p>Looking forward to your journey with us!</p>

                        <p>Best regards,<br>City Clean London Team</p>
                    `,
          attachments: [
            {
              filename: attachedFileName,
              content: generatedContract ? generatedContract : "",
            },
          ],
        };

        await transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            if (error.code == "EENVELOPE") {
              console.warn(
                "Invalid email address, while sending contract:",
                lowerCaseEmail
              );
            } else {
              console.error("Error while sending contract:", error);
            }
          }
          if (info) {
            console.log(
              `✅ User creates successfully and contract will be sent to: ${lowerCaseEmail}`
            );
          }
        });
        // console.log('Email sent successfully');
      } catch (error) {
        console.log("Error occurred:", error);
      }

      // console.log('new user', newUser)
      const unique_ID = await generateUserId();
      const user = await User.create({
        ...newUser,
        isFormFilled: FormFilled,
        unique_ID,
        userContractURL: contractURL?.fileUrl,
      });

      return res.send({
        status: 200,
        message: `${newUser.role} created successfully.`,
        user,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while adding user:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while adding user!",
    });
  }
};

exports.getUser = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager", "Employee"];
    if (allowedRoles.includes(req.user.role)) {
      const userId = req.params.id;

      if (!userId || userId == "undefined" || userId == "null") {
        return res.send({ status: 404, message: "User not found" });
      }

      const user = await User.findOne({
        _id: userId,
        isDeleted: { $ne: true },
      });

      if (!user) {
        return res.send({ status: 404, message: "User not found" });
      }

      // const userDetails = {
      //     ...user.toObject(),
      //     contractDetails: { contractType: user?.contractDetails?.contractId }
      // }

      return res.send({ status: 200, message: "User get successfully.", user });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while getting user:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while getting user!",
    });
  }
};

const getGracePoints = async (userId, jobId) => {
  const startDate = moment().startOf("month").toDate();
  const endDate = moment().endOf("month").toDate();
  const countOfLateClockIn = await Task.find({
    userId,
    jobId,
    isLate: true,
    createdAt: { $gte: startDate, $lte: endDate },
  }).countDocuments();
  return countOfLateClockIn > 0 ? countOfLateClockIn : 0;
};

const calculateUserGracePoints = async (users) => {
  return Promise.all(
    users.map(async (user) => {
      let roleWisePoints = [];

      await Promise.all(
        user.jobDetails.map(async (job) => {
          const { _id: jobId, jobTitle } = job;
          let gracePoints = await getGracePoints(user._id, jobId);

          roleWisePoints.push({
            jobId,
            jobTitle,
            gracePoints,
          });
        })
      );

      return {
        ...user,
        roleWisePoints,
      };
    })
  );
};

exports.getAllUsers = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager"];
    if (allowedRoles.includes(req.user.role)) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const searchQuery = req.query.search ? req.query.search.trim() : "";
      const companyId = req.query.companyId;

      const skip = (page - 1) * limit;

      let baseQuery = { isDeleted: { $ne: true } };

      if (companyId && companyId !== "allCompany") {
        baseQuery.companyId = companyId;
      } else if (req.user.role !== "Superadmin") {
        baseQuery.companyId = req.user.companyId;
        baseQuery.locationId = { $in: req.user.locationId };
      }

      if (req.user.role === "Superadmin") {
        baseQuery.role = { $in: ["Administrator", "Manager", "Employee"] };
      } else if (req.user.role === "Administrator") {
        baseQuery.role = { $in: ["Manager", "Employee"] };
      } else if (req.user.role === "Manager") {
        baseQuery.role = { $in: ["Employee"] };
        baseQuery.jobDetails = {
          $elemMatch: { assignManager: req.user._id.toString() },
        };
      }

      if (searchQuery) {
        baseQuery.$or = [
          { "personalDetails.email": { $regex: searchQuery, $options: "i" } },
          { "personalDetails.phone": { $regex: searchQuery, $options: "i" } },
          { role: { $regex: searchQuery, $options: "i" } },
          {
            "personalDetails.firstName": { $regex: searchQuery, $options: "i" },
          },
          {
            "personalDetails.lastName": { $regex: searchQuery, $options: "i" },
          },
        ];

        if (!isNaN(searchQuery)) {
          baseQuery.$or = [{ unique_ID: parseInt(searchQuery) }];
        }
      }

      const totalUsers = await User.countDocuments(baseQuery);

      const users = await User.find(baseQuery)
        .skip(skip)
        .limit(limit)
        .select(
          "_id unique_ID role isActive personalDetails jobDetails roleWisePoints templates"
        )
        .lean();

      const updatedUsers = await calculateUserGracePoints(users);

      const userIds = updatedUsers.map((u) => u._id);
      const today = moment().format("YYYY-MM-DD");

      const todaysTimesheets = await Timesheet.find({
        userId: { $in: userIds },
        date: today,
        isTimerOn: true,
        isDeleted: { $ne: true },
      }).lean();

      const timesheetMap = {};
      todaysTimesheets.forEach((ts) => {
        const uid = ts.userId.toString();
        const jobId = ts.jobId.toString();
        if (!timesheetMap[uid]) timesheetMap[uid] = new Set();
        timesheetMap[uid].add(jobId);
      });

      const templateIds = [
        ...new Set(
          updatedUsers.flatMap(
            (u) => u.templates?.map((t) => t.templateId?.toString()) || []
          )
        ),
      ];

      const templates = await Template.find({
        _id: { $in: templateIds },
      }).lean();
      const templateMap = {};
      templates.forEach((t) => (templateMap[t._id.toString()] = t));

      const finalUsers = updatedUsers.map((user) => {
        const firstName = user.personalDetails?.firstName || "";
        const lastName = user.personalDetails?.lastName || "";
        const userName = `${firstName} ${lastName}`.trim();

        const todaysTimesheet = (user.jobDetails || []).map((job) => ({
          jobId: job._id,
          jobName: job.jobTitle,
          isActiveClockIn:
            timesheetMap[user._id.toString()]?.has(job._id.toString()) || false,
        }));

        const userTemplates = (user.templates || []).reduce((acc, temp) => {
          const template = templateMap[temp.templateId?.toString()];
          if (template && temp.isTemplateVerify) {
            acc.push({
              _id: template._id,
              templateName: template.templateName,
              templateUrl: temp.templateURL,
            });
          }
          return acc;
        }, []);

        return {
          userName,
          _id: user._id,
          Id: user.unique_ID,
          position: user.role,
          email: user.personalDetails?.email,
          phone: user?.personalDetails?.phone,
          jobTitle: user.jobDetails?.map((job) => job.jobTitle).join(", "),
          status: user.isActive,
          todaysTimesheet,
          roleWisePoints: user.roleWisePoints,
          templates: userTemplates,
        };
      });

      return res.send({
        status: 200,
        message: "Users fetched successfully.",
        users: finalUsers,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit) || 1,
        currentPage: page || 1,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while getting users:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while getting users!",
    });
  }
  // try {
  //     const allowedRoles = ['Superadmin', 'Administrator', 'Manager'];
  //     if (allowedRoles.includes(req.user.role)) {
  //         const page = parseInt(req.query.page) || 1
  //         const limit = parseInt(req.query.limit) || 50
  //         // const timePeriod = parseInt(req.query.timePeriod)
  //         const searchQuery = req.query.search ? req.query.search.trim() : ''
  //         const companyId = req.query.companyId

  //         const skip = (page - 1) * limit

  //         // let timeFilter = {}
  //         // if (timePeriod) {
  //         //     const filteredHour = new Date()
  //         //     filteredHour.setHours(filteredHour.getHours() - timePeriod)
  //         //     timeFilter = { lastTimeLoggedIn: { $gte: filteredHour } }
  //         // }

  //         // let baseQuery = { isDeleted: { $ne: true }, ...timeFilter }
  //         let baseQuery = { isDeleted: { $ne: true } }

  //         if(companyId && companyId !== 'allCompany'){
  //             baseQuery.companyId = companyId
  //         } else if(req.user.role !== 'Superadmin'){
  //             baseQuery.locationId = { $in: req.user.locationId }
  //             baseQuery.companyId = req.user.companyId
  //         }

  //         if (req.user.role === 'Superadmin') {
  //             baseQuery.role = { $in: ["Administrator", "Manager", "Employee"] }
  //         } else if (req.user.role === 'Administrator') {
  //             baseQuery.companyId = req.user.companyId
  //             // baseQuery.locationId = { $in: req.user.locationId }
  //             baseQuery.role = { $in: ["Manager", "Employee"] }
  //         } else if(req.user.role === 'Manager') {
  //             baseQuery.jobDetails = { $elemMatch: { assignManager: req.user._id.toString() } }
  //             baseQuery.companyId = req.user.companyId
  //             // baseQuery.locationId = { $in: req.user.locationId }
  //             baseQuery.role = { $in: ["Employee"] }
  //         }

  //         if (searchQuery) {
  //             baseQuery.$or = [
  //                 { "personalDetails.firstName": { $regex: searchQuery, $options: "i" } },
  //                 { "personalDetails.lastName": { $regex: searchQuery, $options: "i" } }
  //             ];
  //         }

  //         const allUsers = await User.find(baseQuery)
  //         const updateUsers = await calculateUserGracePoints(allUsers)

  //         // user's today clock in active or not
  //         const usersWithClockInStatus = await Promise.all(
  //             updateUsers.map(async (user) => {
  //                 let todaysTimesheet = []

  //                 for (const job of user.jobDetails) {
  //                     const timesheet = await Timesheet.findOne({
  //                         userId: user._id,
  //                         jobId: job._id,
  //                         date: moment().format('YYYY-MM-DD'),
  //                         isTimerOn: true
  //                     })

  //                     todaysTimesheet.push({
  //                         jobId: job._id,
  //                         jobName: job.jobTitle,
  //                         isActiveClockIn: !!timesheet
  //                     })
  //                 }

  //                 return {
  //                     ...user,
  //                     todaysTimesheet
  //                 }
  //             })
  //         )

  //         // const users = usersWithClockInStatus.slice(skip, skip + limit).map(user => {
  //         //     const firstName = user.personalDetails?.firstName || ''
  //         //     const lastName = user.personalDetails?.lastName || ''
  //         //     const userName = `${firstName} ${lastName}`.trim()

  //         //     return {
  //         //         userName,
  //         //         _id: user?._id,
  //         //         Id: user?.unique_ID,
  //         //         position: user?.role,
  //         //         email: user?.personalDetails?.email,
  //         //         status: user?.isActive,
  //         //         todaysTimesheet: user?.todaysTimesheet,
  //         //         roleWisePoints: user.roleWisePoints,
  //         //     }
  //         // })

  //         const users = []

  //         for (const user of usersWithClockInStatus.slice(skip, skip + limit)) {
  //             const firstName = user.personalDetails?.firstName || ''
  //             const lastName = user.personalDetails?.lastName || ''
  //             const userName = `${firstName} ${lastName}`.trim()

  //             let userTemplates = []
  //             try {
  //                 if (user?.templates?.length > 0) {
  //                     for (const temp of user.templates) {
  //                         const template = await Template.findOne({ _id: temp?.templateId })
  //                         if (!template) {
  //                             console.log('Template not found for ID:', temp?._id)
  //                             continue
  //                         }

  //                         if(template){
  //                             if(temp.isTemplateVerify){
  //                                 userTemplates.push({
  //                                     _id: template._id,
  //                                     templateName: template?.templateName,
  //                                     templateUrl: temp?.templateURL
  //                                 })
  //                             }
  //                         }
  //                     }
  //                 }
  //             } catch (error) {
  //                 console.log('Error while fetching templates:', error)
  //             }

  //             users.push({
  //                 userName,
  //                 _id: user?._id,
  //                 Id: user?.unique_ID,
  //                 position: user?.role,
  //                 email: user?.personalDetails?.email,
  //                 status: user?.isActive,
  //                 todaysTimesheet: user?.todaysTimesheet,
  //                 roleWisePoints: user.roleWisePoints,
  //                 templates: userTemplates
  //             })
  //         }

  //         const totalUsers = usersWithClockInStatus.length

  //         // const users = updateUsers.slice(skip, skip + limit)
  //         // const totalUsers = updateUsers.length

  //         return res.send({
  //             status: 200,
  //             message: 'Users fetched successfully.',
  //             users,
  //             totalUsers,
  //             totalPages: Math.ceil(totalUsers / limit) || 1,
  //             currentPage: page || 1
  //         })
  //     } else return res.send({ status: 403, message: "Access denied" })
  // } catch (error) {
  //     console.error("Error occurred while getting users:", error);
  //     return res.send({ status: 500, message: "Something went wrong while getting users!" })
  // }
};

exports.getUsers = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager"];
    if (allowedRoles.includes(req.user.role)) {
      const companyId = req.query.companyId;

      let baseQuery = { isDeleted: { $ne: true } };

      if (companyId && companyId !== "allCompany") {
        baseQuery.companyId = companyId;
      }

      if (!companyId) {
        baseQuery.companyId = "";
      }

      if (req.user.role === "Superadmin") {
        baseQuery.role = { $in: ["Administrator", "Manager", "Employee"] };
      } else if (req.user.role === "Administrator") {
        baseQuery.role = { $in: ["Manager", "Employee"] };
      } else if (req.user.role === "Manager") {
        baseQuery.role = { $in: ["Employee"] };
      }

      const userList = await User.find(baseQuery);

      const users = userList.map((user) => ({
        _id: user._id,
        userName: user?.personalDetails?.lastName
          ? `${user?.personalDetails?.firstName} ${user?.personalDetails?.lastName}`
          : `${user?.personalDetails?.firstName}`,
      }));

      return res.send({
        status: 200,
        message: "Users fetched successfully.",
        users,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while fetching users:", error);
    return res.send({
      status: 500,
      message: "Error occurred while fetching users!",
    });
  }
};

exports.updateUserDetails = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager", "Employee"];
    if (allowedRoles.includes(req.user.role)) {
      const userId = req.params.id;

      const user = await User.findOne({
        _id: userId,
        isDeleted: { $ne: true },
      });

      if (!user) {
        return res.send({ status: 404, message: "User not found" });
      }

      let {
        personalDetails,
        addressDetails,
        kinDetails,
        financialDetails,
        jobDetails,
        immigrationDetails,
        documentDetails,
        contractDetails,
      } = req.body;

      const lowerCaseEmail = personalDetails?.email.toLowerCase();
      getAllLoggedInOutUsers;
      if (
        personalDetails.email &&
        user.personalDetails.email != lowerCaseEmail
      ) {
        const existingEmail = await User.findOne({
          "personalDetails.email": lowerCaseEmail,
          isDeleted: { $ne: true },
        });
        if (existingEmail) {
          return res.send({ status: 409, message: "Email already exists." });
        }
      }

      if (
        personalDetails.phone &&
        user.personalDetails.phone != personalDetails.phone
      ) {
        const user = await User.findOne({
          "personalDetails.phone": personalDetails.phone,
          isDeleted: { $ne: true },
        });
        if (user) {
          return res.send({
            status: 409,
            message: "Phone number already exists.",
          });
        }
      }

      let locationIds = [];
      const companyId = user?.companyId?.toString();
      if (jobDetails) {
        for (const JD of jobDetails) {
          if (JD?.isWorkFromOffice) {
            for (const loc of JD?.location) {
              const location = await Location.findOne({
                _id: loc,
                companyId,
                isDeleted: { $ne: true },
              });
              if (!location) {
                return res.send({ status: 404, message: "Location not found" });
              }
              locationIds.push(loc);
            }
          } else if (JD?.assignClient.length > 0) {
            for (const clientId of JD?.assignClient) {
              const existingClient = await Client.findOne({
                _id: clientId,
                companyId,
                isDeleted: { $ne: true },
              });
              if (!existingClient) {
                return res
                  .status(404)
                  .send({ status: 404, message: "Client not found" });
              }
            }
          }
        }
      }

      let documentDetailsFile = [];
      // if (documentDetails && Array.isArray(documentDetails)) {
      //     for (let i = 0; i < documentDetails.length; i++) {
      //         const gettedDocument = documentDetails[i].document;

      //         if (!gettedDocument || typeof gettedDocument !== 'string') {
      //             console.log(`Invalid or missing document for item ${i}`)
      //         }
      //         try {
      //             if(gettedDocument.startsWith('data:')){
      //                 const fileName = unique_Id()

      //                 const element = await uploadToS3(gettedDocument, 'userDocuments', fileName)
      //                 // console.log('AWS response:', element)
      //                 documentDetailsFile.push({
      //                     documentType: documentDetails[i].documentType,
      //                     documentName: documentDetails[i].documentName,
      //                     document: element?.fileUrl
      //                 })
      //             } else {
      //                 documentDetailsFile.push({
      //                     documentType: documentDetails[i].documentType,
      //                     documentName: documentDetails[i].documentName,
      //                     document: gettedDocument
      //                 })
      //             }
      //         } catch (uploadError) {
      //             console.error("Error occurred while uploading file to AWS:", uploadError);
      //             return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
      //         }
      //     }
      // }

      // if (documentDetails && Array.isArray(documentDetails)) {
      //     for (let i = 0; i < documentDetails.length; i++) {
      //         const currentItem = documentDetails[i];

      //         if ( !Array.isArray(currentItem.documents) || !Array.isArray(currentItem.documentNames) || currentItem.documents.length !== currentItem.documentNames.length ) {
      //             console.log(`Invalid document array format at index ${i}`);
      //             return res.send({ status: 400, message: `Invalid document structure at index ${i}` });
      //         }

      //         const documentGroup = {
      //             documentType: currentItem.documentType,
      //             documents: []
      //         };

      //         for (let j = 0; j < currentItem.documents.length; j++) {
      //             const fileData = currentItem.documents[j];
      //             const fileName = currentItem.documentNames[j];

      //             try {
      //                 if (fileData.startsWith('data:')) {
      //                     const uniqueFileName = unique_Id();
      //                     const uploaded = await uploadToS3(fileData, 'userDocuments', uniqueFileName);
      //                     documentGroup.documents.push({
      //                         documentName: fileName,
      //                         document: uploaded?.fileUrl
      //                     });
      //                     console.log('documentGroup:', documentGroup)
      //                 } else {
      //                     documentGroup.documents.push({
      //                         documentName: fileName,
      //                         document: fileData
      //                     });
      //                     console.log('documentGroup first:', documentGroup)
      //                 }
      //             } catch (uploadError) {
      //                 console.error(`Error uploading file at index ${i}, file ${j}:`, uploadError);
      //                 return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
      //             }
      //         }
      //         console.log('documentGroup second:', documentGroup)
      //         documentDetailsFile.push(documentGroup);
      //         console.log('documentDetailsFiles:', documentDetailsFile[0].documents)
      //     }
      // }

      if (documentDetails && Array.isArray(documentDetails)) {
        for (let i = 0; i < documentDetails.length; i++) {
          const currentItem = documentDetails[i];

          if (!Array.isArray(currentItem.documents)) {
            console.log(`Invalid documents structure at index ${i}`);
            return res.send({
              status: 400,
              message: `Invalid document structure at index ${i}`,
            });
          }

          const documentGroup = {
            documentType: currentItem.documentType,
            documents: [],
          };

          for (let j = 0; j < currentItem.documents.length; j++) {
            const docItem = currentItem.documents[j];

            if (
              !docItem ||
              typeof docItem !== "object" ||
              !docItem.documentName ||
              !docItem.document
            ) {
              console.log(`Invalid document object at item ${i}, file ${j}`);
              continue;
            }

            try {
              // Check if it's a new file (base64) or existing URL
              if (docItem.document.startsWith("data:")) {
                const uniqueFileName = unique_Id();
                const uploaded = await uploadToS3(
                  docItem.document,
                  "userDocuments",
                  uniqueFileName
                );
                documentGroup.documents.push({
                  documentName: docItem.documentName,
                  document: uploaded?.fileUrl,
                });
              } else {
                // Already uploaded, retain existing URL
                documentGroup.documents.push({
                  documentName: docItem.documentName,
                  document: docItem.document,
                });
              }
            } catch (uploadError) {
              console.error(
                `Error uploading file at index ${i}, file ${j}:`,
                uploadError
              );
              return res.send({
                status: 500,
                message:
                  "Error occurred while uploading file. Please try again.",
              });
            }
          }

          documentDetailsFile.push(documentGroup);
        }
      }

      let contractDetailsFile;
      // if (contractDetails) {
      //     const document = contractDetails.contractDocument
      //     if (!document || typeof document !== 'string') {
      //         console.log('Invalid or missing contract document')
      //     }
      //     try {
      //         if(document.startsWith('data:')){
      //             let element = await cloudinary.uploader.upload(document, {
      //                 resource_type: "auto",
      //                 folder: "userContracts",
      //             });
      //             // console.log('Cloudinary response:', element);
      //             contractDetailsFile = {
      //                 contractType: contractDetails.contractType,
      //                 contractDocument: {
      //                     fileURL: element.secure_url,
      //                     fileName: contractDetails.fileName,
      //                 }
      //             };
      //         } else {
      //             contractDetailsFile = {
      //                 contractType: contractDetails.contractType,
      //                 contractDocument: {
      //                     fileURL: document,
      //                     fileName: contractDetails.fileName,
      //                 }
      //             }
      //         }
      //     } catch (uploadError) {
      //         console.error("Error occurred while uploading file to Cloudinary:", uploadError);
      //         return res.send({ status: 400, message: "Error occurred while uploading file. Please try again." });
      //     }
      // }

      if (
        user?.contractDetails?.contractDocument ==
        contractDetails?.contractDocument
      ) {
        contractDetailsFile = {
          // contractId: user?.contractDetails?.contractId,
          contractDocument: contractDetails?.contractDocument,
          contractType: contractDetails?.contractType,
        };
      } else if (contractDetails?.contractDocument) {
        contractDetailsFile = {
          // contractId: contractDetails?.contractDocument,
          contractDocument: contractDetails?.contractDocument,
          contractType: contractDetails?.contractType,
        };

        const contract = await Contract.findOne({
          _id: contractDetailsFile?.contractDocument,
          isDeleted: { $ne: true },
        });
        if (!contract) {
          return res.send({ status: 404, message: "Contract not found" });
        }

        const company = await Company.findOne({
          _id: user?.companyId,
          isDeleted: { $ne: true },
        });
        if (!company) {
          return res.send({ status: 404, message: "Company not found" });
        }

        let userData = {
          EMPLOYEE_NAME: `${personalDetails?.firstName} ${personalDetails?.lastName}`,
          EMPLOYEE_EMAIL: lowerCaseEmail,
          EMPLOYEE_CONTACT_NUMBER: personalDetails?.phone,
          JOB_START_DATE: "START_DATE",
          EMPLOYEE_JOB_TITLE: "JOB_TITLE",
          WEEKLY_HOURS: "WEEKLY_HOURS",
          ANNUAL_SALARY: "ANNUAL_SALARY",
          COMPANY_NAME: company?.companyDetails?.businessName,
        };

        const generatedContract = await generateContractForUser(
          userData,
          contractDetailsFile?.contractDocument
        );
        const attachedFileName = `${personalDetails?.firstName}${
          personalDetails?.lastName
        }-updated-contract-${
          moment().format("YYYYMMDDHHmmssSSS") +
          Math.floor(Math.random() * 1000)
        }.pdf`;

        let mailOptions = {
          from: process.env.NODEMAILER_EMAIL,
          to: lowerCaseEmail,
          subject: "Your contract will be updated",
          html: `
                        <p>Dear ${personalDetails?.firstName}${personalDetails?.lastName},</p>
                        <p>Your contract has been updated. Please find the attached updated contract.</p>
                        <p>Best Regards,<br>${company?.companyDetails?.businessName}</p>
                    `,
          attachments: [
            { filename: attachedFileName, content: generatedContract },
          ],
        };
        await transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            if (error.code == "EENVELOPE") {
              console.warn(
                "Invalid email address, while sending updated contract:",
                lowerCaseEmail
              );
            } else {
              console.error("Error while sending updated contract:", error);
            }
          }
          if (info) {
            console.log(
              `✅ User contract will be updated successfully and sent to: ${lowerCaseEmail}`
            );
          }
        });
      }

      let isFormFilled = true;

      if (
        !personalDetails?.firstName ||
        !personalDetails?.lastName ||
        !personalDetails?.dateOfBirth ||
        !personalDetails?.gender ||
        !personalDetails?.maritalStatus ||
        !personalDetails?.phone ||
        !personalDetails?.email ||
        !addressDetails?.address ||
        !addressDetails?.city ||
        !addressDetails?.postCode ||
        !kinDetails?.kinName ||
        !kinDetails?.postCode ||
        !kinDetails?.address ||
        !kinDetails?.emergencyContactNumber ||
        !financialDetails?.bankName ||
        !financialDetails?.holderName ||
        !financialDetails?.sortCode ||
        !financialDetails?.accountNumber ||
        !financialDetails?.payrollFrequency ||
        !financialDetails?.pension ||
        !immigrationDetails?.passportNumber ||
        !immigrationDetails?.countryOfIssue ||
        !immigrationDetails?.passportExpiry ||
        !immigrationDetails?.nationality ||
        !immigrationDetails?.rightToWorkCheckDate
      ) {
        isFormFilled = false;
      }

      let updatedUser = await User.findByIdAndUpdate(
        { _id: userId },
        {
          $set: {
            personalDetails: {
              ...personalDetails,
              email: lowerCaseEmail,
            },
            addressDetails,
            kinDetails,
            financialDetails,
            jobDetails,
            locationId: locationIds,
            immigrationDetails,
            documentDetails: documentDetailsFile,
            contractDetails: contractDetailsFile,
            isFormFilled,
            updatedAt: moment().toDate(),
          },
        },
        { new: true }
      );

      return res.send({
        status: 200,
        message: `${updatedUser.role} details updated successfully.`,
        updatedUser,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while updating user details:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while updating user details!",
    });
  }
};

exports.deleteUserDetails = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager"];
    if (allowedRoles.includes(req.user.role)) {
      const userId = req.params.id;

      const user = await User.findOne({
        _id: userId,
        isDeleted: { $ne: true },
      });
      if (!user) {
        return res.send({ status: 404, message: "User not found" });
      }

      let deletedUser = await User.findByIdAndUpdate(userId, {
        $set: {
          isDeleted: true,
          canceledAt: moment().toDate(),
        },
      });

      return res.send({
        status: 200,
        message: `${deletedUser.role} deleted successfully.`,
        deletedUser,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while removing user:", error);
    return res.send({
      status: 500,
      message: "Something went wrong while removing user!",
    });
  }
};

exports.getUserJobTitles = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator", "Manager", "Employee"];
    if (allowedRoles.includes(req.user.role)) {
      const userId = req.query.EmployeeId || req.user._id;
      const user = await User.findOne({
        _id: userId,
        isDeleted: { $ne: true },
      }).populate("templates.templateId", "templateName");
      if (!user) {
        return res.send({ status: 404, message: "User not found" });
      }
      const jobTitles = [];
      user?.jobDetails.map((job) => {
        jobTitles.push({
          jobId: job._id,
          jobName: job.jobTitle,
          isWorkFromOffice: job?.isWorkFromOffice,
        });
      });
      const templates = user?.templates.map((template) => ({
        _id: template._id,
        templateId: template.templateId._id,
        templateName: template.templateId.templateName,
        isTemplateSigned: template.isTemplateSigned,
      }));
      return res.send({
        status: 200,
        message: "User job titles get successfully.",
        multipleJobTitle: jobTitles.length > 1,
        jobTitles,
        templates,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while getting user job titles:", error);
    return res.send({
      status: 500,
      message: "Error occurred while getting user job titles!",
    });
  }
};

exports.sendMailToEmployee = async (req, res) => {
  try {
    const allowedRoles = ["Administrator", "Manager"];
    if (allowedRoles.includes(req.user.role)) {
      const { EmployeeId, subject, message } = req.body;

      const existEmployee = await User.findOne({
        _id: EmployeeId,
        isDeleted: { $ne: true },
      });
      if (!existEmployee) {
        return res.send({ status: 404, message: "Employee not found" });
      }

      const employeeEmail = existEmployee?.personalDetails?.email;
      if (!employeeEmail) {
        return res.send({ status: 404, message: "Employee email not found" });
      }

      const mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: employeeEmail,
        subject: subject,
        html: `
                    <p>Hello ${existEmployee?.personalDetails?.firstName} ${existEmployee?.personalDetails?.lastName},</p>
                    <p>${message}</p>
                    <p>Best regards,<br>City Clean London Team</p>
                `,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          if (error.code == "EENVELOPE") {
            console.warn(
              "Invalid email address, while sending mail to user:",
              employeeEmail
            );
          } else {
            console.error("Error while sending mail to user:", error);
          }
        }
        if (info) {
          console.log(`✅ Mail sent successfully to: ${employeeEmail}`);
        }
      });

      return res.send({ status: 200, message: "Mail sent successfully" });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while sending mail:", error);
    return res.send({
      status: 500,
      message: "Error occurred while sending mail!",
    });
  }
};

exports.activateDeactivateUser = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin"];
    if (allowedRoles.includes(req.user.role)) {
      const { userId } = req.query;

      const user = await User.findOne({
        _id: userId,
        isDeleted: { $ne: true },
      });
      if (!user) {
        return res.send({ status: 404, message: "User not found" });
      }

      if (user.isActive) {
        user.isActive = false;
        await user.save();
        return res.send({
          status: 200,
          message: "User deactivate successfully",
        });
      } else {
        user.isActive = true;
        await user.save();
        return res.send({ status: 200, message: "User activate successfully" });
      }
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while deacting user:", error);
    return res.send({
      status: 500,
      message: "Error occurred while deacting user!",
    });
  }
};

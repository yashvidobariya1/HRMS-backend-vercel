const User = require("../models/user");
const Company = require("../models/company");
const Location = require("../models/location");
const QR = require("../models/qrCode");
const { unique_Id, uploadToS3 } = require("../utils/AWS_S3");
const Client = require("../models/client");
const moment = require("moment");
const QRCodeL = require("qrcode");

// generate QR code for location
exports.generateQRCodeForLocation = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator"];
    if (allowedRoles.includes(req.user.role)) {
      const locationId = req.params.id;

      const location = await Location.findOne({
        _id: locationId,
        isDeleted: { $ne: true },
      });
      if (!location)
        return res.send({ status: 404, message: "Location not found" });

      const isInvalid = (val) =>
        val === undefined || val === null || val === "";

      if (
        isInvalid(location.latitude) ||
        isInvalid(location.longitude) ||
        isInvalid(location.radius) ||
        isInvalid(location.breakTime) ||
        isInvalid(location.graceTime)
      ) {
        return res.send({
          status: 400,
          message:
            "You should first add or update the latitude, longitude, radius, breakTime and graceTime for this location before proceeding.",
        });
      }

      const company = await Company.findOne({
        _id: location?.companyId,
        isDeleted: { $ne: true },
      });
      if (!company)
        return res.send({ status: 404, message: "Company not found" });

      const timestamp = moment().format("YYYYMMDD-HHmmss");
      const qrValue = `${location?.locationName}-${company?.companyDetails?.businessName}-${timestamp}`;

      const qrCode = await QRCodeL.toDataURL(qrValue);

      const matches = qrCode.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.send({ status: 400, message: "Invalid Image Format!" });
      }

      const imageBuffer = Buffer.from(matches[2], "base64");

      const compressedBase64 = `data:image/jpeg;base64,${imageBuffer.toString(
        "base64"
      )}`;

      // const fileName = unique_Id()
      let element = await uploadToS3(compressedBase64, "QRCodes", qrValue);

      if (!element?.fileUrl) {
        return res.send({
          status: 500,
          message: "Failed to upload QR code to storage.",
        });
      }

      let qrData = {
        qrURL: element?.fileUrl,
        qrValue,
        isActive: true,
        companyId: location.companyId,
        companyName: company?.companyDetails?.businessName,
        locationName: location?.locationName,
        locationId,
        isLocationQR: true,
        qrType: "Location",
      };

      await QR.updateMany(
        { locationId, isLocationQR: true, isActive: true },
        { $set: { isActive: false } }
      );

      const QRCode = await QR.create(qrData);
      return res.send({
        status: 200,
        message: `${qrData?.qrType} QR generated successfully.`,
        QRCode,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occured while generating QR code:", error);
    return res.send({
      status: 500,
      message: "Error occured while generating QR code!",
    });
  }
};

// fetch all QR codes for location
exports.getAllQRCodesForLocation = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator"];
    if (allowedRoles.includes(req.user.role)) {
      const locationId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const searchQuery = req.query.search ? req.query.search.trim() : "";

      const skip = (page - 1) * limit;

      const location = await Location.findOne({
        _id: locationId,
        isDeleted: { $ne: true },
      });
      if (!location) {
        return res.send({ status: 404, message: "Location not found." });
      }

      let companyId;

      if (req.query.companyId && req.query.companyId !== "allCompany") {
        companyId = req.query.companyId;
      } else {
        companyId = location?.companyId.toString();
      }

      // const companyId = location?.companyId.toString()
      const company = await Company.findOne({
        _id: companyId,
        isDeleted: { $ne: true },
      });
      if (!company) {
        return res.send({ status: 404, message: "Company not found." });
      }

      let baseQuery = { companyId, locationId, isActive: { $ne: false } };

      let QRCodes = await QR.find(baseQuery).populate(
        "locationId",
        "locationName"
      );

      if (searchQuery) {
        const regex = new RegExp(searchQuery.replace(/[-\s]/g, "[-\\s]*"), "i");
        QRCodes = QRCodes.filter((QR) => {
          const locationName = QR?.locationId?.locationName;
          return regex.test(`${locationName}`);
        });
      }

      const totalQRCodes = QRCodes.length;
      const allQRCodes = QRCodes.slice(skip, skip + limit);

      let qrValue = `${location?.locationName}-${company?.companyDetails?.businessName}`;

      return res.send({
        status: 200,
        message: "QR codes fetched successfully.",
        qrValue,
        QRCodes: allQRCodes,
        totalQRCodes,
        totalPages: Math.ceil(totalQRCodes / limit) || 1,
        currentPage: page || 1,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while fetching company QR codes:", error);
    return res.send({
      status: 500,
      message: "Error occurred while fetching QR codes!",
    });
  }
};

// generate QR code for client
exports.generateQRCodeForClient = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator"];
    if (allowedRoles.includes(req.user.role)) {
      const clientId = req.params.id;

      const client = await Client.findOne({
        _id: clientId,
        isDeleted: { $ne: true },
      });
      if (!client) {
        return res.send({ status: 404, message: "Client not found" });
      }

      const isInvalid = (val) =>
        val === undefined || val === null || val === "";

      if (
        isInvalid(client.latitude) ||
        isInvalid(client.longitude) ||
        isInvalid(client.radius) ||
        isInvalid(client.breakTime) ||
        isInvalid(client.graceTime)
      ) {
        return res.send({
          status: 400,
          message:
            "You should first add or update the latitude, longitude, radius, breakTime and graceTime for this location before proceeding.",
        });
      }

      const company = await Company.findOne({
        _id: client?.companyId,
        isDeleted: { $ne: true },
      });
      if (!company)
        return res.send({ status: 404, message: "Company not found" });

      const timestamp = moment().format("YYYYMMDD-HHmmss");
      const qrValue = `${client?.clientName}-${company?.companyDetails?.businessName}-${timestamp}`;

      const qrCode = await QRCodeL.toDataURL(qrValue);

      const matches = qrCode.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.send({ status: 400, message: "Invalid Image Format!" });
      }

      const imageBuffer = Buffer.from(matches[2], "base64");

      const compressedBase64 = `data:image/jpeg;base64,${imageBuffer.toString(
        "base64"
      )}`;

      // const fileName = unique_Id()
      let element = await uploadToS3(compressedBase64, "QRCodes", qrValue);

      if (!element?.fileUrl) {
        return res.send({
          status: 500,
          message: "Failed to upload QR code to storage.",
        });
      }

      client.QRCodeImage = element?.fileUrl;

      let qrData = {
        qrURL: element?.fileUrl,
        qrValue,
        isActive: true,
        clientName: client?.clientName,
        companyId: client?.companyId,
        companyName: company?.companyDetails?.businessName,
        clientId,
        isClientQR: true,
        qrType: "Client",
      };

      await QR.updateMany(
        { clientId, isClientQR: true, isActive: true },
        { $set: { isActive: false } }
      );

      const QRCode = await QR.create(qrData);
      return res.send({
        status: 200,
        message: `${qrData?.qrType} QR generated successfully.`,
        QRCode,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occured while generating QR code:", error);
    return res.send({
      status: 500,
      message: "Error occured while generating QR code!",
    });
  }
};

// fetch all QR codes for client
exports.getAllQRCodesForClient = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator"];
    if (allowedRoles.includes(req.user.role)) {
      const clientId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const searchQuery = req.query.search ? req.query.search.trim() : "";

      const skip = (page - 1) * limit;

      const client = await Client.findOne({
        _id: clientId,
        isDeleted: { $ne: true },
      });
      if (!client) {
        return res.send({ status: 404, message: "Client not found." });
      }

      let companyId;

      if (req.query.companyId && req.query.companyId !== "allCompany") {
        companyId = req.query.companyId;
      } else {
        companyId = client?.companyId.toString();
      }

      // const companyId = client?.companyId.toString()
      const company = await Company.findOne({
        _id: companyId,
        isDeleted: { $ne: true },
      });
      if (!company) {
        return res.send({ status: 404, message: "Company not found." });
      }

      let baseQuery = { companyId, clientId, isActive: { $ne: false } };

      let QRCodes = await QR.find(baseQuery).populate("clientId", "clientName");

      if (searchQuery) {
        const regex = new RegExp(searchQuery.replace(/[-\s]/g, "[-\\s]*"), "i");
        QRCodes = QRCodes.filter((QR) => {
          const clientName = QR?.clientId?.clientName;
          return regex.test(`${clientName}`);
        });
      }

      const totalQRCodes = QRCodes.length;
      const allQRCodes = QRCodes.slice(skip, skip + limit);

      let qrValue = `${client?.clientName}-${company?.companyDetails?.businessName}`;

      return res.send({
        status: 200,
        message: "QR codes fetched successfully.",
        qrValue,
        QRCodes: allQRCodes,
        totalQRCodes,
        totalPages: Math.ceil(totalQRCodes / limit) || 1,
        currentPage: page || 1,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while fetching company QR codes:", error);
    return res.send({
      status: 500,
      message: "Error occurred while fetching QR codes!",
    });
  }
};

// active-inactive QR code
exports.inactivateQRCode = async (req, res) => {
  try {
    const allowedRoles = ["Superadmin", "Administrator"];
    if (allowedRoles.includes(req.user.role)) {
      const QRId = req.params.id;
      const QRCode = await QR.findById(QRId);
      if (!QRCode) {
        return res.send({ status: 404, message: "QRCode not found!" });
      }
      if (QRCode.isActive === false) {
        return res.send({ status: 409, message: "The QR is already inactive" });
      }
      QRCode.isActive = false;
      QRCode.save();
      return res.send({
        status: 200,
        message: "QRCode inactivated successfully.",
        QRCode,
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred while inactivating the QRCode:", error);
    return res.send({
      status: 500,
      message: "Error occurred while inactivating the QRCode!",
    });
  }
};

// verify QR code (optional:- not using right now)
exports.verifyQRCode = async (req, res) => {
  try {
    const allowedRoles = ["Administrator", "Manager", "Employee"];
    if (allowedRoles.includes(req.user.role)) {
      const { qrValue } = req.body;

      const user = await User.findOne({
        _id: req.user._id,
        isDelete: { $ne: true },
      });
      if (!user) {
        return res.send({ status: 404, message: "User not found." });
      }
      let companyId = user?.companyId.toString();
      let locationId = user?.locationId.toString();

      const qrCode = await QR.findOne({
        qrValue,
        companyId,
        locationId,
      });

      if (!qrCode) {
        return res.send({
          status: 400,
          message: "QR code not found or invalid QR code",
        });
      }

      return res.send({
        status: 200,
        message: "QR code verified successfully.",
        entityDetails: {
          userId: user._id,
          qrValue,
          locationId,
          companyId,
        },
      });
    } else return res.send({ status: 403, message: "Access denied" });
  } catch (error) {
    console.error("Error occurred during QR code verification:", error);
    return res.send({
      status: 500,
      message: "Error occurred during QR code verification!",
    });
  }
};

// old code
// // for generate QR code
// exports.generateQRcode = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator']
//         if(allowedRoles.includes(req.user.role)){
//             const { companyId, locationId, clientId } = req.query
//             const {
//                 // qrType,
//                 qrCode,
//                 qrValue
//             } = req.body

//             const idsPassed = [companyId, locationId, clientId].filter(Boolean)
//             if (idsPassed.length !== 1) {
//                 return res.send({ status: 400, message: 'Please provide exactly one of companyId, locationId, or clientId.' })
//             }

//             const matches = qrCode.match(/^data:(image\/\w+);base64,(.+)$/)
//             if (!matches || matches.length !== 3) {
//                 return res.send({ status: 400, message: 'Invalid Image Format!' })
//             }

//             const imageBuffer = Buffer.from(matches[2], 'base64')

//             const compressedBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`

//             const fileName = unique_Id()
//             let element = await uploadToS3(compressedBase64, 'QRCodes', fileName)

//             if (!element?.fileUrl) {
//                 return res.send({ status: 500, message: 'Failed to upload QR code to storage.' })
//             }

//             let qrData = {
//                 qrURL: element?.fileUrl,
//                 qrValue,
//                 isActive: true
//             }

//             if(companyId){
//                 const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
//                 if(!company) return res.send({ status: 404, message: 'Company not found' })

//                 qrData = {
//                     ...qrData,
//                     companyId,
//                     companyName: company?.companyDetails?.businessName,
//                     isCompanyQR: true,
//                     qrType: 'Company'
//                 }
//             } else if(locationId){
//                 const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
//                 if(!location) return res.send({ status: 404, message: 'Location not found' })

//                 if(location.latitude == "" || location.longitude == "" || location.radius == ""){
//                     return res.send({ status: 400, message: 'You should first add or update the latitude, longitude and radius for this location before proceeding.' })
//                 }

//                 const company = await Company.findOne({ _id: location?.companyId, isDeleted: { $ne: true } })
//                 if(!company) return res.send({ status: 404, message: 'Company not found' })

//                 qrData = {
//                     ...qrData,
//                     companyId: location.companyId,
//                     companyName: company?.companyDetails?.businessName,
//                     locationName: location?.locationName,
//                     locationId,
//                     isLocationQR: true,
//                     qrType: 'Location'
//                 }
//             } else if(clientId){
//                 const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } })
//                 if(!client){
//                     return res.send({ status: 404, message: 'Client not found' })
//                 }

//                 if(client.latitude == "" || client.longitude == "" || client.radius == ""){
//                     return res.send({ status: 400, message: 'You should first add or update the latitude, longitude and radius for this client before proceeding.' })
//                 }

//                 const company = await Company.findOne({ _id: client?.companyId, isDeleted: { $ne: true } })
//                 if(!company) return res.send({ status: 404, message: 'Company not found' })

//                 client.QRCodeImage = element?.fileUrl

//                 qrData = {
//                     ...qrData,
//                     clientName: client?.clientName,
//                     companyId: client?.companyId,
//                     companyName: company?.companyDetails?.businessName,
//                     clientId,
//                     isClientQR: true,
//                     qrType: 'Client'
//                 }
//             }

//             const QRCode = await QR.create(qrData)
//             return res.send({ status: 200, message: `${qrData?.qrType} QR generated successfully.`, QRCode })
//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occured while generating QR code:', error)
//         return res.send({ status: 500, message: 'Error occured while generating QR code!' })
//     }
// }

// // get all QR codes by location ID
// exports.getAllQRCodes = async (req, res) => {
//     try {
//         const allowedRoles = ['Superadmin', 'Administrator']
//         if(allowedRoles.includes(req.user.role)){
//             const locationId = req.params.id
//             const page = parseInt(req.query.page) || 1
//             const limit = parseInt(req.query.limit) || 50
//             const searchQuery = req.query.search ? req.query.search.trim() : ''

//             const skip = ( page - 1 ) * limit

//             const location = await Location.findOne({ _id: locationId, isDeleted: { $ne: true } })
//             if(!location){
//                 return res.send({ status: 404, message: 'Location not found.' })
//             }

//             const companyId = location?.companyId
//             const company = await Company.findOne({ _id: companyId, isDeleted: { $ne: true } })
//             if(!company){
//                 return res.send({ status: 404, message: 'Company not found.' })
//             }

//             let baseQuery = { companyId, locationId, isActive: { $ne: false } }

//             let QRCodes = await QR.find(baseQuery).populate('locationId', 'locationName')

//             if(searchQuery){
//                 const regex = new RegExp(searchQuery.replace(/[-\s]/g, "[-\\s]*"), "i")
//                 QRCodes = QRCodes.filter(QR => {
//                     const locationName = QR?.locationId?.locationName
//                     return regex.test(`${locationName}`)
//                 })
//             }

//             const totalQRCodes = QRCodes.length
//             const allQRCodes = QRCodes.slice(skip, skip + limit)

//             let qrValue = `${location?.locationName}-${company?.companyDetails?.businessName}`

//             return res.send({
//                 status: 200,
//                 message: 'QR codes fetched successfully.',
//                 qrValue,
//                 QRCodes: allQRCodes,
//                 totalQRCodes,
//                 totalPages: Math.ceil(totalQRCodes / limit) || 1,
//                 currentPage: page || 1
//             })

//         } else return res.send({ status: 403, message: 'Access denied' })
//     } catch (error) {
//         console.error('Error occurred while fetching company QR codes:', error)
//         return res.send({ status: 500, message: 'Error occurred while fetching QR codes!' })
//     }
// }

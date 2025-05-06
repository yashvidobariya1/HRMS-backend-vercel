const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const crypto = require('crypto')
// const { fileTypeFromBuffer } = require('file-type');

const S3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
})

const getFileExtensionFromBuffer = async (buffer) => {
    const { fileTypeFromBuffer } = await import('file-type')
    const type = await fileTypeFromBuffer(buffer);
    return type?.ext;
}

const mimeToExtension = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

exports.uploadToS3 = async (base64Data, folder, uploadedFileName) => {
    const matches = base64Data.match(/^data:(.+);base64,(.*)$/)
    if (!matches) throw new Error("Invalid base64 format")
  
    const mimeType = matches[1]
    const base64 = matches[2]
    const buffer = Buffer.from(base64, "base64")
  
    const fileExtension = mimeToExtension[mimeType] || mimeType.split("/")[1]
    const fileName = `${folder}/${uploadedFileName}.${fileExtension}`
  
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`
  
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: mimeType,
    }
  
    const uploadResult = await S3.send(new PutObjectCommand(params))
    return { uploadResult, fileUrl }
}

exports.uploadBufferToS3 = async (bufferData, folder, uploadedFileName) => {
    const fileExtension = await getFileExtensionFromBuffer(bufferData)
    const fileName = `${folder}/${uploadedFileName}.${fileExtension}`

    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: bufferData,
        ContentEncoding: 'base64',
        ContentType: fileExtension,
    }

    const uploadResult = await S3.send(new PutObjectCommand(params))
    return { uploadResult, fileUrl }
}

exports.unique_Id = (length = 15) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let uniqueId = ''
    
    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, characters.length)
        uniqueId += characters[randomIndex]
    }

    return uniqueId
}
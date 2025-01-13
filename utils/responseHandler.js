

exports.responseSuccess = (res, resMessage, statusCode, resData) => {
    return res.send({
        status: statusCode || 500,
        message: resMessage,
        data: resData
    })
}
// return responseSuccess(res, 'Employee get successfully.', 200, employee)

exports.responseError = (res, resMessage, statusCode) => {
    return res.send({
        status: statusCode,
        message: resMessage,
    })
}
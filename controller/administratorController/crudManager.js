const User = require('../../models/user')

exports.addManager = async (req, res) =>{
    try {
        let {
            personalDetails,
            addressDetails,
            kinDetails,
            financialDetails,
            jobDetails,
            immigrationDetails,
            documentDetails,
            contractDetails
        } = req.body

        // if (!personalDetails || !addressDetails || !jobDetails || !immigrationDetails) {
        //     return res.status(400).send({ message: "All sections of employee details are required." });
        // }            

        const newManager = {
            personalDetails,
            addressDetails,
            kinDetails,
            financialDetails,
            jobDetails,
            immigrationDetails,
            role: jobDetails?.role,
            documentDetails,
            contractDetails,
            // createdBy: req.user.role,
            // creatorId: req.user._id,
        }

        // console.log('new manager', newManager)
        const manager = await User.create(newManager)

        return res.status(200).send({ message: 'Manager created successfully.', manager })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getManager = async (req, res) =>{
    try {
        const managerId = req.params.id
        if (!managerId || managerId == 'undefined' || managerId == 'null') {
            return res.status(404).send({ message: 'Manager not found' })
        }
        const manager = await User.findOne({
            _id: managerId,
            isDeleted: { $ne: true }
        })

        if(!manager){
            return res.status(404).send({ message: 'Manager not found.' })
        }
        return res.status(200).send({ message: 'Manager get successfully.', manager })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.getAllManager = async (req, res) =>{
    try {
        const managers = await User.find({
            role: "Manager",
            isDeleted: { $ne: true }
        })
        return res.status(200).send({ message: 'Manager all get successfully.', managers })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.updateManagerDetails = async (req, res) =>{
    try {
        const managerId = req.params.id

        const manager = await User.findById({
            _id: managerId,
            isDeleted: { $ne: true }
        })
        // console.log('manager/...', manager)

        if(!manager) {
            return res.status(404).send({ message: 'Manager not found' })
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
        } = req.body

        const updatedPersonalDetails = {
            firstName: personalDetails?.firstName || manager.personalDetails.firstName,
            middleName: personalDetails?.middleName || manager.personalDetails.middleName,
            lastName: personalDetails?.lastName || manager.personalDetails.lastName,
            dateOfBirth: personalDetails?.dateOfBirth || manager.personalDetails.dateOfBirth,
            gender: personalDetails?.gender || manager.personalDetails.gender,
            maritalStatus: personalDetails?.maritalStatus || manager.personalDetails.maritalStatus,
            phone: personalDetails?.phone || manager.personalDetails.phone,
            homeTelephone: personalDetails?.homeTelephone || manager.personalDetails.homeTelephone,
            email: personalDetails?.email || manager.personalDetails.email,
            niNumber: personalDetails?.niNumber || manager.personalDetails.niNumber,
        }

        const updatedAddressDetails = {
            address: addressDetails?.address || manager.addressDetails.address,
            addressLine2: addressDetails?.addressLine2 || manager.addressDetails.addressLine2,
            city: addressDetails?.city || manager.addressDetails.city,
            postCode: addressDetails?.postCode || manager.addressDetails.postCode,
        }

        const updatedKinDetails = {
            kinName: kinDetails?.kinName || manager.kinDetails.kinName,
            relationshipToYou: kinDetails?.relationshipToYou || manager.kinDetails.relationshipToYou,
            address: kinDetails?.address || manager.kinDetails.address,
            postCode: kinDetails?.kinName || manager.kinDetails.kinName,
            emergencyContactNumber: kinDetails?.emergencyContactNumber || manager.kinDetails.emergencyContactNumber,
            email: kinDetails?.email || manager.kinDetails.email,
        }

        const updatedFinancialDetails = {
            bankName: financialDetails?.bankName || manager.financialDetails.bankName,
            holderName: financialDetails?.holderName || manager.financialDetails.holderName,
            sortCode: financialDetails?.sortCode || manager.financialDetails.sortCode,
            accountNumber: financialDetails?.accountNumber || manager.financialDetails.accountNumber,
            payrollFrequency: financialDetails?.payrollFrequency || manager.financialDetails.payrollFrequency,
            pension: financialDetails?.pension || manager.financialDetails.pension,
        }

        const updatedJobDetails = {
            jobTitle: jobDetails?.jobTitle || manager.jobDetails.jobTitle,
            jobDescription: jobDetails?.jobDescription || manager.jobDetails.jobDescription,
            annualSalary: jobDetails?.annualSalary || manager.jobDetails.annualSalary,
            hourlyRate: jobDetails?.hourlyRate || manager.jobDetails.hourlyRate,
            weeklyWorkingHours: jobDetails?.weeklyWorkingHours || manager.jobDetails.weeklyWorkingHours,
            weeklyWorkingHoursPattern: jobDetails?.weeklyWorkingHoursPattern || manager.jobDetails.weeklyWorkingHoursPattern,
            weeklySalary: jobDetails?.weeklySalary || manager.jobDetails.weeklySalary,
            joiningDate: jobDetails?.joiningDate || manager.jobDetails.joiningDate,
            socCode: jobDetails?.socCode || manager.jobDetails.socCode,
            modeOfTransfer: jobDetails?.modeOfTransfer || manager.jobDetails.modeOfTransfer,
            sickLeavesAllow: jobDetails?.sickLeavesAllow || manager.jobDetails.sickLeavesAllow,
            leavesAllow: jobDetails?.leavesAllow || manager.jobDetails.leavesAllow,
            location: jobDetails?.location || manager.jobDetails.location,
            assignManager: jobDetails?.assignManager || manager.jobDetails.assignManager,
            role: jobDetails?.role || manager.jobDetails.role,
        }

        const updatedImmigrationDetails = {
            passportNumber: immigrationDetails?.passportNumber || manager.immigrationDetails.passportNumber,
            countryOfIssue: immigrationDetails?.countryOfIssue || manager.immigrationDetails.countryOfIssue,
            passportExpiry: immigrationDetails?.passportExpiry || manager.immigrationDetails.passportExpiry,
            nationality: immigrationDetails?.nationality || manager.immigrationDetails.nationality,
            visaCategory: immigrationDetails?.visaCategory || manager.immigrationDetails.visaCategory,
            visaValidFrom: immigrationDetails?.visaValidFrom || manager.immigrationDetails.visaValidFrom,
            visaValidTo: immigrationDetails?.visaValidTo || manager.immigrationDetails.visaValidTo,
            brpNumber: immigrationDetails?.brpNumber || manager.immigrationDetails.brpNumber,
            cosNumber: immigrationDetails?.cosNumber || manager.immigrationDetails.cosNumber,
            restriction: immigrationDetails?.restriction || manager.immigrationDetails.restriction,
            shareCode: immigrationDetails?.shareCode || manager.immigrationDetails.shareCode,
            rightToWorkCheckDate: immigrationDetails?.rightToWorkCheckDate || manager.immigrationDetails.rightToWorkCheckDate,
            rightToWorkEndDate: immigrationDetails?.rightToWorkEndDate || manager.immigrationDetails.rightToWorkEndDate,
        }

        let updateManager = await User.findByIdAndUpdate(
            { _id: managerId },
            {
                $set: {
                    personalDetails: updatedPersonalDetails,
                    addressDetails: updatedAddressDetails,
                    kinDetails: updatedKinDetails,
                    financialDetails: updatedFinancialDetails,
                    jobDetails: updatedJobDetails,
                    immigrationDetails: updatedImmigrationDetails,
                    documentDetails,
                    contractDetails,
                    updatedAt: new Date()
                }
            }, { new: true }
        )
        
        return res.status(200).send({ message: 'Manager details updated successfully.', updateManager })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}

exports.deleteManager = async (req, res) =>{
    try {
        const managerId = req.params.id

        const manager = await User.findOne({
            _id: managerId,
            isDeleted: { $ne: true }
        })

        if(!manager) {
            return res.status(404).send({ message: 'Manager not found' })
        }

        let deletedManager = await User.findByIdAndUpdate(managerId, {
            $set: {
                isDeleted: true,
                canceledAt: new Date()
            }
        })

        return res.status(200).send({ message: 'Manager deleted successfully.', deletedManager })
    } catch (error) {
        console.log('Error:', error)
        return res.send({ message: error.message })
    }
}
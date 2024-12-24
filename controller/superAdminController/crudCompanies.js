

exports.addCompany = async (req, res) => {
    try {
        if(req.user.role == 'superAdmin') {
            let {
                
            } = req.body            

            const newCompany = {
                
            }

            console.log('new company', newCompany)
            const company = Company.create(newCompany)
            await company.save()

            return res.status(200).send({ message: 'Company created successfully.', company })
        } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}

exports.getCompany = async (req, res) => {
    try {
        if(req.user.role == 'superAdmin') {
            const companyId = req.params.id

            const company = Company.findById(companyId)

            if(!company) {
                return res.status(404).send('Company not found')
            }

            return res.status(200).send(company)
        } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}

exports.uodateCompanyDetails = async (req, res) => {
    try {
        if(req.user.role == 'superAdmin') {
            const companyId = req.params.id

            const company = User.findById(companyId)

            if(!company) {
                return res.status(404).send('Company not found')
            }

            let {
                
            } = req.body

            let updatedCompany = Company.findOneAndUpdate(
                { _id: companyId },
                {
                    $set: {
                        
                    }
                }, { new: true }
            )
            
            return res.status(200).send({ message: 'Company details updated successfully.', updatedCompany })
        } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}

exports.deleteCompany = async (req, res) => {
    try {
        if(req.user.role == 'superAdmin') {
            const companyId = req.params.id

            const company = Company.findById(companyId)

            if(!company) {
                return res.status(404).send('Employee not found')
            }

            let deletedCompany = Company.findOneAndDelete(companyId)

            return res.status(200).send({ message: 'Company removed successfully.', deletedCompany })
        } else return res.status(401).send('You can not authorize for this action.')
    } catch (error) {
        console.log('Error:', error)
        return res.send(error.message)
    }
}
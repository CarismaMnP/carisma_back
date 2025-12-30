const ApiError = require('../error/ApiError')
const {BlockData} = require('../models/models')

class BlockController {

    async fetchBlock(req, res, next) {
        try {
            const {name} = req.query

            console.log("\n\n\nfetch")
            console.log(name)
            
            const block = await BlockData.findOne({where: {name}})

            return res.json(block)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async updateBlock(req, res, next) {
        try {
            const {name, data} = req.body
            
            const jsonData = data

            const block = await BlockData.update({data: jsonData}, {where: {name}, returning: true})

            return res.json(block[1][0])
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new BlockController()
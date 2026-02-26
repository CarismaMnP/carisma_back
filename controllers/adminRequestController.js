const ApiError = require('../error/ApiError')
const { PartRequest, ClientMessageRequest } = require('../models/models')

class AdminRequestController {
  async fetchPartRequests(req, res, next) {
    try {
      const requests = await PartRequest.findAll({
        order: [['createdAt', 'DESC']]
      })

      return res.json(requests)
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async fetchClientMessageRequests(req, res, next) {
    try {
      const requests = await ClientMessageRequest.findAll({
        order: [['createdAt', 'DESC']]
      })

      return res.json(requests)
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async markAsRead(req, res, next) {
    try {
      const { id } = req.body

      if (!id || typeof id !== 'string') {
        return next(ApiError.badRequest('Request id is required'))
      }

      const partRequest = await PartRequest.findByPk(id)
      if (partRequest) {
        await partRequest.update({ isUnread: false })
        return res.json({ success: true, requestType: 'part-request', request: partRequest })
      }

      const clientMessageRequest = await ClientMessageRequest.findByPk(id)
      if (clientMessageRequest) {
        await clientMessageRequest.update({ isUnread: false })
        return res.json({ success: true, requestType: 'client-message', request: clientMessageRequest })
      }

      return next(ApiError.badRequest('Request not found'))
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }
}

module.exports = new AdminRequestController()

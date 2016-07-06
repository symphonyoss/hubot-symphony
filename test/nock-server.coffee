util = require 'util'
logger = require('log4js').getLogger()
nock = require 'nock'

class NockServer
  constructor: (@host) ->
    logger.info util.format('Setting up mocks for %s', @host)
    nock.disableNetConnect()
    @authScope = nock(@host)
      .matchHeader('sessionToken', (val) -> !val?)
      .matchHeader('keyManagerToken', (val) -> !val?)
      .post('/sessionauth/v1/authenticate')
      .reply(200, {
                    "name": "sessionToken",
                    "token": "SESSION_TOKEN"
                  })
      .post('/keyauth/v1/authenticate')
      .reply(200, {
                    "name": "keyManagerToken",
                    "token": "KEY_MANAGER_TOKEN"
                  })
      .post('/agent/v1/util/echo')
      .reply(401, {
                    "code": 401,
                    "message": "Invalid session"
                  })

    @agentScope = nock(@host)
      .matchHeader('sessionToken', 'SESSION_TOKEN')
      .matchHeader('keyManagerToken', 'KEY_MANAGER_TOKEN')
      .post('/agent/v1/util/echo')
      .reply(200, (uri, requestBody) -> requestBody)

module.exports = NockServer
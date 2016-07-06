util = require 'util'
fs = require 'fs'
https = require 'https'
Q = require 'q'
logger = require('log4js').getLogger()

class Symphony

  constructor: (@host, @privateKey, @publicKey) ->
    logger.info('Connecting to ' + @host)
    @sessionAuth = @httpPost('/sessionauth/v1/authenticate')
    @keyAuth = @httpPost('/keyauth/v1/authenticate')

  echo: (body) =>
    Q.all([@sessionAuth, @keyAuth]).then (values) =>
      headers = {
        sessionToken: values[0].token
        keyManagerToken: values[1].token
      }
      @httpPost('/agent/v1/util/echo', headers, body)

  httpPost: (path, headers = {}, body) =>
    deferred = Q.defer()
    options = {
      host: @host
      path: path
      headers: Object.assign(headers, {
        accept: 'application/json'
      })
      method: 'POST'
      key: fs.readFileSync(@privateKey)
      cert: fs.readFileSync(@publicKey)
    }

    req = https.request(options, (res) =>
      res.on('data', (data) =>
        logger.debug util.format('received response from %s: %s', path, data)
        deferred.resolve JSON.parse(data)
      )
    )
    req.on('error', (e) =>
      logger.warn util.format('received error response from %s: %s', path, e)
      deferred.reject(new Error(e))
    )
    if body?
      req.write(JSON.stringify(body))
    req.end()
    deferred.promise

module.exports = Symphony
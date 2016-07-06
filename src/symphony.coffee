#
#    Copyright 2016 Jon Freedman
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#        http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#

util = require 'util'
fs = require 'fs'
https = require 'https'
Q = require 'q'
logger = require('log4js').getLogger()

class Symphony

  constructor: (@host, @privateKey, @publicKey) ->
    logger.info('Connecting to ' + @host)
    @sessionAuth = @_httpPost('/sessionauth/v1/authenticate')
    @keyAuth = @_httpPost('/keyauth/v1/authenticate')

  echo: (body) =>
    @_httpPostWithAuth('/agent/v1/util/echo', body)

  sendMessage: (streamId, message) =>
    body = {
      message: message
      format: 'TEXT'
    }
    @_httpPostWithAuth('/agent/v2/stream/' + streamId + '/message/create', body)

  _httpPostWithAuth: (path, body) =>
    Q.all([@sessionAuth, @keyAuth]).then (values) =>
      headers = {
        sessionToken: values[0].token
        keyManagerToken: values[1].token
      }
      @_httpPost(path, headers, body)

  _httpPost: (path, headers = {}, body) =>
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
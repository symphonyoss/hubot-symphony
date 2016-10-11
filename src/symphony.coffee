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

Log = require('log')
logger = new Log process.env.HUBOT_SYMPHONY_LOG_LEVEL or process.env.HUBOT_LOG_LEVEL or 'info'

fs = require 'fs'
request = require 'request'
Q = require 'q'
memoize = require 'memoizee'

class Symphony

  constructor: ({@host, @privateKey, @publicKey, @passphrase, @keyManagerHost, @agentHost}) ->
    @keyManagerHost = @keyManagerHost ? @host
    @agentHost = @agentHost ? @host
    logger.info "Connecting to #{@host}"
    if @keyManagerHost isnt @host
      logger.info "Using separate KeyManager #{@keyManagerHost}"
    if @agentHost isnt @host
      logger.info "Using separate Agent #{@agentHost}"
    # refresh tokens on a weekly basis
    weeklyRefresh = memoize @_httpPost, {maxAge: 604800000, length: 2}
    @sessionAuth = => weeklyRefresh @host, '/sessionauth/v1/authenticate'
    @keyAuth = => weeklyRefresh @keyManagerHost, '/keyauth/v1/authenticate'
    Q.all([@sessionAuth(), @keyAuth()]).then (values) ->
      logger.info "Initialising with sessionToken: #{values[0].token} and keyManagerToken: #{values[1].token}"

  echo: (body) =>
    @_httpAgentPost('/agent/v1/util/echo', true, body)

  whoAmI: =>
    @_httpPodGet('/pod/v1/sessioninfo', true)

  getUser: ({userId, userName, emailAddress}) =>
    if userId?
      @_httpPodGet("/pod/v2/user?uid=#{userId}&local=true", true)
    else if userName?
      @_httpPodGet("/pod/v2/user?username=#{userName}&local=true", true)
    else if emailAddress?
      @_httpPodGet("/pod/v2/user?email=#{emailAddress}&local=true", true)
    else
      Q.reject('No user arguement supplied')

  sendMessage: (streamId, message, format) =>
    body = {
      message: message
      format: format
    }
    @_httpAgentPost("/agent/v2/stream/#{streamId}/message/create", true, body)

  getMessages: (streamId) =>
    @_httpAgentGet("/agent/v2/stream/#{streamId}/message", true)

  createDatafeed: =>
    @_httpAgentPost('/agent/v1/datafeed/create', true)

  readDatafeed: (datafeedId) =>
    @_httpAgentGet("/agent/v2/datafeed/#{datafeedId}/read",  false)

  createIM: (userId) =>
    @_httpPodPost('/pod/v1/im/create', true, [userId])

  _httpPodGet: (path, failUnlessHttp200) =>
    @sessionAuth().then (value) =>
      headers = {
        sessionToken: value.token
      }
      @_httpGet(@agentHost, path, headers, failUnlessHttp200)

  _httpPodPost: (path, failUnlessHttp200, body) =>
    @sessionAuth().then (value) =>
      headers = {
        sessionToken: value.token
      }
      @_httpPost(@agentHost, path, headers, failUnlessHttp200, body)

  _httpAgentGet: (path, failUnlessHttp200) =>
    Q.all([@sessionAuth(), @keyAuth()]).then (values) =>
      headers = {
        sessionToken: values[0].token
        keyManagerToken: values[1].token
      }
      @_httpGet(@agentHost, path, headers, failUnlessHttp200)

  _httpAgentPost: (path, failUnlessHttp200, body) =>
    Q.all([@sessionAuth(), @keyAuth()]).then (values) =>
      headers = {
        sessionToken: values[0].token
        keyManagerToken: values[1].token
      }
      @_httpPost(@agentHost, path, headers, failUnlessHttp200, body)

  _httpGet: (host, path, headers = {}, failUnlessHttp200) =>
    @_httpRequest('GET', host, path, headers, failUnlessHttp200)

  _httpPost: (host, path, headers = {}, failUnlessHttp200, body) =>
    @_httpRequest('POST', host, path, headers, failUnlessHttp200, body)

  _httpRequest: (method, host, path, headers, failUnlessHttp200, body) =>
    deferred = Q.defer()
    options = {
      baseUrl: 'https://' + host
      url: path
      json: true
      headers: headers
      method: method
      key: fs.readFileSync(@privateKey)
      cert: fs.readFileSync(@publicKey)
      passphrase: @passphrase
    }
    if body?
      options.body = body

    request(options, (err, res, data) ->
      if err?
        logger.warning "received #{res?.statusCode} error response from https://#{host}#{path}: #{err}"
        deferred.reject(new Error(err))
      else
        if failUnlessHttp200 && Math.floor(res?.statusCode / 100) != 2
          err = "received #{res?.statusCode} response from https://#{host}#{path}: #{JSON.stringify(data)}"
          logger.warning err
          deferred.reject new Error(err)
        else
          logger.debug "received #{res?.statusCode} response from https://#{host}#{path}: #{JSON.stringify(data)}"
          deferred.resolve data
    )
    deferred.promise

module.exports = Symphony

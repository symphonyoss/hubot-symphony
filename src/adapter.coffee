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

{Adapter} = require 'hubot'

Symphony = require './symphony'
V2Message = require './message'
memoize = require 'memoizee'
backoff = require 'backoff'
Entities = require('html-entities').XmlEntities
entities = new Entities()

class SymphonyAdapter extends Adapter

  constructor: (robot, @options = {}) ->
    super(robot)
    throw new Error('HUBOT_SYMPHONY_HOST undefined') unless process.env.HUBOT_SYMPHONY_HOST
    throw new Error('HUBOT_SYMPHONY_PUBLIC_KEY undefined') unless process.env.HUBOT_SYMPHONY_PUBLIC_KEY
    throw new Error('HUBOT_SYMPHONY_PRIVATE_KEY undefined') unless process.env.HUBOT_SYMPHONY_PRIVATE_KEY
    throw new Error('HUBOT_SYMPHONY_PASSPHRASE undefined') unless process.env.HUBOT_SYMPHONY_PASSPHRASE

    @expBackoff = backoff.exponential(initialDelay: 10, maxDelay: 60000)
    @expBackoff.on 'backoff', (num, delay) =>
      if num > 0
        @robot.logger.info "Re-attempting to create datafeed - attempt #{num} after #{delay}ms"
    @expBackoff.on 'ready', () =>
      @symphony.createDatafeed()
        .then (response) =>
          if response.id?
            @robot.logger.info "Created datafeed: #{response.id}"
            this.removeAllListeners 'poll'
            this.on 'poll', @_pollDatafeed
            @emit 'poll', response.id
            @robot.logger.debug "First 'poll' event emitted"
            @emit 'connected'
            @robot.logger.debug "'connected' event emitted"
            @expBackoff.reset()
          else
            @robot.emit 'error', new Error("Unable to create datafeed: #{response}")
            @expBackoff.backoff()
        .catch (err) =>
          @robot.emit 'error', new Error("Unable to create datafeed: #{err}")
          @expBackoff.backoff()
    @expBackoff.on 'fail', () =>
      @robot.logger.info 'Shutting down...'
      @options.shutdownFunc()
    failAfter = @options.failConnectAfter ? 23 # will time out reconnecting after ~10min
    @robot.logger.info "Reconnect attempts = #{failAfter}"
    @expBackoff.failAfter(failAfter)

  send: (envelope, messages...) ->
    @robot.logger.debug "Send #{messages.length} messages to #{envelope.room}"
    for message in messages
      format = message.format ? 'TEXT'
      text = message.text ? message
      @symphony.sendMessage(envelope.room, text, format)

  sendDirectMessageToUsername: (username, messages...) ->
    @robot.logger.debug "Sending direct message to username: #{username}"
    @_userLookup({username: username})
      .then (response) =>
        @_sendDirectMessageToUserId(response.id, messages...)

  sendDirectMessageToEmail: (email, messages...) ->
    @robot.logger.debug "Sending direct message to email: #{email}"
    @_userLookup({emailAddress: email})
      .then (response) =>
        @_sendDirectMessageToUserId(response.id, messages...)

  _sendDirectMessageToUserId: (userId, messages...) ->
    @symphony.createIM(userId)
      .then (response) =>
        @send({room: response.id}, messages...)

  reply: (envelope, messages...) ->
    @robot.logger.debug "Reply #{messages.length} messages to #{envelope.user.emailAddress} in #{envelope.room}"
    for message in messages
      @symphony.sendMessage(envelope.room, "<messageML><mention email=\"#{envelope.user.emailAddress}\"/> #{entities.encode(message)}</messageML>", 'MESSAGEML')

  run: =>
    @robot.logger.info "Initialising..."
    host = process.env.HUBOT_SYMPHONY_HOST
    privateKey = process.env.HUBOT_SYMPHONY_PRIVATE_KEY
    publicKey = process.env.HUBOT_SYMPHONY_PUBLIC_KEY
    passprhase = process.env.HUBOT_SYMPHONY_PASSPHRASE
    keyManagerHost = process.env.HUBOT_SYMPHONY_KM_HOST ? host
    sessionAuthHost = process.env.HUBOT_SYMPHONY_SESSIONAUTH_HOST ? host
    agentHost = process.env.HUBOT_SYMPHONY_AGENT_HOST ? host
    @symphony = new Symphony({host: host, privateKey: privateKey, publicKey: publicKey, passphrase: passprhase, keyManagerHost: keyManagerHost, sessionAuthHost: sessionAuthHost, agentHost: agentHost})
    @symphony.whoAmI()
      .then (response) =>
        @robot.userId = response.userId
        @symphony.getUser({userId: response.userId})
        .then (response) =>
          @robot.displayName = response.displayName
          @robot.logger.info "Connected as #{response.displayName}"
      .catch (err) =>
        @robot.emit 'error', new Error("Unable to resolve identity: #{err}")
    hourlyRefresh = memoize @_getUser, {maxAge: 3600000, length: 2}
    @_userLookup = (query, streamId) -> hourlyRefresh query, streamId
    @_createDatafeed()
    return

  close: =>
    @robot.logger.debug 'Removing datafeed poller'
    this.removeListener 'poll', @_pollDatafeed

  _createDatafeed: =>
    @expBackoff.backoff()

  _pollDatafeed: (id) =>
    # defer execution to ensure we don't go into an infinite polling loop
    process.nextTick =>
      @robot.logger.debug "Polling datafeed #{id}"
      @symphony.readDatafeed(id)
        .then (response) =>
          if response?
            @robot.logger.debug "Received #{response.length ? 0} datafeed messages"
            @_receiveMessage msg for msg in response when msg.v2messageType is 'V2Message'
          @emit 'poll', id
        .catch (err) =>
          @robot.emit 'error', new Error("Unable to read datafeed #{id}: #{err}")
          @_createDatafeed()

  _receiveMessage: (message) =>
    if message.fromUserId != @robot.userId
      @_userLookup({userId: message.fromUserId}, message.streamId)
        .then (response) =>
          v2 = new V2Message(response, message)
          @robot.logger.debug "Received '#{v2.text}' from #{v2.user.name}"
          @receive v2
        .catch (err) =>
          @robot.emit 'error', new Error("Unable to fetch user details: #{err}")

  _getUser: (query, streamId) =>
    @symphony.getUser(query)
      .then (response) =>
        # record basic user details in hubot's brain, setting the room causes the brain to update each time we're seen in a new conversation
        userId = response.id
        existing = @robot.brain.userForId(userId)
        existing['name'] = response.username
        existing['displayName'] = response.displayName
        existing['emailAddress'] = response.emailAddress
        if streamId?
          existing['room'] = streamId
        @robot.brain.userForId(userId, existing)
        existing

exports.use = (robot, options = {}) ->
  options.shutdownFunc = options.shutdownFunc ? () ->
    process.exit 1
  new SymphonyAdapter robot, options

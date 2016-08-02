#
#    Copyright 2016 The Symphony Software Foundation
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
{V2Message} = require './message'
memoize = require 'memoizee'

class SymphonyAdapter extends Adapter

  constructor: ->
    super
    throw new Error('HUBOT_SYMPHONY_HOST undefined') unless process.env.HUBOT_SYMPHONY_HOST
    throw new Error('HUBOT_SYMPHONY_PUBLIC_KEY undefined') unless process.env.HUBOT_SYMPHONY_PUBLIC_KEY
    throw new Error('HUBOT_SYMPHONY_PRIVATE_KEY undefined') unless process.env.HUBOT_SYMPHONY_PRIVATE_KEY
    throw new Error('HUBOT_SYMPHONY_PASSPHRASE undefined') unless process.env.HUBOT_SYMPHONY_PASSPHRASE

  send: (envelope, messages...) ->
    @robot.logger.debug "Send"
    for message in messages
      format = message.format ? 'TEXT'
      text = message.text ? message
      @symphony.sendMessage(envelope.room, text, format)

  reply: (envelope, messages...) ->
    @robot.logger.debug "Reply"
    for message in messages
      @symphony.sendMessage(envelope.room, "<messageML><mention email=\"#{envelope.user.emailAddress}\"/> #{message}</messageML>", 'MESSAGEML')

  run: =>
    @robot.logger.info "Initialising..."
    @symphony = new Symphony(process.env.HUBOT_SYMPHONY_HOST, process.env.HUBOT_SYMPHONY_PRIVATE_KEY, process.env.HUBOT_SYMPHONY_PUBLIC_KEY, process.env.HUBOT_SYMPHONY_PASSPHRASE)
    @symphony.whoAmI()
      .then (response) =>
        @robot.userId = response.userId
        @symphony.getUser(response.userId)
        .then (response) =>
          @robot.displayName = response.userAttributes?.displayName
          @robot.logger.info "Connected as #{response.userAttributes?.displayName} [#{response.userSystemInfo?.status}]"
      .fail (err) =>
        @robot.emit 'error', new Error("Unable to resolve identity: #{err}")
    hourlyRefresh = memoize @symphony.getUser, {maxAge: 3600000, length: 1}
    @userLookup = (userId, streamId) =>
      user = hourlyRefresh userId
      user
        .then (response) =>
          # record basic user details in hubot's brain, setting the room causes the brain to update each time we're seen in a new conversation
          existing = @robot.brain.userForId(userId)
          existing['name'] = response.userAttributes?.userName
          existing['displayName'] = response.userAttributes?.displayName
          existing['emailAddress'] = response.userAttributes?.emailAddress
          existing['room'] = streamId
          @robot.brain.userForId(userId, existing)
      user
    @_createDatafeed()
      .then (response) =>
        @emit 'connected'
        @robot.logger.debug "'connected' event emitted"
    return

  close: =>
    @robot.logger.debug 'Removing datafeed poller'
    this.removeListener 'poll', @_pollDatafeed

  _createDatafeed: =>
    @symphony.createDatafeed()
      .then (response) =>
        if response.id?
          @robot.logger.info "Created datafeed: #{response.id}"
          this.removeAllListeners 'poll'
          this.on 'poll', @_pollDatafeed
          @emit 'poll', response.id
          @robot.logger.debug "First 'poll' event emitted"
        else
          @robot.emit 'error', new Error("Unable to create datafeed: #{response}")
      .fail (err) =>
        @robot.emit 'error', new Error("Unable to create datafeed: #{err}")

  _pollDatafeed: (id) =>
    # defer execution to ensure we don't go into an infinite polling loop
    process.nextTick =>
      @robot.logger.debug "Polling datafeed #{id}"
      @symphony.readDatafeed(id)
        .then (response) =>
          if response?
            @robot.logger.debug "Received #{response.length ? 0} datafeed messages"
            @_receiveMessage msg for msg in response when msg.v2messageType = 'V2Message'
          @emit 'poll', id
        .fail (err) =>
          @robot.emit 'error', new Error("Unable to read datafeed #{id}: #{err}")

  _receiveMessage: (message) =>
    if message.fromUserId != @robot.userId
      @userLookup(message.fromUserId, message.streamId)
        .then (response) =>
          v2 = new V2Message(response, message)
          @robot.logger.debug "Received '#{v2.text}' from #{v2.user.name}"
          @receive v2
        .fail (err) =>
          @robot.emit 'error', new Error("Unable to fetch user details: #{err}")

exports.use = (robot) ->
  new SymphonyAdapter robot
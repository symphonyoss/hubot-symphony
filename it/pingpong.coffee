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

assert = require('chai').assert

Log = require('log')
logger = new Log 'info'

Symphony = require '../src/symphony'

describe 'Foundation Open Developer Platform integration tests', () ->
  throw new Error('BOT_USER_CERT undefined') unless process.env.BOT_USER_CERT
  throw new Error('BOT_USER_KEY undefined') unless process.env.BOT_USER_KEY
  throw new Error('BOT_USER_PASSWORD undefined') unless process.env.BOT_USER_PASSWORD

  throw new Error('SENDER_USER_CERT undefined') unless process.env.SENDER_USER_CERT
  throw new Error('SENDER_USER_KEY undefined') unless process.env.SENDER_USER_KEY
  throw new Error('SENDER_USER_PASSWORD undefined') unless process.env.SENDER_USER_PASSWORD

  throw new Error('SYMPHONY_HOST undefined') unless process.env.SYMPHONY_HOST
  throw new Error('SYMPHONY_KM_HOST undefined') unless process.env.SYMPHONY_KM_HOST
  throw new Error('SYMPHONY_SESSIONAUTH_HOST undefined') unless process.env.SYMPHONY_SESSIONAUTH_HOST
  throw new Error('SYMPHONY_AGENT_HOST undefined') unless process.env.SYMPHONY_AGENT_HOST

  it 'should send a message from user account and receive it on bot account', (done) ->
    this.timeout(10000)

    # create two separate connections so we can send a message from one account to another
    botConnection = new Symphony({
      host: process.env.SYMPHONY_HOST,
      privateKey: process.env.BOT_USER_KEY,
      publicKey: process.env.BOT_USER_CERT,
      passphrase: process.env.BOT_USER_PASSWORD,
      keyManagerHost: process.env.SYMPHONY_KM_HOST,
      agentHost: process.env.SYMPHONY_AGENT_HOST,
      sessionAuthHost: process.env.SYMPHONY_SESSIONAUTH_HOST
    })
    userConnection = new Symphony({
      host: process.env.SYMPHONY_HOST,
      privateKey: process.env.SENDER_USER_KEY,
      publicKey: process.env.SENDER_USER_CERT,
      passphrase: process.env.SENDER_USER_PASSWORD,
      keyManagerHost: process.env.SYMPHONY_KM_HOST,
      agentHost: process.env.SYMPHONY_AGENT_HOST,
      sessionAuthHost: process.env.SYMPHONY_SESSIONAUTH_HOST
    })

    logger.info 'Connections initiated, starting tests...'

    # print bot & user account diagnostics, send message from user -> bot and verify receipt
    userConnection.whoAmI()
      .then (response) ->
        userConnection.getUser({userId: response.userId})
      .then (response) ->
        logger.info "User name is #{response.displayName} [#{response.emailAddress}]"
        botConnection.whoAmI()
      .then (response) ->
        botConnection.getUser({userId: response.userId})
      .then (response) ->
        logger.info "Bot name is #{response.displayName} [#{response.emailAddress}]"
        botUserId = response.id
        botConnection.createDatafeed()
        .then (response) ->
          datafeedId = response.id
          logger.info "Created datafeed: #{datafeedId}"
          # get conversation between user & bot
          userConnection.createIM(botUserId)
          .then (response) ->
            conversationId = response.id
            logger.info "Created conversation: #{conversationId}"
            # send ping from user to bot
            userConnection.sendMessage(conversationId, "ping", "TEXT")
          .then (response) ->
            botConnection.readDatafeed(datafeedId)
      .then (response) ->
        logger.info "Received '#{msg.message}'" for msg in response when msg.v2messageType = 'V2Message'
        done()
      .fail (err) ->
        done new Error "Ping integration test failure: #{err}"

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
assert = require('chai').assert
Symphony = require '../src/symphony'
NockServer = require './nock-server'

nock = new NockServer('https://foundation.symphony.com')

describe 'REST API test suite', () ->
  symphony = new Symphony('foundation.symphony.com', './test/resources/privateKey.pem', './test/resources/publicKey.pem')

  it 'whoAmI should get userId', () ->
    symphony.whoAmI()
      .then (response) ->
        assert.equal(nock.botUserId, response.userId)
      .fail (error) ->
        assert.fail(0, 1, util.format('Failed with error %s', error))

  it 'echo should obtain session and key tokens and echo response', () ->
    msg = { foo: 'bar' }
    symphony.echo(msg)
      .then (response) ->
        assert.deepEqual(msg, response)
      .fail (error) ->
        assert.fail(0, 1, util.format('Failed with error %s', error))

  it 'sendMessage should obtain session and key tokens and get message ack', () ->
    msg = '<messageML>Testing 123...</messageML>'
    symphony.sendMessage(nock.streamId, msg, 'MESSAGEML')
      .then (response) ->
        assert.equal(msg, response.message)
        assert.equal(nock.botUserId, response.fromUserId)
      .fail (error) ->
        assert.fail(0, 1, util.format('Failed with error %s', error))

  it 'getMessages should get all messages', () ->
    msg = '<messageML>Yo!</messageML>'
    symphony.sendMessage(nock.streamId, msg, 'MESSAGEML')
      .then (response) ->
        assert.equal(msg, response.message)
        symphony.getMessages(nock.streamId, nock.firstMessageTimestamp)
      .then (response) ->
        assert.isAtLeast(response.length, 2)
        assert.isAtLeast((m for m in response when m.message is '<messageML>Hello World</messageML>').length, 1)
        assert.isAtLeast((m for m in response when m.message is msg).length, 1)
      .fail (error) ->
        assert.fail(0, 1, util.format('Failed with error %s', error))

  it 'getUser should expose user details', () ->
    symphony.getUser(nock.realUserId)
      .then (response) ->
        assert.equal('johndoe@symphony.com', response.userAttributes.emailAddress)
      .fail (error) ->
        assert.fail(0, 1, util.format('Failed with error %s', error))
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
SymphonyAdapter = require '../src/adapter'
NockServer = require './nock-server'
{FakeRobot} = require './fakes'

process.env['HUBOT_SYMPHONY_HOST'] = 'foundation.symphony.com'
process.env['HUBOT_SYMPHONY_PUBLIC_KEY'] = './test/resources/publicKey.pem'
process.env['HUBOT_SYMPHONY_PRIVATE_KEY'] = './test/resources/privateKey.pem'
process.env['HUBOT_SYMPHONY_PASSPHRASE'] = 'changeit'

describe 'Constructor test', () ->
  constructorProps = ['HUBOT_SYMPHONY_HOST', 'HUBOT_SYMPHONY_PUBLIC_KEY', 'HUBOT_SYMPHONY_PRIVATE_KEY', 'HUBOT_SYMPHONY_PASSPHRASE']

  for constructorProp in constructorProps
    it "should throw on construction if #{constructorProp} missing", () ->
      prop = process.env[constructorProp]
      delete process.env[constructorProp]
      assert.throws(SymphonyAdapter.use, new RegExp("#{constructorProp} undefined"))
      process.env[constructorProp] = prop

describe 'Adapter test suite with helloWorld message', () ->
  nock = null
  symphony = null

  beforeEach ->
    nock = new NockServer({host: 'https://foundation.symphony.com'})

  afterEach ->
    nock.close()

  it 'should connect and receive message', (done) ->
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      robot.on 'received', () ->
        assert.isAtLeast((m for m in robot.received when m.text is 'Hello World').length, 1)
        adapter.close()
        done()
    adapter.run()

  it 'should retry on http 400 errors when reading datafeed', (done) ->
    nock.datafeedReadHttp400Count = 1
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      robot.on 'error', () ->
        adapter.on 'connected', () ->
          robot.on 'received', () ->
            assert.isAtLeast((m for m in robot.received when m.text is 'Hello World').length, 1)
            adapter.close()
            done()
    adapter.run()

  it 'should retry if datafeed cannot be created', (done) ->
    nock.datafeedCreateHttp400Count = 1
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      robot.on 'received', () ->
        assert.isAtLeast((m for m in robot.received when m.text is 'Hello World').length, 1)
        adapter.close()
        done()
    adapter.run()

describe 'Adapter test suite', () ->
  nock = null
  symphony = null

  beforeEach ->
    nock = new NockServer({host: 'https://foundation.symphony.com', startWithHelloWorldMessage: false})

  afterEach ->
    nock.close()

  it 'should send with no adornment', (done) ->
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      envelope = {room: nock.streamId}
      adapter.send(envelope, 'foo bar')
      adapter.close()
    nock.on 'received', () ->
      assert.isAtLeast((m for m in nock.messages when m.message is 'foo bar').length, 1)
      done()
    adapter.run()

  it 'should send MESSAGEML', (done) ->
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      envelope = {room: nock.streamId}
      adapter.send(envelope, {
        format: 'MESSAGEML'
        text: '<messageML><b>foo bar</b></messageML>'
      })
      adapter.close()
    nock.on 'received', () ->
      assert.isAtLeast((m for m in nock.messages when m.message is '<messageML><b>foo bar</b></messageML>').length, 1)
      done()
    adapter.run()

  it 'should reply with @mention', (done) ->
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      envelope = {
        room: nock.streamId
        user: {
          emailAddress: 'johndoe@symphony.com'
        }
      }
      adapter.reply(envelope, 'foo bar baz')
      adapter.close()
    nock.on 'received', () ->
      assert.isAtLeast((m for m in nock.messages when m.message is "<messageML><mention email=\"johndoe@symphony.com\"/> foo bar baz</messageML>").length, 1)
      done()
    adapter.run()

  it 'should escape xml chars in reply', (done) ->
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      envelope = {
        room: nock.streamId
        user: {
          emailAddress: 'johndoe@symphony.com'
        }
      }
      adapter.reply(envelope, '<&>')
      adapter.close()
    nock.on 'received', () ->
      assert.isAtLeast((m for m in nock.messages when m.message is "<messageML><mention email=\"johndoe@symphony.com\"/> &lt;&amp;&gt;</messageML>").length, 1)
      done()
    adapter.run()

  it 'should exit datafeed cannot be created', (done) ->
    nock.datafeedCreateHttp400Count = 1
    robot = new FakeRobot
    adapter = SymphonyAdapter.use robot, {
      shutdownFunc: -> done()
      failConnectAfter: 1
    }
    adapter.run()

  it 'should send direct message to username', (done) ->
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      adapter.sendDirectMessageToUsername(nock.realUserName, 'username message')
      adapter.close()
    nock.on 'received', () ->
      assert.isAtLeast((m for m in nock.messages when m.message is 'username message').length, 1)
      done()
    adapter.run()

  it 'should send direct message to email', (done) ->
    robot = new FakeRobot
    adapter = SymphonyAdapter.use(robot)
    adapter.on 'connected', () ->
      assert.isDefined(adapter.symphony)
      adapter.sendDirectMessageToEmail(nock.realUserEmail, 'email message')
      adapter.close()
    nock.on 'received', () ->
      assert.isAtLeast((m for m in nock.messages when m.message is 'email message').length, 1)
      done()
    adapter.run()

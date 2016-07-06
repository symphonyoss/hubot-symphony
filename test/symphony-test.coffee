util = require 'util'
assert = require('chai').assert
Symphony = require '../src/symphony'
NockServer = require './nock-server'

scope = new NockServer('https://foundation.symphony.com').scope

describe 'echo test', () ->
  it 'should obtain session and key tokens and echo response', () ->
    symphony = new Symphony('foundation.symphony.com', './test/resources/privateKey.pem', './test/resources/publicKey.pem')
    msg = { foo: 'bar' }
    symphony.echo(msg)
      .then (response) ->
        assert.deepEqual(msg, response)
      .fail (error) ->
        assert.fail(0, 1, util.format('Failed with error %s', error))
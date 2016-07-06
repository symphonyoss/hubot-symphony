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
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

assert = require('chai').assert
SymphonyAdapter = require '../src/adapter'

describe 'Adapter test suite', () ->
  constructorProps = ['HUBOT_SYMPHONY_HOST', 'HUBOT_SYMPHONY_PUBLIC_KEY', 'HUBOT_SYMPHONY_PRIVATE_KEY', 'HUBOT_SYMPHONY_PASSPHRASE']

  for constructorProp in constructorProps
    it "should throw on construction if #{constructorProp} missing", () ->
      process.env[propToSet] = 'foo' for propToSet in constructorProps.filter (p) -> p isnt constructorProp
      assert.throws(SymphonyAdapter.use, new RegExp("#{constructorProp} undefined"))
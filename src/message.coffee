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

{TextMessage, User} = require 'hubot'

class V2Message extends TextMessage

  constructor: (@user, @message) ->
    super new User(@message.fromUserId, {name: @user.userAttributes?.displayName, room: @message.streamId}), @_getMessageText(@message), @message.id

  _getMessageText: (message) ->
    match = /<messageML>(.*)<\/messageML>/i.exec message.message
    if match?
      match[1]
    else
      message.message

module.exports = {
  V2Message
}
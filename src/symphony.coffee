{Adapter, TextMessage, User} = require 'hubot'

class SymphonyAdapter extends Adapter

  constructor: ->
    super
    @robot.logger.info "Constructor"

  send: (envelope, strings...) ->
    @robot.logger.info "Send"

  reply: (envelope, strings...) ->
    @robot.logger.info "Reply"

  run: ->
    @robot.logger.info "Run"
    @emit "connected"
    user = new User 1001, name: 'Sample User'
    message = new TextMessage user, 'Some Sample Message', 'MSG-001'
    @robot.receive message


exports.use = (robot) ->
  new SymphonyAdapter robot
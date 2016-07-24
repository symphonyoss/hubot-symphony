# hubot-symphony

[Hubot](http://hubot.github.com/) adapter for [Symphony](https://symphony.com) developed by the [Symphony Foundation](http://symphony.foundation/)

[![Build Status](https://travis-ci.org/symphonyoss/hubot-symphony.svg?branch=master)](https://travis-ci.org/symphonyoss/hubot-symphony)
[![Coverage Status](https://coveralls.io/repos/github/symphonyoss/hubot-symphony/badge.svg?branch=master)](https://coveralls.io/github/symphonyoss/hubot-symphony)
[![Coverity Scan Build Status](https://scan.coverity.com/projects/9358/badge.svg)](https://scan.coverity.com/projects/symphonyoss-hubot-symphony)

### Diagnostics
A simple diagnostic script is included to help confirm that you have all the necessary pieces to get started.  You can run this as follows:

```
npm install hubot-symphony
npm run diagnostic -- --publicKey [key1.pem] --privateKey [key2.pem] --passphrase [changeit] --host [host.symphony.com]
```

If the script runs as expected it will obtain and log both session and key manager tokens, look up and log some details of the bot account and then create a datafeed and poll.  If you send a message using the Symphony client to the bot account you should see the details logged.

#### Note
The privateKey.pem and publicKey.pem files under test/resources have been generated at random and are not real keys.
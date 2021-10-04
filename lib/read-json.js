const {createReadStream} = require('fs')
const getStream = require('get-stream')
const JSONStream = require('JSONStream')
const gunzip = require('gunzip-maybe')

function readJson(filePath) {
  return getStream.array(
    createReadStream(filePath)
      .pipe(gunzip())
      .pipe(JSONStream.parse('features.*'))
  )
}

module.exports = readJson

var fs = require('fs')
var mkdirp = require('mkdirp')
var package = JSON.parse(fs.readFileSync(`package.json`, 'utf8'))
var testingPath = 'cdn/public/releases/testing'

console.log(`Copying testing files.`)
fs.copyFileSync('dist/tw2overflow.map', `${testingPath}/tw2overflow.map`)
fs.copyFileSync('dist/tw2overflow.js', `${testingPath}/tw2overflow.js`)
fs.copyFileSync('dist/tw2overflow.min.js', `${testingPath}/tw2overflow.min.js`)

console.log('Done.')

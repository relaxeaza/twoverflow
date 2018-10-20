var fs = require('fs')
var mkdirp = require('mkdirp')

var package = JSON.parse(fs.readFileSync(`package.json`, 'utf8'))

console.log(`Copying v${package.version} files to the host repository.`)

mkdirp.sync(`../host/${package.version}`)
fs.copyFileSync('dist/tw2overflow.map', `../host/${package.version}/tw2overflow.map`)
fs.copyFileSync('dist/tw2overflow.min.js', `../host/${package.version}/tw2overflow.min.js`)
fs.copyFileSync('dist/tw2overflow.map', `../host/latest/tw2overflow.map`)
fs.copyFileSync('dist/tw2overflow.min.js', `../host/latest/tw2overflow.min.js`)

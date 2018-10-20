var fs = require('fs')
var mkdirp = require('mkdirp')
var package = JSON.parse(fs.readFileSync(`package.json`, 'utf8'))
var releasesPath = 'cdn/public/releases'

console.log(`Creating directory ${releasesPath}/${package.version}`)
mkdirp.sync(`${releasesPath}/${package.version}`)

console.log(`Copying v${package.version} files.`)
fs.copyFileSync('dist/tw2overflow.map', `${releasesPath}/${package.version}/tw2overflow.map`)
fs.copyFileSync('dist/tw2overflow.js', `${releasesPath}/${package.version}/tw2overflow.js`)
fs.copyFileSync('dist/tw2overflow.min.js', `${releasesPath}/${package.version}/tw2overflow.min.js`)
fs.copyFileSync('dist/tw2overflow.map', `${releasesPath}/latest/tw2overflow.map`)
fs.copyFileSync('dist/tw2overflow.js', `${releasesPath}/latest/tw2overflow.js`)
fs.copyFileSync('dist/tw2overflow.min.js', `${releasesPath}/latest/tw2overflow.min.js`)

console.log('Done.')

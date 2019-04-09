require('http-server').createServer({
	root: '../dist/',
	https: {
		cert: './https/cert.pem',
		key: './https/key.pem'
	}
}).listen(2838)
console.log('https://127.0.0.1:2838/')

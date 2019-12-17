module.exports = function parseOptions () {
    let options = {}

    process.argv.slice(2).forEach(function (param) {
        const match = param.match(/--(\w+)(?:=(.+))?/)
        const name = match[1]
        let value = match[2] ? match[2] : true

        if (typeof value === 'string' && value.includes(',')) {
            value = value.split(',').filter(function (item) {
                return item !== ''
            })

            if (value.length === 1) {
                value = value[0]
            }
        }

        options[name] = value
    })

    return options
}

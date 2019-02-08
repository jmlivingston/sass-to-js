const fs = require('fs')
const os = require('os')
const path = require('path')
const rimraf = require('rimraf')

let bootstrapPath = path.join(__dirname, '../node_modules/bootstrap/scss')
bootstrapPath = path.join(__dirname, 'testscss')
const distPath = path.join(__dirname, '../dist')

const removeComments = (fileContents) => {
	const lines = fileContents.split(os.EOL)
	return lines.filter((line) => !line.trim().startsWith('//') && line.trim() !== '').join(os.EOL)
}

const parseVariable = (variable) => {
	variable = variable.trim()
	if ([ '*', '+' ].some((value) => variable.includes(value))) {
		return (
			variable
				.split(' ')
				.map((variable) => {
					return variable.includes('$') ? `variables['${variable}']` : variable
				})
				.join(' ') + ','
		)
	} else {
		return (
			`\`${variable
				.split(' ')
				.map((variable) => {
					return variable.includes('$')
						? `\${variables['${variable}']}`
						: variable.includes('{') ? ':{' : variable
				})
				.join(' ')}\`` + ','
		)
	}
}

// @each $color, $value in $theme-colors :{
//  '.alert-primary,': {
//    ...functions['alert-variant']({
//      ...functions['theme-color-level']('primary', variables['$alert-bg-level']),
//      ...functions['theme-color-level']('primary', variables['$alert-border-level']),
//      ...functions['theme-color-level']('primary', variables['$alert-color-level'])
//    })
//  }
// }

const getInnerFunction = (variable) => {
	if (variable.includes('(')) {
		const innerFunctions = variable
			.split(/,\s*(?![^()]*\))/g) // split commas not in parentheses
			.map((innerVariable) => getFunctions(innerVariable.trim()))
			.join(`${os.EOL}`)
		return `{${os.EOL}${innerFunctions}}`
	} else {
		return variable.split(',').map((innerVariable) => `variables['${innerVariable.trim()}']`).join(',')
	}
}

const getFunctions = (line) => {
	const lines = line.trim().split(/\((.+)/)
	const variable = lines[1].slice(0, -1)
	return `...functions['${lines[0]}'](${getInnerFunction(variable)}),`
}

const escapeDashes = (fileContents) => {
	return fileContents
		.split(os.EOL)
		.map((line) => {
			if (line.includes(':')) {
				// Variables
				const lines = line.split(':')
				return `'${lines[0].trim()}': ` + parseVariable(lines[1])
			} else if (line.includes('@include')) {
				// Functions
				return getFunctions(line.replace('@include', '').trim())
			} else {
				// Other
				return line
					.split(' ')
					.map((word) => (word.includes('.') ? `'${word.trim()}'` : word.includes('{') ? ':{' : word))
					.join(' ')
			}
		})
		.join(os.EOL)
}

const wrapCodeSaveFile = (name, fileContents) => {
	const code = `function ${name}({ variables, functions }) {
    const code = {
      ${fileContents}
    }
    return code
    }
    export default ${name}`
	fs.writeFileSync(path.join(distPath, 'sass.js'), code)
}

const processFile = (name) => {
	rimraf.sync(distPath)
	fs.mkdirSync(distPath)
	const filePath = path.join(bootstrapPath, `${name}.scss`)
	let fileContents = fs.readFileSync(filePath).toString()
	fileContents = fileContents.replace(/;/g, '')
	fileContents = fileContents.replace(/}/g, '},')
	fileContents = removeComments(fileContents)
	fileContents = escapeDashes(fileContents)
	wrapCodeSaveFile(name, fileContents)
}

processFile('_alert')

# Desc
End to end browser testing for Pixels project.

# Setup
- on project folder
- install dependency `npm install`
	- if doesn't work, try `npm install --dev`

# Run
- run test by `npm run test`
	- it will run command specified in `package.json`'s' `test`, which is `mocha` command.


`Mocha` is the test runner.
`Chai` is dependency for test syntax like `should` etc.
`Puppeteer` is browser automation tool. 
	- It can run headless (without UI, useful on a CI/VM environment) or with GUI, useful for local machine development.

The test files is within `test` folder. All file with `test.js` extension will be executed by `mocha`.
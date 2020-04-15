'use strict'
const { suite, test } = require('mocha')
const assert = require('assert')
const pkg = require('../package.json')

suite(pkg.name, () => {
  test('...', () => {
    assert(pkg.name)
  })
})

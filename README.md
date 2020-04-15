# A URL shortener as a GitHub Action

[![Test](https://github.com/wesleytodd/short/workflows/Test/badge.svg)](https://github.com/wesleytodd/short/actions?query=workflow%3Atest)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/standard/standard)

This action creates a `gh-pages` branch with a file for each shortened url.  Inspired by [@mylesborins tweet](https://twitter.com/MylesBorins/status/1108241556782370816):

> Today in OMG I can't believe you did that... I used HTML to "emulate" a URL shortener

When an issue which has a valid url is labled as `shorten`, a `gh-pages` commit will be made with the html redirect.  There are a few valid combinations:

1. [Title with URL](https://github.com/wesleytodd/short/issues/2)
1. [Title with URL & body with alias](https://github.com/wesleytodd/short/issues/5)
1. [URL in body](https://github.com/wesleytodd/short/issues/3)
1. [URL and alias in body, new line separated](https://github.com/wesleytodd/short/issues/4)

It might take a second for the GitHub Pages to rebuild, but once you have it you get an index page and a series of directories with `index.html`'s which contain
the meta refresh tag `<meta http-equiv="refresh" content="0;url=<URL>">`.

This was the first time in a while I just did a raondom code thing for fun, it feels good!

## Usage

```
name: URL Shortener
on:
  issues:
    types: [opened, labeled, unlabeled]

jobs:
  shorten:
    runs-on: ubuntu-latest
    steps:
    - uses: wesleytodd/short@v1
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
```

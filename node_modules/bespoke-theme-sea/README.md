[![Build Status](https://secure.travis-ci.org/frncsdrk/bespoke-theme-sea.png?branch=master)](https://travis-ci.org/frncsdrk/bespoke-theme-sea)

# bespoke-theme-sea

A theme as blue as the sea for [Bespoke.js](http://markdalgleish.com/projects/bespoke.js) &mdash; [View demo](http://frncsdrk.github.io/bespoke-theme-sea)

## Download

Download the [production version][min] or the [development version][max], or use a [package manager](#package-managers).

[min]: https://raw.github.com/frncsdrk/bespoke-theme-sea/master/dist/bespoke-theme-sea.min.js
[max]: https://raw.github.com/frncsdrk/bespoke-theme-sea/master/dist/bespoke-theme-sea.js

## Usage

This theme is shipped in a [UMD format](https://github.com/umdjs/umd), meaning that it is available as a CommonJS/AMD module or browser global.

For example, when using CommonJS modules:

```js
var bespoke = require('bespoke'),
  sea = require('bespoke-theme-sea');

bespoke.from('#presentation', [
  sea()
]);
```

When using browser globals:

```js
bespoke.from('#presentation', [
  bespoke.themes.sea()
]);
```

## Package managers

### npm

```bash
$ npm install bespoke-theme-sea
```

### Bower

```bash
$ bower install bespoke-theme-sea
```

## Credits

This theme was built with [generator-bespoketheme](https://github.com/markdalgleish/generator-bespoketheme).

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

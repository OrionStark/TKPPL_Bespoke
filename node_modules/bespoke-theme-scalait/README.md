[![Build Status](https://secure.travis-ci.org/rodrigo-tsuru/bespoke-theme-scalait.png?branch=master)](https://travis-ci.org/rodrigo-tsuru/bespoke-theme-scalait)

# bespoke-theme-scalait

Scala IT Solutions Theme &mdash; [View demo](http://rodrigo-tsuru.github.io/bespoke-theme-scalait)

## Download

Download the [production version][min] or the [development version][max], or use a [package manager](#package-managers).

[min]: https://raw.github.com/rodrigo-tsuru/bespoke-theme-scalait/master/dist/bespoke-theme-scalait.min.js
[max]: https://raw.github.com/rodrigo-tsuru/bespoke-theme-scalait/master/dist/bespoke-theme-scalait.js

## Usage

This theme is shipped in a [UMD format](https://github.com/umdjs/umd), meaning that it is available as a CommonJS/AMD module or browser global.

For example, when using CommonJS modules:

```js
var bespoke = require('bespoke'),
  scalait = require('bespoke-theme-scalait');

bespoke.from('#presentation', [
  scalait()
]);
```

When using browser globals:

```js
bespoke.from('#presentation', [
  bespoke.themes.scalait()
]);
```

## Package managers

### npm

```bash
$ npm install bespoke-theme-scalait
```

### Bower

```bash
$ bower install bespoke-theme-scalait
```

## Credits

This theme was built with [generator-bespoketheme](https://github.com/markdalgleish/generator-bespoketheme).

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

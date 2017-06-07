[![Build Status](https://secure.travis-ci.org/frncsdrk/bespoke-theme-carousel.png?branch=master)](https://travis-ci.org/frncsdrk/bespoke-theme-carousel)

# bespoke-theme-carousel

Carousel theme as seen on the demo page of bespoke.js &mdash; [View demo](http://frncsdrk.github.io/bespoke-theme-carousel)

## Download

Download the [production version][min] or the [development version][max], or use a [package manager](#package-managers).

[min]: https://raw.github.com/frncsdrk/bespoke-theme-carousel/master/dist/bespoke-theme-carousel.min.js
[max]: https://raw.github.com/frncsdrk/bespoke-theme-carousel/master/dist/bespoke-theme-carousel.js

## Usage

This theme is shipped in a [UMD format](https://github.com/umdjs/umd), meaning that it is available as a CommonJS/AMD module or browser global.

For example, when using CommonJS modules:

```js
var bespoke = require('bespoke'),
  carousel = require('bespoke-theme-carousel');

bespoke.from('#presentation', [
  carousel()
]);
```

When using browser globals:

```js
bespoke.from('#presentation', [
  bespoke.themes.carousel()
]);
```

## Package managers

### npm

```bash
$ npm install bespoke-theme-carousel
```

### Bower

```bash
$ bower install bespoke-theme-carousel
```

## Credits

This theme was built with [generator-bespoketheme](https://github.com/markdalgleish/generator-bespoketheme).

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

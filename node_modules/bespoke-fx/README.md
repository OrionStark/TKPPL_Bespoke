# bespoke-fx

New bespoke plugin compatible with latest bespoke.js

## Download

Download the [production version][min] or the [development version][max], or use a [package manager](#package-managers).

[min]: https://raw.github.com/developerworks/bespoke-fx/master/dist/bespoke-fx.min.js
[max]: https://raw.github.com/developerworks/bespoke-fx/master/dist/bespoke-fx.js

## Usage

This plugin is shipped in a [UMD format](https://github.com/umdjs/umd), meaning that it is available as a CommonJS/AMD module or browser global.

For example, when using CommonJS modules:

```js
var bespoke = require('bespoke'),
  fx = require('bespoke-fx');

bespoke.from('#presentation', [
  fx()
]);
```

When using browser globals:

```js
bespoke.from('#presentation', [
  bespoke.plugins.fx()
]);
```

## Package managers

### npm

```bash
$ npm install bespoke-fx
```

## Credits

This plugin was built with [generator-bespokeplugin](https://github.com/markdalgleish/generator-bespokeplugin).

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

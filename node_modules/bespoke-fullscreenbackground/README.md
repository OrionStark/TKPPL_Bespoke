[![Build Status](https://secure.travis-ci.org/sole/bespoke-fullscreenbackground.png?branch=master)](https://travis-ci.org/sole/bespoke-fullscreenbackground)

# bespoke-fullscreenbackground

fullscreen backgrounds for the slides

**NOTE:** I haven't written a test or anything, this is super alpha :-P

## Download

Download the [production version][min] or the [development version][max], or use a [package manager](#package-managers).

[min]: https://raw.github.com/sole/bespoke-fullscreenbackground/master/dist/bespoke-fullscreenbackground.min.js
[max]: https://raw.github.com/sole/bespoke-fullscreenbackground/master/dist/bespoke-fullscreenbackground.js

## Usage

First, include both `bespoke.js` and `bespoke-fullscreenbackground.js` in your page.

Then, simply include the plugin when instantiating your presentation.

```js
bespoke.from('article', {
  fullscreenbackground: true
});
```

When you specify a background image with the `data-bespoke-fullscreenbackground` attribute, the deck will take that image as background and the `cover` class will be added to its CSS class list.

Example with jade:

```jade
section(data-bespoke-fullscreenbackground='img/backgroundimage.jpg')
```

Add a `cover` class to your CSS file with something like this:

```css
.cover {
    background-position: center;
    background-size: cover;
}
```

## Package managers

### Bower

```bash
$ bower install bespoke-fullscreenbackground
```

### npm

```bash
$ npm install bespoke-fullscreenbackground
```

The bespoke-fullscreenbackground npm package is designed for use with [browserify](http://browserify.org/), e.g.

```js
require('bespoke');
require('bespoke-fullscreenbackground');
```

## Credits

This plugin was built with [generator-bespokeplugin](https://github.com/markdalgleish/generator-bespokeplugin).

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

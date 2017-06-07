var bespoke = require('bespoke'),
  carousel = require('../../../lib/bespoke-theme-carousel.js'),
  keys = require('bespoke-keys'),
  touch = require('bespoke-touch'),
  bullets = require('bespoke-bullets'),
  scale = require('bespoke-scale'),
  progress = require('bespoke-progress'),
  backdrop = require('bespoke-backdrop');

bespoke.from('article', [
  carousel(),
  keys(),
  touch(),
  bullets('li, .bullet'),
  scale('zoom'),
  progress(),
  backdrop()
]);

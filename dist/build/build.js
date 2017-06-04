(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){

/* **********************************************
     Begin prism-core.js
********************************************** */

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(\w+)\b/i;
var uniqueId = 0;

var _ = _self.Prism = {
	manual: _self.Prism && _self.Prism.manual,
	util: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
			} else if (_.util.type(tokens) === 'Array') {
				return tokens.map(_.util.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
		},

		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function (o) {
			var type = _.util.type(o);

			switch (type) {
				case 'Object':
					var clone = {};

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = _.util.clone(o[key]);
						}
					}

					return clone;

				case 'Array':
					// Check for existence for IE8
					return o.map && o.map(function(v) { return _.util.clone(v); });
			}

			return o;
		}
	},

	languages: {
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Insert a token before another token in a language literal
		 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
		 * we cannot just provide an object, we need anobject and a key.
		 * @param inside The key (or language id) of the parent
		 * @param before The key to insert before. If not provided, the function appends instead.
		 * @param insert Object with the key/value pairs to insert
		 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];

			if (arguments.length == 2) {
				insert = arguments[1];

				for (var newToken in insert) {
					if (insert.hasOwnProperty(newToken)) {
						grammar[newToken] = insert[newToken];
					}
				}

				return grammar;
			}

			var ret = {};

			for (var token in grammar) {

				if (grammar.hasOwnProperty(token)) {

					if (token == before) {

						for (var newToken in insert) {

							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					ret[token] = grammar[token];
				}
			}

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === root[inside] && key != inside) {
					this[key] = ret;
				}
			});

			return root[inside] = ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function(o, callback, type, visited) {
			visited = visited || {};
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					if (_.util.type(o[i]) === 'Object' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, null, visited);
					}
					else if (_.util.type(o[i]) === 'Array' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, i, visited);
					}
				}
			}
		}
	},
	plugins: {},

	highlightAll: function(async, callback) {
		var env = {
			callback: callback,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run("before-highlightall", env);

		var elements = env.elements || document.querySelectorAll(env.selector);

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;

		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}

		if (parent) {
			language = (parent.className.match(lang) || [,''])[1].toLowerCase();
			grammar = _.languages[language];
		}

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		// Set language on the parent, for styling
		parent = element.parentNode;

		if (/pre/i.test(parent.nodeName)) {
			parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		_.hooks.run('before-sanity-check', env);

		if (!env.code || !env.grammar) {
			if (env.code) {
				_.hooks.run('before-highlight', env);
				env.element.textContent = env.code;
				_.hooks.run('after-highlight', env);
			}
			_.hooks.run('complete', env);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				env.highlightedCode = evt.data;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(env.element);
				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			callback && callback.call(element);

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
		}
	},

	highlight: function (text, grammar, language) {
		var tokens = _.tokenize(text, grammar);
		return Token.stringify(_.util.encode(tokens), language);
	},

	matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
		var Token = _.Token;

		for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			if (token == target) {
				return;
			}

			var patterns = grammar[token];
			patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var pattern = patterns[j],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					greedy = !!pattern.greedy,
					lookbehindLength = 0,
					alias = pattern.alias;

				if (greedy && !pattern.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
					pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
				}

				pattern = pattern.pattern || pattern;

				// Don’t cache length as it changes during the loop
				for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					pattern.lastIndex = 0;

					var match = pattern.exec(str),
					    delNum = 1;

					// Greedy patterns can override/remove up to two previously matched tokens
					if (!match && greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						match = pattern.exec(text);
						if (!match) {
							break;
						}

						var from = match.index + (lookbehind ? match[1].length : 0),
						    to = match.index + match[0].length,
						    k = i,
						    p = pos;

						for (var len = strarr.length; k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy)); ++k) {
							p += strarr[k].length;
							// Move the index i to the element in strarr that is closest to from
							if (from >= p) {
								++i;
								pos = p;
							}
						}

						/*
						 * If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						 * If strarr[k - 1] is greedy we are in conflict with another greedy pattern
						 */
						if (strarr[i] instanceof Token || strarr[k - 1].greedy) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					}

					if (!match) {
						if (oneshot) {
							break;
						}

						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1].length;
					}

					var from = match.index + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    to = from + match.length,
					    before = str.slice(0, from),
					    after = str.slice(to);

					var args = [i, delNum];

					if (before) {
						++i;
						pos += before.length;
						args.push(before);
					}

					var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias, match, greedy);

					args.push(wrapped);

					if (after) {
						args.push(after);
					}

					Array.prototype.splice.apply(strarr, args);

					if (delNum != 1)
						_.matchGrammar(text, strarr, grammar, i, pos, true, token);

					if (oneshot)
						break;
				}
			}
		}
	},

	tokenize: function(text, grammar, language) {
		var strarr = [text];

		var rest = grammar.rest;

		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		_.matchGrammar(text, strarr, grammar, 0, 0, false);

		return strarr;
	},

	hooks: {
		all: {},

		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	}
};

var Token = _.Token = function(type, content, alias, matchedStr, greedy) {
	this.type = type;
	this.content = content;
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || "").length|0;
	this.greedy = !!greedy;
};

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (_.util.type(o) === 'Array') {
		return o.map(function(element) {
			return Token.stringify(element, language, o);
		}).join('');
	}

	var env = {
		type: o.type,
		content: Token.stringify(o.content, language, parent),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language,
		parent: parent
	};

	if (env.type == 'comment') {
		env.attributes['spellcheck'] = 'true';
	}

	if (o.alias) {
		var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
		Array.prototype.push.apply(env.classes, aliases);
	}

	_.hooks.run('wrap', env);

	var attributes = Object.keys(env.attributes).map(function(name) {
		return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}).join(' ');

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';

};

if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _self.Prism;
	}
 	// In worker
	_self.addEventListener('message', function(evt) {
		var message = JSON.parse(evt.data),
		    lang = message.language,
		    code = message.code,
		    immediateClose = message.immediateClose;

		_self.postMessage(_.highlight(code, _.languages[lang], lang));
		if (immediateClose) {
			_self.close();
		}
	}, false);

	return _self.Prism;
}

//Get current script and highlight
var script = document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

if (script) {
	_.filename = script.src;

	if (document.addEventListener && !_.manual && !script.hasAttribute('data-manual')) {
		if(document.readyState !== "loading") {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(_.highlightAll);
			} else {
				window.setTimeout(_.highlightAll, 16);
			}
		}
		else {
			document.addEventListener('DOMContentLoaded', _.highlightAll);
		}
	}
}

return _self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\s\S]*?-->/,
	'prolog': /<\?[\s\S]+?\?>/,
	'doctype': /<!DOCTYPE[\s\S]+?>/i,
	'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\\1|\\?(?!\1)[\s\S])*\1|[^\s'">=]+))?)*\s*\/?>/i,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=(?:('|")[\s\S]*?(\1)|[^\s>]+)/i,
				inside: {
					'punctuation': /[=>"']/
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': /&#?[\da-z]{1,8};/i
};

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Prism.languages.xml = Prism.languages.markup;
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;


/* **********************************************
     Begin prism-css.js
********************************************** */

Prism.languages.css = {
	'comment': /\/\*[\s\S]*?\*\//,
	'atrule': {
		pattern: /@[\w-]+?.*?(;|(?=\s*\{))/i,
		inside: {
			'rule': /@[\w-]+/
			// See rest below
		}
	},
	'url': /url\((?:(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
	'selector': /[^\{\}\s][^\{\};]*?(?=\s*\{)/,
	'string': {
		pattern: /("|')(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'property': /(\b|\B)[\w-]+(?=\s*:)/i,
	'important': /\B!important\b/i,
	'function': /[-a-z0-9]+(?=\()/i,
	'punctuation': /[(){};:]/
};

Prism.languages.css['atrule'].inside.rest = Prism.util.clone(Prism.languages.css);

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'style': {
			pattern: /(<style[\s\S]*?>)[\s\S]*?(?=<\/style>)/i,
			lookbehind: true,
			inside: Prism.languages.css,
			alias: 'language-css'
		}
	});
	
	Prism.languages.insertBefore('inside', 'attr-value', {
		'style-attr': {
			pattern: /\s*style=("|').*?\1/i,
			inside: {
				'attr-name': {
					pattern: /^\s*style/i,
					inside: Prism.languages.markup.tag.inside
				},
				'punctuation': /^\s*=\s*['"]|['"]\s*$/,
				'attr-value': {
					pattern: /.+/i,
					inside: Prism.languages.css
				}
			},
			alias: 'language-css'
		}
	}, Prism.languages.markup.tag);
}

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true
		}
	],
	'string': {
		pattern: /(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[a-z0-9_\.\\]+/i,
		lookbehind: true,
		inside: {
			punctuation: /(\.|\\)/
		}
	},
	'keyword': /\b(if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(true|false)\b/,
	'function': /[a-z0-9_]+(?=\()/i,
	'number': /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)\b/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'keyword': /\b(as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
	'number': /\b-?(0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d*\.?\d+([Ee][+-]?\d+)?|NaN|Infinity)\b/,
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*(?=\()/i,
	'operator': /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
});

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\\\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
		lookbehind: true,
		greedy: true
	}
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\\\|\\?[^\\])*?`/,
		greedy: true,
		inside: {
			'interpolation': {
				pattern: /\$\{[^}]+\}/,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'script': {
			pattern: /(<script[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript,
			alias: 'language-javascript'
		}
	});
}

Prism.languages.js = Prism.languages.javascript;

/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	self.Prism.fileHighlight = function() {

		var Extensions = {
			'js': 'javascript',
			'py': 'python',
			'rb': 'ruby',
			'ps1': 'powershell',
			'psm1': 'powershell',
			'sh': 'bash',
			'bat': 'batch',
			'h': 'c',
			'tex': 'latex'
		};

		if(Array.prototype.forEach) { // Check to prevent error in IE8
			Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function (pre) {
				var src = pre.getAttribute('data-src');

				var language, parent = pre;
				var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;
				while (parent && !lang.test(parent.className)) {
					parent = parent.parentNode;
				}

				if (parent) {
					language = (pre.className.match(lang) || [, ''])[1];
				}

				if (!language) {
					var extension = (src.match(/\.(\w+)$/) || [, ''])[1];
					language = Extensions[extension] || extension;
				}

				var code = document.createElement('code');
				code.className = 'language-' + language;

				pre.textContent = '';

				code.textContent = 'Loading…';

				pre.appendChild(code);

				var xhr = new XMLHttpRequest();

				xhr.open('GET', src, true);

				xhr.onreadystatechange = function () {
					if (xhr.readyState == 4) {

						if (xhr.status < 400 && xhr.responseText) {
							code.textContent = xhr.responseText;

							Prism.highlightElement(code);
						}
						else if (xhr.status >= 400) {
							code.textContent = '✖ Error ' + xhr.status + ' while fetching file: ' + xhr.statusText;
						}
						else {
							code.textContent = '✖ Error: File does not exist or is empty';
						}
					}
				};

				xhr.send(null);
			});
		}

	};

	document.addEventListener('DOMContentLoaded', self.Prism.fileHighlight);

})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    var backdrops;

    function createBackdropForSlide(slide) {
      var backdropAttribute = slide.getAttribute('data-bespoke-backdrop');

      if (backdropAttribute) {
        var backdrop = document.createElement('div');
        backdrop.className = backdropAttribute;
        backdrop.classList.add('bespoke-backdrop');
        deck.parent.appendChild(backdrop);
        return backdrop;
      }
    }

    function updateClasses(el) {
      if (el) {
        var index = backdrops.indexOf(el),
          currentIndex = deck.slide();

        removeClass(el, 'active');
        removeClass(el, 'inactive');
        removeClass(el, 'before');
        removeClass(el, 'after');

        if (index !== currentIndex) {
          addClass(el, 'inactive');
          addClass(el, index < currentIndex ? 'before' : 'after');
        } else {
          addClass(el, 'active');
        }
      }
    }

    function removeClass(el, className) {
      el.classList.remove('bespoke-backdrop-' + className);
    }

    function addClass(el, className) {
      el.classList.add('bespoke-backdrop-' + className);
    }

    backdrops = deck.slides
      .map(createBackdropForSlide);

    deck.on('activate', function() {
      backdrops.forEach(updateClasses);
    });
  };
};

},{}],3:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var activeSlideIndex,
      activeBulletIndex,

      bullets = deck.slides.map(function(slide) {
        return [].slice.call(slide.querySelectorAll((typeof options === 'string' ? options : '[data-bespoke-bullet]')), 0);
      }),

      next = function() {
        var nextSlideIndex = activeSlideIndex + 1;

        if (activeSlideHasBulletByOffset(1)) {
          activateBullet(activeSlideIndex, activeBulletIndex + 1);
          return false;
        } else if (bullets[nextSlideIndex]) {
          activateBullet(nextSlideIndex, 0);
        }
      },

      prev = function() {
        var prevSlideIndex = activeSlideIndex - 1;

        if (activeSlideHasBulletByOffset(-1)) {
          activateBullet(activeSlideIndex, activeBulletIndex - 1);
          return false;
        } else if (bullets[prevSlideIndex]) {
          activateBullet(prevSlideIndex, bullets[prevSlideIndex].length - 1);
        }
      },

      activateBullet = function(slideIndex, bulletIndex) {
        activeSlideIndex = slideIndex;
        activeBulletIndex = bulletIndex;

        bullets.forEach(function(slide, s) {
          slide.forEach(function(bullet, b) {
            bullet.classList.add('bespoke-bullet');

            if (s < slideIndex || s === slideIndex && b <= bulletIndex) {
              bullet.classList.add('bespoke-bullet-active');
              bullet.classList.remove('bespoke-bullet-inactive');
            } else {
              bullet.classList.add('bespoke-bullet-inactive');
              bullet.classList.remove('bespoke-bullet-active');
            }

            if (s === slideIndex && b === bulletIndex) {
              bullet.classList.add('bespoke-bullet-current');
            } else {
              bullet.classList.remove('bespoke-bullet-current');
            }
          });
        });
      },

      activeSlideHasBulletByOffset = function(offset) {
        return bullets[activeSlideIndex][activeBulletIndex + offset] !== undefined;
      };

    deck.on('next', next);
    deck.on('prev', prev);

    deck.on('slide', function(e) {
      activateBullet(e.index, 0);
    });

    activateBullet(0, 0);
  };
};

},{}],4:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    deck.slides.forEach(function(slide) {
      slide.addEventListener('keydown', function(e) {
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.nodeName) || e.target.contentEditable === 'true') {
          e.stopPropagation();
        }
      });
    });
  };
};

},{}],5:[function(require,module,exports){
module.exports = function (options) {
  return function (deck) {
    var options = options === undefined ? {} : options;

    var direction = options.direction === undefined || options.direction === null ? 'horizontal' : options.direction;
    var default_axis = direction === 'vertical' ? 'Y' : 'X';
    var transition = options.transition ? options.transition : 'move';
    var reverse = options.reverse ? options.reverse : false;
    var plugin = {
      fx: {
        'move': {
          'X': {
            'next': 'move-to-left-from-right',
            'prev': 'move-to-right-from-left'
          },
          'Y': {
            'next': 'move-to-top-from-bottom',
            'prev': 'move-to-bottom-from-top'
          }
        },
        'move-fade': {
          'X': {
            'next': 'fade-from-right',
            'prev': 'fade-from-left'
          },
          'Y': {
            'next': 'fade-from-bottom',
            'prev': 'fade-from-top'
          }
        },
        'move-both-fade': {
          'X': {
            'next': 'fade-left-fade-right',
            'prev': 'fade-right-fade-left'
          },
          'Y': {
            'next': 'fade-top-fade-bottom',
            'prev': 'fade-bottom-fade-top'
          }
        },
        'move-different-easing': {
          'X': {
            'next': 'different-easing-from-right',
            'prev': 'different-easing-from-left'
          },
          'Y': {
            'next': 'different-easing-from-bottom',
            'prev': 'different-easing-from-top'
          }
        },
        'scale-down-out-move-in': {
          'X': {
            'next': 'scale-down-from-right',
            'prev': 'move-to-right-scale-up'
          },
          'Y': {
            'next': 'scale-down-from-bottom',
            'prev': 'move-to-bottom-scale-up'
          }
        },
        'move-out-scale-up': {
          'X': {
            'next': 'move-to-left-scale-up',
            'prev': 'scale-down-from-left'
          },
          'Y': {
            'next': 'move-to-top-scale-up',
            'prev': 'scale-down-from-top'
          }
        },
        'scale-up-up': {
          'X': {
            'next': 'scale-up-scale-up',
            'prev': 'scale-down-scale-down'
          },
          'Y': {
            'next': 'scale-up-scale-up',
            'prev': 'scale-down-scale-down'
          }
        },
        'scale-down-up': {
          'X': {
            'next': 'scale-down-scale-up',
            'prev': 'scale-down-scale-up'
          },
          'Y': {
            'next': 'scale-down-scale-up',
            'prev': 'scale-down-scale-up'
          }
        },
        'glue': {
          'X': {
            'next': 'glue-left-from-right',
            'prev': 'glue-right-from-left'
          },
          'Y': {
            'next': 'glue-top-from-bottom',
            'prev': 'glue-bottom-from-top'
          }
        },
        'flip': {
          'X': {
            'next': 'flip-left',
            'prev': 'flip-right'
          },
          'Y': {
            'next': 'flip-top',
            'prev': 'flip-bottom'
          }
        },
        'fall': {
          'X': {
            'next': 'fall',
            'prev': 'fall'
          },
          'Y': {
            'next': 'fall',
            'prev': 'fall'
          }
        },
        'newspaper': {
          'X': {
            'next': 'newspaper',
            'prev': 'newspaper'
          },
          'Y': {
            'next': 'newspaper',
            'prev': 'newspaper'
          }
        },
        'push': {
          'X': {
            'next': 'push-left-from-right',
            'prev': 'push-right-from-left'
          },
          'Y': {
            'next': 'push-top-from-bottom',
            'prev': 'push-bottom-from-top'
          }
        },
        'pull': {
          'X': {
            'next': 'push-left-pull-right',
            'prev': 'push-right-pull-left'
          },
          'Y': {
            'next': 'push-bottom-pull-top',
            'prev': 'push-top-pull-bottom'
          }
        },
        'fold': {
          'X': {
            'next': 'fold-left-from-right',
            'prev': 'move-to-right-unfold-left'
          },
          'Y': {
            'next': 'fold-bottom-from-top',
            'prev': 'move-to-top-unfold-bottom'
          }
        },
        'unfold': {
          'X': {
            'next': 'move-to-left-unfold-right',
            'prev': 'fold-right-from-left'
          },
          'Y': {
            'next': 'move-to-bottom-unfold-top',
            'prev': 'fold-top-from-bottom'
          }
        },
        'room': {
          'X': {
            'next': 'room-to-left',
            'prev': 'room-to-right'
          },
          'Y': {
            'next': 'room-to-bottom',
            'prev': 'room-to-top'
          }
        },
        'cube': {
          'X': {
            'next': 'cube-to-left',
            'prev': 'cube-to-right'
          },
          'Y': {
            'next': 'cube-to-bottom',
            'prev': 'cube-to-top'
          }
        },
        'carousel': {
          'X': {
            'next': 'carousel-to-left',
            'prev': 'carousel-to-right'
          },
          'Y': {
            'next': 'carousel-to-bottom',
            'prev': 'carousel-to-top'
          }
        },
        'sides': {
          'X': {
            'next': 'sides',
            'prev': 'sides'
          },
          'Y': {
            'next': 'sides',
            'prev': 'sides'
          }
        },
        'slide': {
          'X': {
            'next': 'slide',
            'prev': 'slide'
          },
          'Y': {
            'next': 'slide',
            'prev': 'slide'
          }
        }
      },
      animations: {
        // Move
        'move-to-left-from-right': {
          id: 1,
          group: 'move',
          label: 'Move to left / from right',
          outClass: 'fx-slide-moveToLeft',
          inClass: 'fx-slide-moveFromRight',
          reverse: 'move-to-right-from-left'
        },
        'move-to-right-from-left': {
          id: 2,
          group: 'move',
          label: 'Move to right / from left',
          outClass: 'fx-slide-moveToRight',
          inClass: 'fx-slide-moveFromLeft',
          reverse: 'move-to-left-from-right'
        },
        'move-to-top-from-bottom': {
          id: 3,
          group: 'move',
          label: 'Move to top / from bottom',
          outClass: 'fx-slide-moveToTop',
          inClass: 'fx-slide-moveFromBottom',
          reverse: 'move-to-bottom-from-top'
        },
        'move-to-bottom-from-top': {
          id: 4,
          group: 'move',
          label: 'Move to bottom / from top',
          outClass: 'fx-slide-moveToBottom',
          inClass: 'fx-slide-moveFromTop',
          reverse: 'move-to-top-from-bottom'
        },

        // Fade
        'fade-from-right': {
          id: 5,
          group: 'fade',
          label: 'Fade / from right',
          outClass: 'fx-slide-fade',
          inClass: 'fx-slide-moveFromRight fx-slide-ontop',
          reverse: 'fade-from-left'
        },
        'fade-from-left': {
          id: 6,
          group: 'fade',
          label: 'Fade / from left',
          outClass: 'fx-slide-fade',
          inClass: 'fx-slide-moveFromLeft fx-slide-ontop',
          reverse: 'fade-from-right'
        },
        'fade-from-bottom': {
          id: 7,
          group: 'fade',
          label: 'Fade / from bottom',
          outClass: 'fx-slide-fade',
          inClass: 'fx-slide-moveFromBottom fx-slide-ontop',
          reverse: 'fade-from-top'
        },
        'fade-from-top': {
          id: 8,
          group: 'fade',
          label: 'Fade / from top',
          outClass: 'fx-slide-fade',
          inClass: 'fx-slide-moveFromTop fx-slide-ontop',
          reverse: 'fade-from-bottom'
        },
        'fade-left-fade-right': {
          id: 9,
          group: 'fade',
          label: 'Fade left / Fade right',
          outClass: 'fx-slide-moveToLeftFade',
          inClass: 'fx-slide-moveFromRightFade',
          reverse: 'fade-right-fade-left'
        },
        'fade-right-fade-left': {
          id: 10,
          group: 'fade',
          label: 'Fade right / Fade left',
          outClass: 'fx-slide-moveToRightFade',
          inClass: 'fx-slide-moveFromLeftFade',
          reverse: 'fade-left-fade-right'
        },
        'fade-top-fade-bottom': {
          id: 11,
          group: 'fade',
          label: 'Fade top / Fade bottom',
          outClass: 'fx-slide-moveToTopFade',
          inClass: 'fx-slide-moveFromBottomFade',
          reverse: 'fade-bottom-fade-top'
        },
        'fade-bottom-fade-top': {
          id: 12,
          group: 'fade',
          label: 'Fade bottom / Fade top',
          outClass: 'fx-slide-moveToBottomFade',
          inClass: 'fx-slide-moveFromTopFade',
          reverse: 'fade-top-fade-bottom'
        },

        // Different easing
        'different-easing-from-right': {
          id: 13,
          group: 'different-easing',
          label: 'Different easing / from right',
          outClass: 'fx-slide-moveToLeftEasing fx-slide-ontop',
          inClass: 'fx-slide-moveFromRight',
          reverse: 'different-easing-from-left'
        },
        'different-easing-from-left': {
          id: 14,
          group: 'different-easing',
          label: 'Different easing / from left',
          outClass: 'fx-slide-moveToRightEasing fx-slide-ontop',
          inClass: 'fx-slide-moveFromLeft',
          reverse: 'different-easing-from-right'
        },
        'different-easing-from-bottom': {
          id: 15,
          group: 'different-easing',
          label: 'Different easing / from bottom',
          outClass: 'fx-slide-moveToTopEasing fx-slide-ontop',
          inClass: 'fx-slide-moveFromBottom',
          reverse: 'different-easing-from-top'
        },
        'different-easing-from-top': {
          id: 16,
          group: 'different-easing',
          label: 'Different easing / from top',
          outClass: 'fx-slide-moveToBottomEasing fx-slide-ontop',
          inClass: 'fx-slide-moveFromTop',
          reverse: 'different-easing-from-bottom'
        },

        // Scale
        'scale-down-from-right': {
          id: 17,
          group: 'scale',
          label: 'Scale down / from right',
          outClass: 'fx-slide-scaleDown',
          inClass: 'fx-slide-moveFromRight fx-slide-ontop',
          reverse: 'move-to-right-scale-up'
        },
        'scale-down-from-left': {
          id: 18,
          group: 'scale',
          label: 'Scale down / from left',
          outClass: 'fx-slide-scaleDown',
          inClass: 'fx-slide-moveFromLeft fx-slide-ontop',
          reverse: 'move-to-left-scale-up'
        },
        'scale-down-from-bottom': {
          id: 19,
          group: 'scale',
          label: 'Scale down / from bottom',
          outClass: 'fx-slide-scaleDown',
          inClass: 'fx-slide-moveFromBottom fx-slide-ontop',
          reverse: 'move-to-bottom-scale-up'
        },
        'scale-down-from-top': {
          id: 20,
          group: 'scale',
          label: 'Scale down / from top',
          outClass: 'fx-slide-scaleDown',
          inClass: 'fx-slide-moveFromTop fx-slide-ontop',
          reverse: 'move-to-top-scale-up'
        },
        'scale-down-scale-down': {
          id: 21,
          group: 'scale',
          label: 'Scale down / scale down',
          outClass: 'fx-slide-scaleDown',
          inClass: 'fx-slide-scaleUpDown fx-slide-delay300',
          reverse: 'scale-up-scale-up'
        },
        'scale-up-scale-up': {
          id: 22,
          group: 'scale',
          label: 'Scale up / scale up',
          outClass: 'fx-slide-scaleDownUp',
          inClass: 'fx-slide-scaleUp fx-slide-delay300',
          reverse: 'scale-down-scale-down'
        },
        'move-to-left-scale-up': {
          id: 23,
          group: 'scale',
          label: 'Move to left / scale up',
          outClass: 'fx-slide-moveToLeft fx-slide-ontop',
          inClass: 'fx-slide-scaleUp',
          reverse: 'scale-down-from-left'
        },
        'move-to-right-scale-up': {
          id: 24,
          group: 'scale',
          label: 'Move to right / scale up',
          outClass: 'fx-slide-moveToRight fx-slide-ontop',
          inClass: 'fx-slide-scaleUp',
          reverse: 'scale-down-from-right'
        },
        'move-to-top-scale-up': {
          id: 25,
          group: 'scale',
          label: 'Move to top / scale up',
          outClass: 'fx-slide-moveToTop fx-slide-ontop',
          inClass: 'fx-slide-scaleUp',
          reverse: 'scale-down-from-top'
        },
        'move-to-bottom-scale-up': {
          id: 26,
          group: 'scale',
          label: 'Move to bottom / scale up',
          outClass: 'fx-slide-moveToBottom fx-slide-ontop',
          inClass: 'fx-slide-scaleUp',
          reverse: 'scale-down-from-bottom'
        },
        'scale-down-scale-up': {
          id: 27,
          group: 'scale',
          label: 'Scale down / scale up',
          outClass: 'fx-slide-scaleDownCenter',
          inClass: 'fx-slide-scaleUpCenter fx-slide-delay400',
          reverse: 'scale-down-scale-up'
        },

        // Rotate: Glue
        'glue-left-from-right': {
          id: 28,
          group: 'rotate:glue',
          label: 'Glue left / from right',
          outClass: 'fx-slide-rotateRightSideFirst',
          inClass: 'fx-slide-moveFromRight fx-slide-delay200 fx-slide-ontop',
          reverse: 'glue-right-from-left'
        },
        'glue-right-from-left': {
          id: 29,
          group: 'rotate:glue',
          label: 'Glue right / from left',
          outClass: 'fx-slide-rotateLeftSideFirst',
          inClass: 'fx-slide-moveFromLeft fx-slide-delay200 fx-slide-ontop',
          reverse: 'glue-left-from-right'
        },
        'glue-bottom-from-top': {
          id: 30,
          group: 'rotate:glue',
          label: 'Glue bottom / from top',
          outClass: 'fx-slide-rotateTopSideFirst',
          inClass: 'fx-slide-moveFromTop fx-slide-delay200 fx-slide-ontop',
          reverse: 'glue-top-from-bottom'
        },
        'glue-top-from-bottom': {
          id: 31,
          group: 'rotate:glue',
          label: 'Glue top / from bottom',
          outClass: 'fx-slide-rotateBottomSideFirst',
          inClass: 'fx-slide-moveFromBottom fx-slide-delay200 fx-slide-ontop',
          reverse: 'glue-bottom-from-top'
        },

        // Rotate: Flip
        'flip-right': {
          id: 32,
          group: 'rotate:flip',
          label: 'Flip right',
          outClass: 'fx-slide-flipOutRight',
          inClass: 'fx-slide-flipInLeft fx-slide-delay500',
          reverse: 'flip-left'
        },
        'flip-left': {
          id: 33,
          group: 'rotate:flip',
          label: 'Flip left',
          outClass: 'fx-slide-flipOutLeft',
          inClass: 'fx-slide-flipInRight fx-slide-delay500',
          reverse: 'flip-right'
        },
        'flip-top': {
          id: 34,
          group: 'rotate:flip',
          label: 'Flip top',
          outClass: 'fx-slide-flipOutTop',
          inClass: 'fx-slide-flipInBottom fx-slide-delay500',
          reverse: 'flip-bottom'
        },
        'flip-bottom': {
          id: 35,
          group: 'rotate:flip',
          label: 'Flip bottom',
          outClass: 'fx-slide-flipOutBottom',
          inClass: 'fx-slide-flipInTop fx-slide-delay500',
          reverse: 'flip-top'
        },
        'fall': {
          id: 36,
          group: 'rotate',
          label: 'Fall',
          outClass: 'fx-slide-rotateFall fx-slide-ontop',
          inClass: 'fx-slide-scaleUp',
          reverse: 'fall'
        },
        'newspaper': {
          id: 37,
          group: 'rotate',
          label: 'Newspaper',
          outClass: 'fx-slide-rotateOutNewspaper',
          inClass: 'fx-slide-rotateInNewspaper fx-slide-delay500',
          reverse: 'newspaper'
        },

        // Push / Pull
        'push-left-from-right': {
          id: 38,
          group: 'rotate:push-pull',
          label: 'Push left / from right',
          outClass: 'fx-slide-rotatePushLeft',
          inClass: 'fx-slide-moveFromRight',
          reverse: 'push-right-from-left'
        },
        'push-right-from-left': {
          id: 39,
          group: 'rotate:push-pull',
          label: 'Push right / from left',
          outClass: 'fx-slide-rotatePushRight',
          inClass: 'fx-slide-moveFromLeft',
          reverse: 'push-left-from-right'
        },
        'push-top-from-bottom': {
          id: 40,
          group: 'rotate:push-pull',
          label: 'Push top / from bottom',
          outClass: 'fx-slide-rotatePushTop',
          inClass: 'fx-slide-moveFromBottom',
          reverse: 'push-bottom-from-top'
        },
        'push-bottom-from-top': {
          id: 41,
          group: 'rotate:push-pull',
          label: 'Push bottom / from top',
          outClass: 'fx-slide-rotatePushBottom',
          inClass: 'fx-slide-moveFromTop',
          reverse: 'push-top-from-bottom'
        },
        'push-left-pull-right': {
          id: 42,
          group: 'rotate:push-pull',
          label: 'Push left / pull right',
          outClass: 'fx-slide-rotatePushLeft',
          inClass: 'fx-slide-rotatePullRight fx-slide-delay180',
          reverse: 'push-right-pull-left'
        },
        'push-right-pull-left': {
          id: 43,
          group: 'rotate:push-pull',
          label: 'Push right / pull left',
          outClass: 'fx-slide-rotatePushRight',
          inClass: 'fx-slide-rotatePullLeft fx-slide-delay180',
          reverse: 'push-left-pull-right'
        },
        'push-top-pull-bottom': {
          id: 44,
          group: 'rotate:push-pull',
          label: 'Push top / pull bottom',
          outClass: 'fx-slide-rotatePushTop',
          inClass: 'fx-slide-rotatePullBottom fx-slide-delay180',
          reverse: 'push-bottom-pull-top'
        },
        'push-bottom-pull-top': {
          id: 45,
          group: 'rotate:push-pull',
          label: 'Push bottom / pull top',
          outClass: 'fx-slide-rotatePushBottom',
          inClass: 'fx-slide-rotatePullTop fx-slide-delay180',
          reverse: 'push-top-pull-bottom'
        },

        // Fold / Unfold
        'fold-left-from-right': {
          id: 46,
          group: 'rotate:fold-unfold',
          label: 'Fold left / from right',
          outClass: 'fx-slide-rotateFoldLeft',
          inClass: 'fx-slide-moveFromRightFade',
          reverse: 'move-to-right-unfold-left'
        },
        'fold-right-from-left': {
          id: 47,
          group: 'rotate:fold-unfold',
          label: 'Fold right / from left',
          outClass: 'fx-slide-rotateFoldRight',
          inClass: 'fx-slide-moveFromLeftFade',
          reverse: 'move-to-left-unfold-right'
        },
        'fold-top-from-bottom': {
          id: 48,
          group: 'rotate:fold-unfold',
          label: 'Fold top / from bottom',
          outClass: 'fx-slide-rotateFoldTop',
          inClass: 'fx-slide-moveFromBottomFade',
          reverse: 'move-to-bottom-unfold-top'
        },
        'fold-bottom-from-top': {
          id: 49,
          group: 'rotate:fold-unfold',
          label: 'Fold bottom / from top',
          outClass: 'fx-slide-rotateFoldBottom',
          inClass: 'fx-slide-moveFromTopFade',
          reverse: 'move-to-top-unfold-bottom'
        },
        'move-to-right-unfold-left': {
          id: 50,
          group: 'rotate:fold-unfold',
          label: 'Move to right / unfold left',
          outClass: 'fx-slide-moveToRightFade',
          inClass: 'fx-slide-rotateUnfoldLeft',
          reverse: 'fold-left-from-right'
        },
        'move-to-left-unfold-right': {
          id: 51,
          group: 'rotate:fold-unfold',
          label: 'Move to left / unfold right',
          outClass: 'fx-slide-moveToLeftFade',
          inClass: 'fx-slide-rotateUnfoldRight',
          reverse: 'fold-right-from-left'
        },
        'move-to-bottom-unfold-top': {
          id: 52,
          group: 'rotate:fold-unfold',
          label: 'Move to bottom / unfold top',
          outClass: 'fx-slide-moveToBottomFade',
          inClass: 'fx-slide-rotateUnfoldTop',
          reverse: 'fold-top-from-bottom'
        },
        'move-to-top-unfold-bottom': {
          id: 53,
          group: 'rotate:fold-unfold',
          label: 'Move to top / unfold bottom',
          outClass: 'fx-slide-moveToTopFade',
          inClass: 'fx-slide-rotateUnfoldBottom',
          reverse: 'fold-bottom-from-top'
        },

        // Room
        'room-to-left': {
          id: 54,
          group: 'rotate:room',
          label: 'Room to left',
          outClass: 'fx-slide-rotateRoomLeftOut fx-slide-ontop',
          inClass: 'fx-slide-rotateRoomLeftIn',
          reverse: 'room-to-right'
        },
        'room-to-right': {
          id: 55,
          group: 'rotate:room',
          label: 'Room to right',
          outClass: 'fx-slide-rotateRoomRightOut fx-slide-ontop',
          inClass: 'fx-slide-rotateRoomRightIn',
          reverse: 'room-to-left'
        },
        'room-to-top': {
          id: 56,
          group: 'rotate:room',
          label: 'Room to top',
          outClass: 'fx-slide-rotateRoomTopOut fx-slide-ontop',
          inClass: 'fx-slide-rotateRoomTopIn',
          reverse: 'room-to-bottom'
        },
        'room-to-bottom': {
          id: 57,
          group: 'rotate:room',
          label: 'Room to bottom',
          outClass: 'fx-slide-rotateRoomBottomOut fx-slide-ontop',
          inClass: 'fx-slide-rotateRoomBottomIn',
          reverse: 'room-to-top'
        },

        // Cube
        'cube-to-left': {
          id: 58,
          label: 'Cube to left',
          outClass: 'fx-slide-rotateCubeLeftOut fx-slide-ontop',
          inClass: 'fx-slide-rotateCubeLeftIn',
          reverse: 'cube-to-right'
        },
        'cube-to-right': {
          id: 59,
          label: 'Cube to right',
          outClass: 'fx-slide-rotateCubeRightOut fx-slide-ontop',
          inClass: 'fx-slide-rotateCubeRightIn',
          reverse: 'cube-to-left'
        },
        'cube-to-top': {
          id: 60,
          label: 'Cube to top',
          outClass: 'fx-slide-rotateCubeTopOut fx-slide-ontop',
          inClass: 'fx-slide-rotateCubeTopIn',
          reverse: 'cube-to-bottom'
        },
        'cube-to-bottom': {
          id: 61,
          label: 'Cube to bottom',
          outClass: 'fx-slide-rotateCubeBottomOut fx-slide-ontop',
          inClass: 'fx-slide-rotateCubeBottomIn',
          reverse: 'cube-to-top'
        },

        // Carousel
        'carousel-to-left': {
          id: 62,
          group: 'rotate:carousel',
          label: 'Carousel to left',
          outClass: 'fx-slide-rotateCarouselLeftOut fx-slide-ontop',
          inClass: 'fx-slide-rotateCarouselLeftIn',
          reverse: 'carousel-to-right'
        },
        'carousel-to-right': {
          id: 63,
          group: 'rotate:carousel',
          label: 'Carousel to right',
          outClass: 'fx-slide-rotateCarouselRightOut fx-slide-ontop',
          inClass: 'fx-slide-rotateCarouselRightIn',
          reverse: 'carousel-to-left'
        },
        'carousel-to-top': {
          id: 64,
          group: 'rotate:carousel',
          label: 'Carousel to top',
          outClass: 'fx-slide-rotateCarouselTopOut fx-slide-ontop',
          inClass: 'fx-slide-rotateCarouselTopIn',
          reverse: 'carousel-to-bottom'
        },
        'carousel-to-bottom': {
          id: 65,
          group: 'rotate:carousel',
          label: 'Carousel to bottom',
          outClass: 'fx-slide-rotateCarouselBottomOut fx-slide-ontop',
          inClass: 'fx-slide-rotateCarouselBottomIn',
          reverse: 'carousel-to-top'
        },
        'sides': {
          id: 66,
          group: 'rotate',
          label: 'Sides',
          outClass: 'fx-slide-rotateSidesOut',
          inClass: 'fx-slide-rotateSidesIn fx-slide-delay200',
          reverse: 'sides'
        },
        'slide': {
          id: 67,
          label: 'Slide',
          outClass: 'fx-slide-rotateSlideOut',
          inClass: 'fx-slide-rotateSlideIn',
          reverse: 'slide'
        }
      },
      getAxisFromDirection: function (direction) {
        return direction === 'vertical' ? 'Y' : 'X';
      },
      addClassNames: function (element, classNames) {
        var names = classNames.split(' ');
        for (var i = 0; i < names.length; i++) {
          element.classList.add(names[i]);
        }
      },
      removeClassNames: function (element, classNames) {
        var names = classNames.split(' ');
        for (var i = 0; i < names.length; i++) {
          element.classList.remove(names[i]);
        }
      },
      prev: function (event) {
        if (event.index > 0 && !event.transition_complete) {
          var outSlide = event.slide;
          var inSlide = deck.slides[event.index - 1];

          this.doTransition(outSlide, inSlide, 'prev');
        }
      },
      next: function (event) {
        console.log(event);
        if (event.index < deck.slides.length - 1) {
          var outSlide = event.slide;
          var inSlide = deck.slides[event.index + 1];

          this.doTransition(outSlide, inSlide, 'next');
        }
      },
      slide: function (event) {
        if (event.slide) {
          var outSlideIndex = deck.slide();
          var outSlide = deck.slides[outSlideIndex];
          var inSlideIndex = event.index;
          var inSlide = event.slide;
          var direction = (inSlideIndex > outSlideIndex) ? 'next' : 'prev';
          this.doTransition(outSlide, inSlide, direction);
        }
      },
      doTransition: function (outSlide, inSlide, directive) {
        var axis = inSlide.getAttribute('data-bespoke-fx-direction') ? this.getAxisFromDirection(inSlide.getAttribute('data-bespoke-fx-direction')) : default_axis;
        if (reverse || inSlide.getAttribute('data-bespoke-fx-reverse') === 'true') {
          directive = directive === 'next' ? 'prev' : 'next';
        }
        var slide_transition_name = inSlide.getAttribute('data-bespoke-fx-transition');
        var slide_transition = this.fx[slide_transition_name][axis] ? this.fx[slide_transition_name][axis] : this.fx[transition][axis];
        var transition_name = slide_transition[directive];
        var outClass = this.animations[transition_name].outClass;
        var inClass = this.animations[transition_name].inClass;
        var bespokeFx = this;
        outSlide.addEventListener('webkitAnimationEnd', function (event) {
          bespokeFx.removeClassNames(event.target, outClass + ' fx-transitioning-out');
        });
        inSlide.addEventListener('webkitAnimationEnd', function (event) {
          bespokeFx.removeClassNames(event.target, inClass + ' fx-transitioning-in');
        });
        this.addClassNames(outSlide, outClass + ' fx-transitioning-out');
        this.addClassNames(inSlide, inClass + ' fx-transitioning-in');
      }
    };

    deck.on('next', function (event) {
      plugin.next(event)
    });
    deck.on('prev', function (event) {
      plugin.prev(event)
    });
    deck.on('slide', function (event) {
      plugin.slide(event)
    });
  };
};
},{}],6:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    var activateSlide = function(index) {
      var indexToActivate = -1 < index && index < deck.slides.length ? index : 0;
      if (indexToActivate !== deck.slide()) {
        deck.slide(indexToActivate);
      }
    };

    var parseHash = function() {
      var hash = window.location.hash.slice(1),
        slideNumberOrName = parseInt(hash, 10);

      if (hash) {
        if (slideNumberOrName) {
          activateSlide(slideNumberOrName - 1);
        } else {
          deck.slides.forEach(function(slide, i) {
            if (slide.getAttribute('data-bespoke-hash') === hash || slide.id === hash) {
              activateSlide(i);
            }
          });
        }
      }
    };

    setTimeout(function() {
      parseHash();

      deck.on('activate', function(e) {
        var slideName = e.slide.getAttribute('data-bespoke-hash') || e.slide.id;
        window.location.hash = slideName || e.index + 1;
      });

      window.addEventListener('hashchange', parseHash);
    }, 0);
  };
};

},{}],7:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var isHorizontal = options !== 'vertical';

    document.addEventListener('keydown', function(e) {
      if (e.which == 34 || // PAGE DOWN
        (e.which == 32 && !e.shiftKey) || // SPACE WITHOUT SHIFT
        (isHorizontal && e.which == 39) || // RIGHT
        (!isHorizontal && e.which == 40) // DOWN
      ) { deck.next(); }

      if (e.which == 33 || // PAGE UP
        (e.which == 32 && e.shiftKey) || // SPACE + SHIFT
        (isHorizontal && e.which == 37) || // LEFT
        (!isHorizontal && e.which == 38) // UP
      ) { deck.prev(); }
    });
  };
};

},{}],8:[function(require,module,exports){
module.exports = function(options) {
  return function (deck) {
    var progressParent = document.createElement('div'),
      progressBar = document.createElement('div'),
      prop = options === 'vertical' ? 'height' : 'width';

    progressParent.className = 'bespoke-progress-parent';
    progressBar.className = 'bespoke-progress-bar';
    progressParent.appendChild(progressBar);
    deck.parent.appendChild(progressParent);

    deck.on('activate', function(e) {
      progressBar.style[prop] = (e.index * 100 / (deck.slides.length - 1)) + '%';
    });
  };
};

},{}],9:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var parent = deck.parent,
      firstSlide = deck.slides[0],
      slideHeight = firstSlide.offsetHeight,
      slideWidth = firstSlide.offsetWidth,
      useZoom = options === 'zoom' || ('zoom' in parent.style && options !== 'transform'),

      wrap = function(element) {
        var wrapper = document.createElement('div');
        wrapper.className = 'bespoke-scale-parent';
        element.parentNode.insertBefore(wrapper, element);
        wrapper.appendChild(element);
        return wrapper;
      },

      elements = useZoom ? deck.slides : deck.slides.map(wrap),

      transformProperty = (function(property) {
        var prefixes = 'Moz Webkit O ms'.split(' ');
        return prefixes.reduce(function(currentProperty, prefix) {
            return prefix + property in parent.style ? prefix + property : currentProperty;
          }, property.toLowerCase());
      }('Transform')),

      scale = useZoom ?
        function(ratio, element) {
          element.style.zoom = ratio;
        } :
        function(ratio, element) {
          element.style[transformProperty] = 'scale(' + ratio + ')';
        },

      scaleAll = function() {
        var xScale = parent.offsetWidth / slideWidth,
          yScale = parent.offsetHeight / slideHeight;

        elements.forEach(scale.bind(null, Math.min(xScale, yScale)));
      };

    window.addEventListener('resize', scaleAll);
    scaleAll();
  };

};

},{}],10:[function(require,module,exports){
(function (global){
/*!
 * bespoke-theme-cube v2.0.1
 *
 * Copyright 2014, Mark Dalgleish
 * This content is released under the MIT license
 * http://mit-license.org/markdalgleish
 */

!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self);var f=o;f=f.bespoke||(f.bespoke={}),f=f.themes||(f.themes={}),f.cube=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){

var classes = _dereq_('bespoke-classes');
var insertCss = _dereq_('insert-css');

module.exports = function() {
  var css = "*{-moz-box-sizing:border-box;box-sizing:border-box;margin:0;padding:0}@media print{*{-webkit-print-color-adjust:exact}}@page{size:landscape;margin:0}.bespoke-parent{-webkit-transition:background .6s ease;transition:background .6s ease;position:absolute;top:0;bottom:0;left:0;right:0;overflow:hidden}@media print{.bespoke-parent{overflow:visible;position:static}}.bespoke-theme-cube-slide-parent{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-perspective:600px;perspective:600px;pointer-events:none}.bespoke-slide{pointer-events:auto;-webkit-transition:-webkit-transform .6s ease,opacity .6s ease,background .6s ease;transition:transform .6s ease,opacity .6s ease,background .6s ease;-webkit-transform-origin:50% 50% 0;transform-origin:50% 50% 0;-webkit-backface-visibility:hidden;backface-visibility:hidden;display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;-ms-flex-pack:center;justify-content:center;-webkit-box-align:center;-webkit-align-items:center;-ms-flex-align:center;align-items:center;text-align:center;width:640px;height:480px;position:absolute;top:50%;margin-top:-240px;left:50%;margin-left:-320px;background:#eaeaea;padding:40px;border-radius:0}@media print{.bespoke-slide{zoom:1!important;height:743px;width:100%;page-break-before:always;position:static;margin:0;-webkit-transition:none;transition:none}}.bespoke-before{-webkit-transform:translateX(100px)translateX(-320px)rotateY(-90deg)translateX(-320px);transform:translateX(100px)translateX(-320px)rotateY(-90deg)translateX(-320px)}@media print{.bespoke-before{-webkit-transform:none;transform:none}}.bespoke-after{-webkit-transform:translateX(-100px)translateX(320px)rotateY(90deg)translateX(320px);transform:translateX(-100px)translateX(320px)rotateY(90deg)translateX(320px)}@media print{.bespoke-after{-webkit-transform:none;transform:none}}.bespoke-inactive{opacity:0;pointer-events:none}@media print{.bespoke-inactive{opacity:1}}.bespoke-active{opacity:1}.bespoke-bullet{-webkit-transition:all .3s ease;transition:all .3s ease}@media print{.bespoke-bullet{-webkit-transition:none;transition:none}}.bespoke-bullet-inactive{opacity:0}li.bespoke-bullet-inactive{-webkit-transform:translateX(16px);transform:translateX(16px)}@media print{li.bespoke-bullet-inactive{-webkit-transform:none;transform:none}}@media print{.bespoke-bullet-inactive{opacity:1}}.bespoke-bullet-active{opacity:1}.bespoke-scale-parent{-webkit-perspective:600px;perspective:600px;position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none}.bespoke-scale-parent .bespoke-active{pointer-events:auto}@media print{.bespoke-scale-parent{-webkit-transform:none!important;transform:none!important}}.bespoke-progress-parent{position:absolute;top:0;left:0;right:0;height:2px}@media only screen and (min-width:1366px){.bespoke-progress-parent{height:4px}}@media print{.bespoke-progress-parent{display:none}}.bespoke-progress-bar{-webkit-transition:width .6s ease;transition:width .6s ease;position:absolute;height:100%;background:#0089f3;border-radius:0 4px 4px 0}.emphatic{background:#eaeaea}.bespoke-backdrop{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-transform:translateZ(0);transform:translateZ(0);-webkit-transition:opacity .6s ease;transition:opacity .6s ease;opacity:0;z-index:-1}.bespoke-backdrop-active{opacity:1}pre{padding:26px!important;border-radius:8px}body{font-family:helvetica,arial,sans-serif;font-size:18px;color:#404040}h1{font-size:72px;line-height:82px;letter-spacing:-2px;margin-bottom:16px}h2{font-size:42px;letter-spacing:-1px;margin-bottom:8px}h3{font-size:24px;font-weight:400;margin-bottom:24px;color:#606060}hr{visibility:hidden;height:20px}ul{list-style:none}li{margin-bottom:12px}p{margin:0 100px 12px;line-height:22px}a{color:#0089f3;text-decoration:none}";
  insertCss(css, { prepend: true });

  return function(deck) {
    classes()(deck);

    var wrap = function(element) {
      var wrapper = document.createElement('div');
      wrapper.className = 'bespoke-theme-cube-slide-parent';
      element.parentNode.insertBefore(wrapper, element);
      wrapper.appendChild(element);
    };

    deck.slides.forEach(wrap);
  };
};

},{"bespoke-classes":2,"insert-css":3}],2:[function(_dereq_,module,exports){
module.exports = function() {
  return function(deck) {
    var addClass = function(el, cls) {
        el.classList.add('bespoke-' + cls);
      },

      removeClass = function(el, cls) {
        el.className = el.className
          .replace(new RegExp('bespoke-' + cls +'(\\s|$)', 'g'), ' ')
          .trim();
      },

      deactivate = function(el, index) {
        var activeSlide = deck.slides[deck.slide()],
          offset = index - deck.slide(),
          offsetClass = offset > 0 ? 'after' : 'before';

        ['before(-\\d+)?', 'after(-\\d+)?', 'active', 'inactive'].map(removeClass.bind(null, el));

        if (el !== activeSlide) {
          ['inactive', offsetClass, offsetClass + '-' + Math.abs(offset)].map(addClass.bind(null, el));
        }
      };

    addClass(deck.parent, 'parent');
    deck.slides.map(function(el) { addClass(el, 'slide'); });

    deck.on('activate', function(e) {
      deck.slides.map(deactivate);
      addClass(e.slide, 'active');
      removeClass(e.slide, 'inactive');
    });
  };
};

},{}],3:[function(_dereq_,module,exports){
var inserted = {};

module.exports = function (css, options) {
    if (inserted[css]) return;
    inserted[css] = true;
    
    var elem = document.createElement('style');
    elem.setAttribute('type', 'text/css');

    if ('textContent' in elem) {
      elem.textContent = css;
    } else {
      elem.styleSheet.cssText = css;
    }
    
    var head = document.getElementsByTagName('head')[0];
    if (options && options.prepend) {
        head.insertBefore(elem, head.childNodes[0]);
    } else {
        head.appendChild(elem);
    }
};

},{}]},{},[1])
(1)
});
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],11:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var axis = options == 'vertical' ? 'Y' : 'X',
      startPosition,
      delta;

    deck.parent.addEventListener('touchstart', function(e) {
      if (e.touches.length == 1) {
        startPosition = e.touches[0]['page' + axis];
        delta = 0;
      }
    });

    deck.parent.addEventListener('touchmove', function(e) {
      if (e.touches.length == 1) {
        e.preventDefault();
        delta = e.touches[0]['page' + axis] - startPosition;
      }
    });

    deck.parent.addEventListener('touchend', function() {
      if (Math.abs(delta) > 50) {
        deck[delta > 0 ? 'prev' : 'next']();
      }
    });
  };
};

},{}],12:[function(require,module,exports){
var from = function(opts, plugins) {
  var parent = (opts.parent || opts).nodeType === 1 ? (opts.parent || opts) : document.querySelector(opts.parent || opts),
    slides = [].filter.call(typeof opts.slides === 'string' ? parent.querySelectorAll(opts.slides) : (opts.slides || parent.children), function(el) { return el.nodeName !== 'SCRIPT'; }),
    activeSlide = slides[0],
    listeners = {},

    activate = function(index, customData) {
      if (!slides[index]) {
        return;
      }

      fire('deactivate', createEventData(activeSlide, customData));
      activeSlide = slides[index];
      fire('activate', createEventData(activeSlide, customData));
    },

    slide = function(index, customData) {
      if (arguments.length) {
        fire('slide', createEventData(slides[index], customData)) && activate(index, customData);
      } else {
        return slides.indexOf(activeSlide);
      }
    },

    step = function(offset, customData) {
      var slideIndex = slides.indexOf(activeSlide) + offset;

      fire(offset > 0 ? 'next' : 'prev', createEventData(activeSlide, customData)) && activate(slideIndex, customData);
    },

    on = function(eventName, callback) {
      (listeners[eventName] || (listeners[eventName] = [])).push(callback);
      return off.bind(null, eventName, callback);
    },

    off = function(eventName, callback) {
      listeners[eventName] = (listeners[eventName] || []).filter(function(listener) { return listener !== callback; });
    },

    fire = function(eventName, eventData) {
      return (listeners[eventName] || [])
        .reduce(function(notCancelled, callback) {
          return notCancelled && callback(eventData) !== false;
        }, true);
    },

    createEventData = function(el, eventData) {
      eventData = eventData || {};
      eventData.index = slides.indexOf(el);
      eventData.slide = el;
      return eventData;
    },

    deck = {
      on: on,
      off: off,
      fire: fire,
      slide: slide,
      next: step.bind(null, 1),
      prev: step.bind(null, -1),
      parent: parent,
      slides: slides
    };

  (plugins || []).forEach(function(plugin) {
    plugin(deck);
  });

  activate(0);

  return deck;
};

module.exports = {
  from: from
};

},{}],13:[function(require,module,exports){
// Require Node modules in the browser thanks to Browserify: http://browserify.org
var bespoke = require('bespoke'),
  fx = require('bespoke-fx'),
  cube = require('bespoke-theme-cube'),
  keys = require('bespoke-keys'),
  touch = require('bespoke-touch'),
  bullets = require('bespoke-bullets'),
  backdrop = require('bespoke-backdrop'),
  scale = require('bespoke-scale'),
  hash = require('bespoke-hash'),
  progress = require('bespoke-progress'),
  forms = require('bespoke-forms');

// Bespoke.js
bespoke.from('article', [
  cube(),
  keys(),
  touch(),
  bullets('li, .bullet'),
  backdrop(),
  scale(),
  hash(),
  progress(),
  forms()
]);
bespoke.from('#presentation', [
  bespoke.plugins.fx()
]);
bespoke.horizontal.from('article', {
  fx: true
})
// Prism syntax highlighting
// This is actually loaded from "bower_components" thanks to
// debowerify: https://github.com/eugeneware/debowerify
require("./../../bower_components/prism/prism.js");


},{"./../../bower_components/prism/prism.js":1,"bespoke":12,"bespoke-backdrop":2,"bespoke-bullets":3,"bespoke-forms":4,"bespoke-fx":5,"bespoke-hash":6,"bespoke-keys":7,"bespoke-progress":8,"bespoke-scale":9,"bespoke-theme-cube":10,"bespoke-touch":11}]},{},[13])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvb3Jpb24zNDIyL0Rlc2t0b3AvTXlSZXBvL2Jvd2VyX2NvbXBvbmVudHMvcHJpc20vcHJpc20uanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYmFja2Ryb3AvbGliL2Jlc3Bva2UtYmFja2Ryb3AuanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYnVsbGV0cy9saWIvYmVzcG9rZS1idWxsZXRzLmpzIiwiL2hvbWUvb3Jpb24zNDIyL0Rlc2t0b3AvTXlSZXBvL25vZGVfbW9kdWxlcy9iZXNwb2tlLWZvcm1zL2xpYi9iZXNwb2tlLWZvcm1zLmpzIiwiL2hvbWUvb3Jpb24zNDIyL0Rlc2t0b3AvTXlSZXBvL25vZGVfbW9kdWxlcy9iZXNwb2tlLWZ4L2xpYi9iZXNwb2tlLWZ4LmpzIiwiL2hvbWUvb3Jpb24zNDIyL0Rlc2t0b3AvTXlSZXBvL25vZGVfbW9kdWxlcy9iZXNwb2tlLWhhc2gvbGliL2Jlc3Bva2UtaGFzaC5qcyIsIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9ub2RlX21vZHVsZXMvYmVzcG9rZS1rZXlzL2xpYi9iZXNwb2tlLWtleXMuanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2UtcHJvZ3Jlc3MvbGliL2Jlc3Bva2UtcHJvZ3Jlc3MuanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2Utc2NhbGUvbGliL2Jlc3Bva2Utc2NhbGUuanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdGhlbWUtY3ViZS9kaXN0L2Jlc3Bva2UtdGhlbWUtY3ViZS5qcyIsIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9ub2RlX21vZHVsZXMvYmVzcG9rZS10b3VjaC9saWIvYmVzcG9rZS10b3VjaC5qcyIsIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9ub2RlX21vZHVsZXMvYmVzcG9rZS9saWIvYmVzcG9rZS5qcyIsIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9zcmMvc2NyaXB0cy9mYWtlX2UwNTZhYmJhLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDajFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG52YXIgX3NlbGYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXG5cdD8gd2luZG93ICAgLy8gaWYgaW4gYnJvd3NlclxuXHQ6IChcblx0XHQodHlwZW9mIFdvcmtlckdsb2JhbFNjb3BlICE9PSAndW5kZWZpbmVkJyAmJiBzZWxmIGluc3RhbmNlb2YgV29ya2VyR2xvYmFsU2NvcGUpXG5cdFx0PyBzZWxmIC8vIGlmIGluIHdvcmtlclxuXHRcdDoge30gICAvLyBpZiBpbiBub2RlIGpzXG5cdCk7XG5cbi8qKlxuICogUHJpc206IExpZ2h0d2VpZ2h0LCByb2J1c3QsIGVsZWdhbnQgc3ludGF4IGhpZ2hsaWdodGluZ1xuICogTUlUIGxpY2Vuc2UgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHAvXG4gKiBAYXV0aG9yIExlYSBWZXJvdSBodHRwOi8vbGVhLnZlcm91Lm1lXG4gKi9cblxudmFyIFByaXNtID0gKGZ1bmN0aW9uKCl7XG5cbi8vIFByaXZhdGUgaGVscGVyIHZhcnNcbnZhciBsYW5nID0gL1xcYmxhbmcoPzp1YWdlKT8tKFxcdyspXFxiL2k7XG52YXIgdW5pcXVlSWQgPSAwO1xuXG52YXIgXyA9IF9zZWxmLlByaXNtID0ge1xuXHRtYW51YWw6IF9zZWxmLlByaXNtICYmIF9zZWxmLlByaXNtLm1hbnVhbCxcblx0dXRpbDoge1xuXHRcdGVuY29kZTogZnVuY3Rpb24gKHRva2Vucykge1xuXHRcdFx0aWYgKHRva2VucyBpbnN0YW5jZW9mIFRva2VuKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgVG9rZW4odG9rZW5zLnR5cGUsIF8udXRpbC5lbmNvZGUodG9rZW5zLmNvbnRlbnQpLCB0b2tlbnMuYWxpYXMpO1xuXHRcdFx0fSBlbHNlIGlmIChfLnV0aWwudHlwZSh0b2tlbnMpID09PSAnQXJyYXknKSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbnMubWFwKF8udXRpbC5lbmNvZGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHRva2Vucy5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC9cXHUwMGEwL2csICcgJyk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLm1hdGNoKC9cXFtvYmplY3QgKFxcdyspXFxdLylbMV07XG5cdFx0fSxcblxuXHRcdG9iaklkOiBmdW5jdGlvbiAob2JqKSB7XG5cdFx0XHRpZiAoIW9ialsnX19pZCddKSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdfX2lkJywgeyB2YWx1ZTogKyt1bmlxdWVJZCB9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvYmpbJ19faWQnXTtcblx0XHR9LFxuXG5cdFx0Ly8gRGVlcCBjbG9uZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gKGUuZy4gdG8gZXh0ZW5kIGl0KVxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xuXHRcdFx0dmFyIHR5cGUgPSBfLnV0aWwudHlwZShvKTtcblxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ09iamVjdCc6XG5cdFx0XHRcdFx0dmFyIGNsb25lID0ge307XG5cblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbykge1xuXHRcdFx0XHRcdFx0aWYgKG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gXy51dGlsLmNsb25lKG9ba2V5XSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIGNsb25lO1xuXG5cdFx0XHRcdGNhc2UgJ0FycmF5Jzpcblx0XHRcdFx0XHQvLyBDaGVjayBmb3IgZXhpc3RlbmNlIGZvciBJRThcblx0XHRcdFx0XHRyZXR1cm4gby5tYXAgJiYgby5tYXAoZnVuY3Rpb24odikgeyByZXR1cm4gXy51dGlsLmNsb25lKHYpOyB9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG87XG5cdFx0fVxuXHR9LFxuXG5cdGxhbmd1YWdlczoge1xuXHRcdGV4dGVuZDogZnVuY3Rpb24gKGlkLCByZWRlZikge1xuXHRcdFx0dmFyIGxhbmcgPSBfLnV0aWwuY2xvbmUoXy5sYW5ndWFnZXNbaWRdKTtcblxuXHRcdFx0Zm9yICh2YXIga2V5IGluIHJlZGVmKSB7XG5cdFx0XHRcdGxhbmdba2V5XSA9IHJlZGVmW2tleV07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBsYW5nO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQgKiBJbnNlcnQgYSB0b2tlbiBiZWZvcmUgYW5vdGhlciB0b2tlbiBpbiBhIGxhbmd1YWdlIGxpdGVyYWxcblx0XHQgKiBBcyB0aGlzIG5lZWRzIHRvIHJlY3JlYXRlIHRoZSBvYmplY3QgKHdlIGNhbm5vdCBhY3R1YWxseSBpbnNlcnQgYmVmb3JlIGtleXMgaW4gb2JqZWN0IGxpdGVyYWxzKSxcblx0XHQgKiB3ZSBjYW5ub3QganVzdCBwcm92aWRlIGFuIG9iamVjdCwgd2UgbmVlZCBhbm9iamVjdCBhbmQgYSBrZXkuXG5cdFx0ICogQHBhcmFtIGluc2lkZSBUaGUga2V5IChvciBsYW5ndWFnZSBpZCkgb2YgdGhlIHBhcmVudFxuXHRcdCAqIEBwYXJhbSBiZWZvcmUgVGhlIGtleSB0byBpbnNlcnQgYmVmb3JlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBmdW5jdGlvbiBhcHBlbmRzIGluc3RlYWQuXG5cdFx0ICogQHBhcmFtIGluc2VydCBPYmplY3Qgd2l0aCB0aGUga2V5L3ZhbHVlIHBhaXJzIHRvIGluc2VydFxuXHRcdCAqIEBwYXJhbSByb290IFRoZSBvYmplY3QgdGhhdCBjb250YWlucyBgaW5zaWRlYC4gSWYgZXF1YWwgdG8gUHJpc20ubGFuZ3VhZ2VzLCBpdCBjYW4gYmUgb21pdHRlZC5cblx0XHQgKi9cblx0XHRpbnNlcnRCZWZvcmU6IGZ1bmN0aW9uIChpbnNpZGUsIGJlZm9yZSwgaW5zZXJ0LCByb290KSB7XG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcblx0XHRcdHZhciBncmFtbWFyID0gcm9vdFtpbnNpZGVdO1xuXG5cdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XG5cdFx0XHRcdGluc2VydCA9IGFyZ3VtZW50c1sxXTtcblxuXHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcblx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xuXHRcdFx0XHRcdFx0Z3JhbW1hcltuZXdUb2tlbl0gPSBpbnNlcnRbbmV3VG9rZW5dO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBncmFtbWFyO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcmV0ID0ge307XG5cblx0XHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblxuXHRcdFx0XHRpZiAoZ3JhbW1hci5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcblxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcblxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XG5cblx0XHRcdFx0XHRcdFx0aWYgKGluc2VydC5oYXNPd25Qcm9wZXJ0eShuZXdUb2tlbikpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXRbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldFt0b2tlbl0gPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBVcGRhdGUgcmVmZXJlbmNlcyBpbiBvdGhlciBsYW5ndWFnZSBkZWZpbml0aW9uc1xuXHRcdFx0Xy5sYW5ndWFnZXMuREZTKF8ubGFuZ3VhZ2VzLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFx0XHRcdGlmICh2YWx1ZSA9PT0gcm9vdFtpbnNpZGVdICYmIGtleSAhPSBpbnNpZGUpIHtcblx0XHRcdFx0XHR0aGlzW2tleV0gPSByZXQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gcm9vdFtpbnNpZGVdID0gcmV0O1xuXHRcdH0sXG5cblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcblx0XHRERlM6IGZ1bmN0aW9uKG8sIGNhbGxiYWNrLCB0eXBlLCB2aXNpdGVkKSB7XG5cdFx0XHR2aXNpdGVkID0gdmlzaXRlZCB8fCB7fTtcblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xuXHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwobywgaSwgb1tpXSwgdHlwZSB8fCBpKTtcblxuXHRcdFx0XHRcdGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ09iamVjdCcgJiYgIXZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSkge1xuXHRcdFx0XHRcdFx0dmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldID0gdHJ1ZTtcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgbnVsbCwgdmlzaXRlZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKF8udXRpbC50eXBlKG9baV0pID09PSAnQXJyYXknICYmICF2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0pIHtcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2ssIGksIHZpc2l0ZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSxcblx0cGx1Z2luczoge30sXG5cblx0aGlnaGxpZ2h0QWxsOiBmdW5jdGlvbihhc3luYywgY2FsbGJhY2spIHtcblx0XHR2YXIgZW52ID0ge1xuXHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxuXHRcdFx0c2VsZWN0b3I6ICdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZSdcblx0XHR9O1xuXG5cdFx0Xy5ob29rcy5ydW4oXCJiZWZvcmUtaGlnaGxpZ2h0YWxsXCIsIGVudik7XG5cblx0XHR2YXIgZWxlbWVudHMgPSBlbnYuZWxlbWVudHMgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbnYuc2VsZWN0b3IpO1xuXG5cdFx0Zm9yICh2YXIgaT0wLCBlbGVtZW50OyBlbGVtZW50ID0gZWxlbWVudHNbaSsrXTspIHtcblx0XHRcdF8uaGlnaGxpZ2h0RWxlbWVudChlbGVtZW50LCBhc3luYyA9PT0gdHJ1ZSwgZW52LmNhbGxiYWNrKTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCwgYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0Ly8gRmluZCBsYW5ndWFnZVxuXHRcdHZhciBsYW5ndWFnZSwgZ3JhbW1hciwgcGFyZW50ID0gZWxlbWVudDtcblxuXHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xuXHRcdFx0cGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XG5cdFx0fVxuXG5cdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV0udG9Mb3dlckNhc2UoKTtcblx0XHRcdGdyYW1tYXIgPSBfLmxhbmd1YWdlc1tsYW5ndWFnZV07XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBlbGVtZW50LCBpZiBub3QgcHJlc2VudFxuXHRcdGVsZW1lbnQuY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIHBhcmVudCwgZm9yIHN0eWxpbmdcblx0XHRwYXJlbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7XG5cblx0XHRpZiAoL3ByZS9pLnRlc3QocGFyZW50Lm5vZGVOYW1lKSkge1xuXHRcdFx0cGFyZW50LmNsYXNzTmFtZSA9IHBhcmVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cdFx0fVxuXG5cdFx0dmFyIGNvZGUgPSBlbGVtZW50LnRleHRDb250ZW50O1xuXG5cdFx0dmFyIGVudiA9IHtcblx0XHRcdGVsZW1lbnQ6IGVsZW1lbnQsXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXG5cdFx0XHRncmFtbWFyOiBncmFtbWFyLFxuXHRcdFx0Y29kZTogY29kZVxuXHRcdH07XG5cblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLXNhbml0eS1jaGVjaycsIGVudik7XG5cblx0XHRpZiAoIWVudi5jb2RlIHx8ICFlbnYuZ3JhbW1hcikge1xuXHRcdFx0aWYgKGVudi5jb2RlKSB7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblx0XHRcdFx0ZW52LmVsZW1lbnQudGV4dENvbnRlbnQgPSBlbnYuY29kZTtcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHR9XG5cdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblxuXHRcdGlmIChhc3luYyAmJiBfc2VsZi5Xb3JrZXIpIHtcblx0XHRcdHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKF8uZmlsZW5hbWUpO1xuXG5cdFx0XHR3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGVudi5oaWdobGlnaHRlZENvZGUgPSBldnQuZGF0YTtcblxuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcblxuXHRcdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVudi5lbGVtZW50KTtcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XG5cdFx0XHR9O1xuXG5cdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRsYW5ndWFnZTogZW52Lmxhbmd1YWdlLFxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZSxcblx0XHRcdFx0aW1tZWRpYXRlQ2xvc2U6IHRydWVcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gXy5oaWdobGlnaHQoZW52LmNvZGUsIGVudi5ncmFtbWFyLCBlbnYubGFuZ3VhZ2UpO1xuXG5cdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XG5cblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrLmNhbGwoZWxlbWVudCk7XG5cblx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcblx0XHR2YXIgdG9rZW5zID0gXy50b2tlbml6ZSh0ZXh0LCBncmFtbWFyKTtcblx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KF8udXRpbC5lbmNvZGUodG9rZW5zKSwgbGFuZ3VhZ2UpO1xuXHR9LFxuXG5cdG1hdGNoR3JhbW1hcjogZnVuY3Rpb24gKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgaW5kZXgsIHN0YXJ0UG9zLCBvbmVzaG90LCB0YXJnZXQpIHtcblx0XHR2YXIgVG9rZW4gPSBfLlRva2VuO1xuXG5cdFx0Zm9yICh2YXIgdG9rZW4gaW4gZ3JhbW1hcikge1xuXHRcdFx0aWYoIWdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pIHx8ICFncmFtbWFyW3Rva2VuXSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRva2VuID09IHRhcmdldCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciBwYXR0ZXJucyA9IGdyYW1tYXJbdG9rZW5dO1xuXHRcdFx0cGF0dGVybnMgPSAoXy51dGlsLnR5cGUocGF0dGVybnMpID09PSBcIkFycmF5XCIpID8gcGF0dGVybnMgOiBbcGF0dGVybnNdO1xuXG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHBhdHRlcm5zLmxlbmd0aDsgKytqKSB7XG5cdFx0XHRcdHZhciBwYXR0ZXJuID0gcGF0dGVybnNbal0sXG5cdFx0XHRcdFx0aW5zaWRlID0gcGF0dGVybi5pbnNpZGUsXG5cdFx0XHRcdFx0bG9va2JlaGluZCA9ICEhcGF0dGVybi5sb29rYmVoaW5kLFxuXHRcdFx0XHRcdGdyZWVkeSA9ICEhcGF0dGVybi5ncmVlZHksXG5cdFx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IDAsXG5cdFx0XHRcdFx0YWxpYXMgPSBwYXR0ZXJuLmFsaWFzO1xuXG5cdFx0XHRcdGlmIChncmVlZHkgJiYgIXBhdHRlcm4ucGF0dGVybi5nbG9iYWwpIHtcblx0XHRcdFx0XHQvLyBXaXRob3V0IHRoZSBnbG9iYWwgZmxhZywgbGFzdEluZGV4IHdvbid0IHdvcmtcblx0XHRcdFx0XHR2YXIgZmxhZ3MgPSBwYXR0ZXJuLnBhdHRlcm4udG9TdHJpbmcoKS5tYXRjaCgvW2ltdXldKiQvKVswXTtcblx0XHRcdFx0XHRwYXR0ZXJuLnBhdHRlcm4gPSBSZWdFeHAocGF0dGVybi5wYXR0ZXJuLnNvdXJjZSwgZmxhZ3MgKyBcImdcIik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwYXR0ZXJuID0gcGF0dGVybi5wYXR0ZXJuIHx8IHBhdHRlcm47XG5cblx0XHRcdFx0Ly8gRG9u4oCZdCBjYWNoZSBsZW5ndGggYXMgaXQgY2hhbmdlcyBkdXJpbmcgdGhlIGxvb3Bcblx0XHRcdFx0Zm9yICh2YXIgaSA9IGluZGV4LCBwb3MgPSBzdGFydFBvczsgaSA8IHN0cmFyci5sZW5ndGg7IHBvcyArPSBzdHJhcnJbaV0ubGVuZ3RoLCArK2kpIHtcblxuXHRcdFx0XHRcdHZhciBzdHIgPSBzdHJhcnJbaV07XG5cblx0XHRcdFx0XHRpZiAoc3RyYXJyLmxlbmd0aCA+IHRleHQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHQvLyBTb21ldGhpbmcgd2VudCB0ZXJyaWJseSB3cm9uZywgQUJPUlQsIEFCT1JUIVxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChzdHIgaW5zdGFuY2VvZiBUb2tlbikge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cGF0dGVybi5sYXN0SW5kZXggPSAwO1xuXG5cdFx0XHRcdFx0dmFyIG1hdGNoID0gcGF0dGVybi5leGVjKHN0ciksXG5cdFx0XHRcdFx0ICAgIGRlbE51bSA9IDE7XG5cblx0XHRcdFx0XHQvLyBHcmVlZHkgcGF0dGVybnMgY2FuIG92ZXJyaWRlL3JlbW92ZSB1cCB0byB0d28gcHJldmlvdXNseSBtYXRjaGVkIHRva2Vuc1xuXHRcdFx0XHRcdGlmICghbWF0Y2ggJiYgZ3JlZWR5ICYmIGkgIT0gc3RyYXJyLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gcG9zO1xuXHRcdFx0XHRcdFx0bWF0Y2ggPSBwYXR0ZXJuLmV4ZWModGV4dCk7XG5cdFx0XHRcdFx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgKGxvb2tiZWhpbmQgPyBtYXRjaFsxXS5sZW5ndGggOiAwKSxcblx0XHRcdFx0XHRcdCAgICB0byA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoLFxuXHRcdFx0XHRcdFx0ICAgIGsgPSBpLFxuXHRcdFx0XHRcdFx0ICAgIHAgPSBwb3M7XG5cblx0XHRcdFx0XHRcdGZvciAodmFyIGxlbiA9IHN0cmFyci5sZW5ndGg7IGsgPCBsZW4gJiYgKHAgPCB0byB8fCAoIXN0cmFycltrXS50eXBlICYmICFzdHJhcnJbayAtIDFdLmdyZWVkeSkpOyArK2spIHtcblx0XHRcdFx0XHRcdFx0cCArPSBzdHJhcnJba10ubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHQvLyBNb3ZlIHRoZSBpbmRleCBpIHRvIHRoZSBlbGVtZW50IGluIHN0cmFyciB0aGF0IGlzIGNsb3Nlc3QgdG8gZnJvbVxuXHRcdFx0XHRcdFx0XHRpZiAoZnJvbSA+PSBwKSB7XG5cdFx0XHRcdFx0XHRcdFx0KytpO1xuXHRcdFx0XHRcdFx0XHRcdHBvcyA9IHA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Lypcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltpXSBpcyBhIFRva2VuLCB0aGVuIHRoZSBtYXRjaCBzdGFydHMgaW5zaWRlIGFub3RoZXIgVG9rZW4sIHdoaWNoIGlzIGludmFsaWRcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltrIC0gMV0gaXMgZ3JlZWR5IHdlIGFyZSBpbiBjb25mbGljdCB3aXRoIGFub3RoZXIgZ3JlZWR5IHBhdHRlcm5cblx0XHRcdFx0XHRcdCAqL1xuXHRcdFx0XHRcdFx0aWYgKHN0cmFycltpXSBpbnN0YW5jZW9mIFRva2VuIHx8IHN0cmFycltrIC0gMV0uZ3JlZWR5KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBOdW1iZXIgb2YgdG9rZW5zIHRvIGRlbGV0ZSBhbmQgcmVwbGFjZSB3aXRoIHRoZSBuZXcgbWF0Y2hcblx0XHRcdFx0XHRcdGRlbE51bSA9IGsgLSBpO1xuXHRcdFx0XHRcdFx0c3RyID0gdGV4dC5zbGljZShwb3MsIHApO1xuXHRcdFx0XHRcdFx0bWF0Y2guaW5kZXggLT0gcG9zO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghbWF0Y2gpIHtcblx0XHRcdFx0XHRcdGlmIChvbmVzaG90KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XG5cdFx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gbWF0Y2hbMV0ubGVuZ3RoO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciBmcm9tID0gbWF0Y2guaW5kZXggKyBsb29rYmVoaW5kTGVuZ3RoLFxuXHRcdFx0XHRcdCAgICBtYXRjaCA9IG1hdGNoWzBdLnNsaWNlKGxvb2tiZWhpbmRMZW5ndGgpLFxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBtYXRjaC5sZW5ndGgsXG5cdFx0XHRcdFx0ICAgIGJlZm9yZSA9IHN0ci5zbGljZSgwLCBmcm9tKSxcblx0XHRcdFx0XHQgICAgYWZ0ZXIgPSBzdHIuc2xpY2UodG8pO1xuXG5cdFx0XHRcdFx0dmFyIGFyZ3MgPSBbaSwgZGVsTnVtXTtcblxuXHRcdFx0XHRcdGlmIChiZWZvcmUpIHtcblx0XHRcdFx0XHRcdCsraTtcblx0XHRcdFx0XHRcdHBvcyArPSBiZWZvcmUubGVuZ3RoO1xuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGJlZm9yZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoLCBhbGlhcywgbWF0Y2gsIGdyZWVkeSk7XG5cblx0XHRcdFx0XHRhcmdzLnB1c2god3JhcHBlZCk7XG5cblx0XHRcdFx0XHRpZiAoYWZ0ZXIpIHtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChhZnRlcik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0QXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShzdHJhcnIsIGFyZ3MpO1xuXG5cdFx0XHRcdFx0aWYgKGRlbE51bSAhPSAxKVxuXHRcdFx0XHRcdFx0Xy5tYXRjaEdyYW1tYXIodGV4dCwgc3RyYXJyLCBncmFtbWFyLCBpLCBwb3MsIHRydWUsIHRva2VuKTtcblxuXHRcdFx0XHRcdGlmIChvbmVzaG90KVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0dG9rZW5pemU6IGZ1bmN0aW9uKHRleHQsIGdyYW1tYXIsIGxhbmd1YWdlKSB7XG5cdFx0dmFyIHN0cmFyciA9IFt0ZXh0XTtcblxuXHRcdHZhciByZXN0ID0gZ3JhbW1hci5yZXN0O1xuXG5cdFx0aWYgKHJlc3QpIHtcblx0XHRcdGZvciAodmFyIHRva2VuIGluIHJlc3QpIHtcblx0XHRcdFx0Z3JhbW1hclt0b2tlbl0gPSByZXN0W3Rva2VuXTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsZXRlIGdyYW1tYXIucmVzdDtcblx0XHR9XG5cblx0XHRfLm1hdGNoR3JhbW1hcih0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIDAsIDAsIGZhbHNlKTtcblxuXHRcdHJldHVybiBzdHJhcnI7XG5cdH0sXG5cblx0aG9va3M6IHtcblx0XHRhbGw6IHt9LFxuXG5cdFx0YWRkOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdHZhciBob29rcyA9IF8uaG9va3MuYWxsO1xuXG5cdFx0XHRob29rc1tuYW1lXSA9IGhvb2tzW25hbWVdIHx8IFtdO1xuXG5cdFx0XHRob29rc1tuYW1lXS5wdXNoKGNhbGxiYWNrKTtcblx0XHR9LFxuXG5cdFx0cnVuOiBmdW5jdGlvbiAobmFtZSwgZW52KSB7XG5cdFx0XHR2YXIgY2FsbGJhY2tzID0gXy5ob29rcy5hbGxbbmFtZV07XG5cblx0XHRcdGlmICghY2FsbGJhY2tzIHx8ICFjYWxsYmFja3MubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Zm9yICh2YXIgaT0wLCBjYWxsYmFjazsgY2FsbGJhY2sgPSBjYWxsYmFja3NbaSsrXTspIHtcblx0XHRcdFx0Y2FsbGJhY2soZW52KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbnZhciBUb2tlbiA9IF8uVG9rZW4gPSBmdW5jdGlvbih0eXBlLCBjb250ZW50LCBhbGlhcywgbWF0Y2hlZFN0ciwgZ3JlZWR5KSB7XG5cdHRoaXMudHlwZSA9IHR5cGU7XG5cdHRoaXMuY29udGVudCA9IGNvbnRlbnQ7XG5cdHRoaXMuYWxpYXMgPSBhbGlhcztcblx0Ly8gQ29weSBvZiB0aGUgZnVsbCBzdHJpbmcgdGhpcyB0b2tlbiB3YXMgY3JlYXRlZCBmcm9tXG5cdHRoaXMubGVuZ3RoID0gKG1hdGNoZWRTdHIgfHwgXCJcIikubGVuZ3RofDA7XG5cdHRoaXMuZ3JlZWR5ID0gISFncmVlZHk7XG59O1xuXG5Ub2tlbi5zdHJpbmdpZnkgPSBmdW5jdGlvbihvLCBsYW5ndWFnZSwgcGFyZW50KSB7XG5cdGlmICh0eXBlb2YgbyA9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBvO1xuXHR9XG5cblx0aWYgKF8udXRpbC50eXBlKG8pID09PSAnQXJyYXknKSB7XG5cdFx0cmV0dXJuIG8ubWFwKGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBUb2tlbi5zdHJpbmdpZnkoZWxlbWVudCwgbGFuZ3VhZ2UsIG8pO1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cblx0dmFyIGVudiA9IHtcblx0XHR0eXBlOiBvLnR5cGUsXG5cdFx0Y29udGVudDogVG9rZW4uc3RyaW5naWZ5KG8uY29udGVudCwgbGFuZ3VhZ2UsIHBhcmVudCksXG5cdFx0dGFnOiAnc3BhbicsXG5cdFx0Y2xhc3NlczogWyd0b2tlbicsIG8udHlwZV0sXG5cdFx0YXR0cmlidXRlczoge30sXG5cdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdHBhcmVudDogcGFyZW50XG5cdH07XG5cblx0aWYgKGVudi50eXBlID09ICdjb21tZW50Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWydzcGVsbGNoZWNrJ10gPSAndHJ1ZSc7XG5cdH1cblxuXHRpZiAoby5hbGlhcykge1xuXHRcdHZhciBhbGlhc2VzID0gXy51dGlsLnR5cGUoby5hbGlhcykgPT09ICdBcnJheScgPyBvLmFsaWFzIDogW28uYWxpYXNdO1xuXHRcdEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KGVudi5jbGFzc2VzLCBhbGlhc2VzKTtcblx0fVxuXG5cdF8uaG9va3MucnVuKCd3cmFwJywgZW52KTtcblxuXHR2YXIgYXR0cmlidXRlcyA9IE9iamVjdC5rZXlzKGVudi5hdHRyaWJ1dGVzKS5tYXAoZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiBuYW1lICsgJz1cIicgKyAoZW52LmF0dHJpYnV0ZXNbbmFtZV0gfHwgJycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKSArICdcIic7XG5cdH0pLmpvaW4oJyAnKTtcblxuXHRyZXR1cm4gJzwnICsgZW52LnRhZyArICcgY2xhc3M9XCInICsgZW52LmNsYXNzZXMuam9pbignICcpICsgJ1wiJyArIChhdHRyaWJ1dGVzID8gJyAnICsgYXR0cmlidXRlcyA6ICcnKSArICc+JyArIGVudi5jb250ZW50ICsgJzwvJyArIGVudi50YWcgKyAnPic7XG5cbn07XG5cbmlmICghX3NlbGYuZG9jdW1lbnQpIHtcblx0aWYgKCFfc2VsZi5hZGRFdmVudExpc3RlbmVyKSB7XG5cdFx0Ly8gaW4gTm9kZS5qc1xuXHRcdHJldHVybiBfc2VsZi5QcmlzbTtcblx0fVxuIFx0Ly8gSW4gd29ya2VyXG5cdF9zZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihldnQpIHtcblx0XHR2YXIgbWVzc2FnZSA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpLFxuXHRcdCAgICBsYW5nID0gbWVzc2FnZS5sYW5ndWFnZSxcblx0XHQgICAgY29kZSA9IG1lc3NhZ2UuY29kZSxcblx0XHQgICAgaW1tZWRpYXRlQ2xvc2UgPSBtZXNzYWdlLmltbWVkaWF0ZUNsb3NlO1xuXG5cdFx0X3NlbGYucG9zdE1lc3NhZ2UoXy5oaWdobGlnaHQoY29kZSwgXy5sYW5ndWFnZXNbbGFuZ10sIGxhbmcpKTtcblx0XHRpZiAoaW1tZWRpYXRlQ2xvc2UpIHtcblx0XHRcdF9zZWxmLmNsb3NlKCk7XG5cdFx0fVxuXHR9LCBmYWxzZSk7XG5cblx0cmV0dXJuIF9zZWxmLlByaXNtO1xufVxuXG4vL0dldCBjdXJyZW50IHNjcmlwdCBhbmQgaGlnaGxpZ2h0XG52YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3VycmVudFNjcmlwdCB8fCBbXS5zbGljZS5jYWxsKGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwic2NyaXB0XCIpKS5wb3AoKTtcblxuaWYgKHNjcmlwdCkge1xuXHRfLmZpbGVuYW1lID0gc2NyaXB0LnNyYztcblxuXHRpZiAoZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciAmJiAhXy5tYW51YWwgJiYgIXNjcmlwdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtbWFudWFsJykpIHtcblx0XHRpZihkb2N1bWVudC5yZWFkeVN0YXRlICE9PSBcImxvYWRpbmdcIikge1xuXHRcdFx0aWYgKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShfLmhpZ2hsaWdodEFsbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dChfLmhpZ2hsaWdodEFsbCwgMTYpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBfLmhpZ2hsaWdodEFsbCk7XG5cdFx0fVxuXHR9XG59XG5cbnJldHVybiBfc2VsZi5QcmlzbTtcblxufSkoKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gUHJpc207XG59XG5cbi8vIGhhY2sgZm9yIGNvbXBvbmVudHMgdG8gd29yayBjb3JyZWN0bHkgaW4gbm9kZS5qc1xuaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG5cdGdsb2JhbC5QcmlzbSA9IFByaXNtO1xufVxuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XG5cdCdjb21tZW50JzogLzwhLS1bXFxzXFxTXSo/LS0+Lyxcblx0J3Byb2xvZyc6IC88XFw/W1xcc1xcU10rP1xcPz4vLFxuXHQnZG9jdHlwZSc6IC88IURPQ1RZUEVbXFxzXFxTXSs/Pi9pLFxuXHQnY2RhdGEnOiAvPCFcXFtDREFUQVxcW1tcXHNcXFNdKj9dXT4vaSxcblx0J3RhZyc6IHtcblx0XHRwYXR0ZXJuOiAvPFxcLz8oPyFcXGQpW15cXHM+XFwvPSQ8XSsoPzpcXHMrW15cXHM+XFwvPV0rKD86PSg/OihcInwnKSg/OlxcXFxcXDF8XFxcXD8oPyFcXDEpW1xcc1xcU10pKlxcMXxbXlxccydcIj49XSspKT8pKlxccypcXC8/Pi9pLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J3RhZyc6IHtcblx0XHRcdFx0cGF0dGVybjogL148XFwvP1teXFxzPlxcL10rL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9ePFxcLz8vLFxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0cGF0dGVybjogLz0oPzooJ3xcIilbXFxzXFxTXSo/KFxcMSl8W15cXHM+XSspL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9bPT5cIiddL1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+Lyxcblx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9bXlxccz5cXC9dKy8sXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblx0fSxcblx0J2VudGl0eSc6IC8mIz9bXFxkYS16XXsxLDh9Oy9pXG59O1xuXG4vLyBQbHVnaW4gdG8gbWFrZSBlbnRpdHkgdGl0bGUgc2hvdyB0aGUgcmVhbCBlbnRpdHksIGlkZWEgYnkgUm9tYW4gS29tYXJvdlxuUHJpc20uaG9va3MuYWRkKCd3cmFwJywgZnVuY3Rpb24oZW52KSB7XG5cblx0aWYgKGVudi50eXBlID09PSAnZW50aXR5Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWyd0aXRsZSddID0gZW52LmNvbnRlbnQucmVwbGFjZSgvJmFtcDsvLCAnJicpO1xuXHR9XG59KTtcblxuUHJpc20ubGFuZ3VhZ2VzLnhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMuaHRtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMubWF0aG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblByaXNtLmxhbmd1YWdlcy5zdmcgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY3NzLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jc3MgPSB7XG5cdCdjb21tZW50JzogL1xcL1xcKltcXHNcXFNdKj9cXCpcXC8vLFxuXHQnYXRydWxlJzoge1xuXHRcdHBhdHRlcm46IC9AW1xcdy1dKz8uKj8oO3woPz1cXHMqXFx7KSkvaSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCdydWxlJzogL0BbXFx3LV0rL1xuXHRcdFx0Ly8gU2VlIHJlc3QgYmVsb3dcblx0XHR9XG5cdH0sXG5cdCd1cmwnOiAvdXJsXFwoKD86KFtcIiddKShcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxfC4qPylcXCkvaSxcblx0J3NlbGVjdG9yJzogL1teXFx7XFx9XFxzXVteXFx7XFx9O10qPyg/PVxccypcXHspLyxcblx0J3N0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvKFwifCcpKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQncHJvcGVydHknOiAvKFxcYnxcXEIpW1xcdy1dKyg/PVxccyo6KS9pLFxuXHQnaW1wb3J0YW50JzogL1xcQiFpbXBvcnRhbnRcXGIvaSxcblx0J2Z1bmN0aW9uJzogL1stYS16MC05XSsoPz1cXCgpL2ksXG5cdCdwdW5jdHVhdGlvbic6IC9bKCl7fTs6XS9cbn07XG5cblByaXNtLmxhbmd1YWdlcy5jc3NbJ2F0cnVsZSddLmluc2lkZS5yZXN0ID0gUHJpc20udXRpbC5jbG9uZShQcmlzbS5sYW5ndWFnZXMuY3NzKTtcblxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcblx0XHQnc3R5bGUnOiB7XG5cdFx0XHRwYXR0ZXJuOiAvKDxzdHlsZVtcXHNcXFNdKj8+KVtcXHNcXFNdKj8oPz08XFwvc3R5bGU+KS9pLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzcyxcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xuXHRcdH1cblx0fSk7XG5cdFxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdpbnNpZGUnLCAnYXR0ci12YWx1ZScsIHtcblx0XHQnc3R5bGUtYXR0cic6IHtcblx0XHRcdHBhdHRlcm46IC9cXHMqc3R5bGU9KFwifCcpLio/XFwxL2ksXG5cdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0J2F0dHItbmFtZSc6IHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxccypzdHlsZS9pLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcuaW5zaWRlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9eXFxzKj1cXHMqWydcIl18WydcIl1cXHMqJC8sXG5cdFx0XHRcdCdhdHRyLXZhbHVlJzoge1xuXHRcdFx0XHRcdHBhdHRlcm46IC8uKy9pLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzc1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1jc3MnXG5cdFx0fVxuXHR9LCBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZyk7XG59XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY2xpa2UuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmNsaWtlID0ge1xuXHQnY29tbWVudCc6IFtcblx0XHR7XG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcXSlcXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0XHR9LFxuXHRcdHtcblx0XHRcdHBhdHRlcm46IC8oXnxbXlxcXFw6XSlcXC9cXC8uKi8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0fVxuXHRdLFxuXHQnc3RyaW5nJzoge1xuXHRcdHBhdHRlcm46IC8oW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQnY2xhc3MtbmFtZSc6IHtcblx0XHRwYXR0ZXJuOiAvKCg/OlxcYig/OmNsYXNzfGludGVyZmFjZXxleHRlbmRzfGltcGxlbWVudHN8dHJhaXR8aW5zdGFuY2VvZnxuZXcpXFxzKyl8KD86Y2F0Y2hcXHMrXFwoKSlbYS16MC05X1xcLlxcXFxdKy9pLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHRwdW5jdHVhdGlvbjogLyhcXC58XFxcXCkvXG5cdFx0fVxuXHR9LFxuXHQna2V5d29yZCc6IC9cXGIoaWZ8ZWxzZXx3aGlsZXxkb3xmb3J8cmV0dXJufGlufGluc3RhbmNlb2Z8ZnVuY3Rpb258bmV3fHRyeXx0aHJvd3xjYXRjaHxmaW5hbGx5fG51bGx8YnJlYWt8Y29udGludWUpXFxiLyxcblx0J2Jvb2xlYW4nOiAvXFxiKHRydWV8ZmFsc2UpXFxiLyxcblx0J2Z1bmN0aW9uJzogL1thLXowLTlfXSsoPz1cXCgpL2ksXG5cdCdudW1iZXInOiAvXFxiLT8oPzoweFtcXGRhLWZdK3xcXGQqXFwuP1xcZCsoPzplWystXT9cXGQrKT8pXFxiL2ksXG5cdCdvcGVyYXRvcic6IC8tLT98XFwrXFwrP3whPT89P3w8PT98Pj0/fD09Pz0/fCYmP3xcXHxcXHw/fFxcP3xcXCp8XFwvfH58XFxefCUvLFxuXHQncHVuY3R1YXRpb24nOiAvW3t9W1xcXTsoKSwuOl0vXG59O1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tamF2YXNjcmlwdC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCA9IFByaXNtLmxhbmd1YWdlcy5leHRlbmQoJ2NsaWtlJywge1xuXHQna2V5d29yZCc6IC9cXGIoYXN8YXN5bmN8YXdhaXR8YnJlYWt8Y2FzZXxjYXRjaHxjbGFzc3xjb25zdHxjb250aW51ZXxkZWJ1Z2dlcnxkZWZhdWx0fGRlbGV0ZXxkb3xlbHNlfGVudW18ZXhwb3J0fGV4dGVuZHN8ZmluYWxseXxmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dmFyfHZvaWR8d2hpbGV8d2l0aHx5aWVsZClcXGIvLFxuXHQnbnVtYmVyJzogL1xcYi0/KDB4W1xcZEEtRmEtZl0rfDBiWzAxXSt8MG9bMC03XSt8XFxkKlxcLj9cXGQrKFtFZV1bKy1dP1xcZCspP3xOYU58SW5maW5pdHkpXFxiLyxcblx0Ly8gQWxsb3cgZm9yIGFsbCBub24tQVNDSUkgY2hhcmFjdGVycyAoU2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIwMDg0NDQpXG5cdCdmdW5jdGlvbic6IC9bXyRhLXpBLVpcXHhBMC1cXHVGRkZGXVtfJGEtekEtWjAtOVxceEEwLVxcdUZGRkZdKig/PVxcKCkvaSxcblx0J29wZXJhdG9yJzogLy1bLT1dP3xcXCtbKz1dP3whPT89P3w8PD89P3w+Pj8+Pz0/fD0oPzo9PT98Pik/fCZbJj1dP3xcXHxbfD1dP3xcXCpcXCo/PT98XFwvPT98fnxcXF49P3wlPT98XFw/fFxcLnszfS9cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ2tleXdvcmQnLCB7XG5cdCdyZWdleCc6IHtcblx0XHRwYXR0ZXJuOiAvKF58W14vXSlcXC8oPyFcXC8pKFxcWy4rP118XFxcXC58W14vXFxcXFxcclxcbl0pK1xcL1tnaW15dV17MCw1fSg/PVxccyooJHxbXFxyXFxuLC47fSldKSkvLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0Z3JlZWR5OiB0cnVlXG5cdH1cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ3N0cmluZycsIHtcblx0J3RlbXBsYXRlLXN0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvYCg/OlxcXFxcXFxcfFxcXFw/W15cXFxcXSkqP2AvLFxuXHRcdGdyZWVkeTogdHJ1ZSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCdpbnRlcnBvbGF0aW9uJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvXFwkXFx7W159XStcXH0vLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQnaW50ZXJwb2xhdGlvbi1wdW5jdHVhdGlvbic6IHtcblx0XHRcdFx0XHRcdHBhdHRlcm46IC9eXFwkXFx7fFxcfSQvLFxuXHRcdFx0XHRcdFx0YWxpYXM6ICdwdW5jdHVhdGlvbidcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHJlc3Q6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnc3RyaW5nJzogL1tcXHNcXFNdKy9cblx0XHR9XG5cdH1cbn0pO1xuXG5pZiAoUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cCkge1xuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xuXHRcdCdzY3JpcHQnOiB7XG5cdFx0XHRwYXR0ZXJuOiAvKDxzY3JpcHRbXFxzXFxTXSo/PilbXFxzXFxTXSo/KD89PFxcL3NjcmlwdD4pL2ksXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCxcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtamF2YXNjcmlwdCdcblx0XHR9XG5cdH0pO1xufVxuXG5QcmlzbS5sYW5ndWFnZXMuanMgPSBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdDtcblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1maWxlLWhpZ2hsaWdodC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG4oZnVuY3Rpb24gKCkge1xuXHRpZiAodHlwZW9mIHNlbGYgPT09ICd1bmRlZmluZWQnIHx8ICFzZWxmLlByaXNtIHx8ICFzZWxmLmRvY3VtZW50IHx8ICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0c2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0ID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgRXh0ZW5zaW9ucyA9IHtcblx0XHRcdCdqcyc6ICdqYXZhc2NyaXB0Jyxcblx0XHRcdCdweSc6ICdweXRob24nLFxuXHRcdFx0J3JiJzogJ3J1YnknLFxuXHRcdFx0J3BzMSc6ICdwb3dlcnNoZWxsJyxcblx0XHRcdCdwc20xJzogJ3Bvd2Vyc2hlbGwnLFxuXHRcdFx0J3NoJzogJ2Jhc2gnLFxuXHRcdFx0J2JhdCc6ICdiYXRjaCcsXG5cdFx0XHQnaCc6ICdjJyxcblx0XHRcdCd0ZXgnOiAnbGF0ZXgnXG5cdFx0fTtcblxuXHRcdGlmKEFycmF5LnByb3RvdHlwZS5mb3JFYWNoKSB7IC8vIENoZWNrIHRvIHByZXZlbnQgZXJyb3IgaW4gSUU4XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdwcmVbZGF0YS1zcmNdJykpLmZvckVhY2goZnVuY3Rpb24gKHByZSkge1xuXHRcdFx0XHR2YXIgc3JjID0gcHJlLmdldEF0dHJpYnV0ZSgnZGF0YS1zcmMnKTtcblxuXHRcdFx0XHR2YXIgbGFuZ3VhZ2UsIHBhcmVudCA9IHByZTtcblx0XHRcdFx0dmFyIGxhbmcgPSAvXFxibGFuZyg/OnVhZ2UpPy0oPyFcXCopKFxcdyspXFxiL2k7XG5cdFx0XHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xuXHRcdFx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRcdGxhbmd1YWdlID0gKHByZS5jbGFzc05hbWUubWF0Y2gobGFuZykgfHwgWywgJyddKVsxXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghbGFuZ3VhZ2UpIHtcblx0XHRcdFx0XHR2YXIgZXh0ZW5zaW9uID0gKHNyYy5tYXRjaCgvXFwuKFxcdyspJC8pIHx8IFssICcnXSlbMV07XG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSBFeHRlbnNpb25zW2V4dGVuc2lvbl0gfHwgZXh0ZW5zaW9uO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGNvZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjb2RlJyk7XG5cdFx0XHRcdGNvZGUuY2xhc3NOYW1lID0gJ2xhbmd1YWdlLScgKyBsYW5ndWFnZTtcblxuXHRcdFx0XHRwcmUudGV4dENvbnRlbnQgPSAnJztcblxuXHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ0xvYWRpbmfigKYnO1xuXG5cdFx0XHRcdHByZS5hcHBlbmRDaGlsZChjb2RlKTtcblxuXHRcdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cblx0XHRcdFx0eGhyLm9wZW4oJ0dFVCcsIHNyYywgdHJ1ZSk7XG5cblx0XHRcdFx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgPT0gNCkge1xuXG5cdFx0XHRcdFx0XHRpZiAoeGhyLnN0YXR1cyA8IDQwMCAmJiB4aHIucmVzcG9uc2VUZXh0KSB7XG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSB4aHIucmVzcG9uc2VUZXh0O1xuXG5cdFx0XHRcdFx0XHRcdFByaXNtLmhpZ2hsaWdodEVsZW1lbnQoY29kZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmICh4aHIuc3RhdHVzID49IDQwMCkge1xuXHRcdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ+KcliBFcnJvciAnICsgeGhyLnN0YXR1cyArICcgd2hpbGUgZmV0Y2hpbmcgZmlsZTogJyArIHhoci5zdGF0dXNUZXh0O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yOiBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIGlzIGVtcHR5Jztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0eGhyLnNlbmQobnVsbCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0fTtcblxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgc2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0KTtcblxufSkoKTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xuICAgIHZhciBiYWNrZHJvcHM7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVCYWNrZHJvcEZvclNsaWRlKHNsaWRlKSB7XG4gICAgICB2YXIgYmFja2Ryb3BBdHRyaWJ1dGUgPSBzbGlkZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYmVzcG9rZS1iYWNrZHJvcCcpO1xuXG4gICAgICBpZiAoYmFja2Ryb3BBdHRyaWJ1dGUpIHtcbiAgICAgICAgdmFyIGJhY2tkcm9wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTmFtZSA9IGJhY2tkcm9wQXR0cmlidXRlO1xuICAgICAgICBiYWNrZHJvcC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJhY2tkcm9wJyk7XG4gICAgICAgIGRlY2sucGFyZW50LmFwcGVuZENoaWxkKGJhY2tkcm9wKTtcbiAgICAgICAgcmV0dXJuIGJhY2tkcm9wO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUNsYXNzZXMoZWwpIHtcbiAgICAgIGlmIChlbCkge1xuICAgICAgICB2YXIgaW5kZXggPSBiYWNrZHJvcHMuaW5kZXhPZihlbCksXG4gICAgICAgICAgY3VycmVudEluZGV4ID0gZGVjay5zbGlkZSgpO1xuXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYWN0aXZlJyk7XG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnaW5hY3RpdmUnKTtcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdiZWZvcmUnKTtcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdhZnRlcicpO1xuXG4gICAgICAgIGlmIChpbmRleCAhPT0gY3VycmVudEluZGV4KSB7XG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdpbmFjdGl2ZScpO1xuICAgICAgICAgIGFkZENsYXNzKGVsLCBpbmRleCA8IGN1cnJlbnRJbmRleCA/ICdiZWZvcmUnIDogJ2FmdGVyJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdhY3RpdmUnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbW92ZUNsYXNzKGVsLCBjbGFzc05hbWUpIHtcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYmFja2Ryb3AtJyArIGNsYXNzTmFtZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkQ2xhc3MoZWwsIGNsYXNzTmFtZSkge1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1iYWNrZHJvcC0nICsgY2xhc3NOYW1lKTtcbiAgICB9XG5cbiAgICBiYWNrZHJvcHMgPSBkZWNrLnNsaWRlc1xuICAgICAgLm1hcChjcmVhdGVCYWNrZHJvcEZvclNsaWRlKTtcblxuICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oKSB7XG4gICAgICBiYWNrZHJvcHMuZm9yRWFjaCh1cGRhdGVDbGFzc2VzKTtcbiAgICB9KTtcbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgYWN0aXZlU2xpZGVJbmRleCxcbiAgICAgIGFjdGl2ZUJ1bGxldEluZGV4LFxuXG4gICAgICBidWxsZXRzID0gZGVjay5zbGlkZXMubWFwKGZ1bmN0aW9uKHNsaWRlKSB7XG4gICAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKHNsaWRlLnF1ZXJ5U2VsZWN0b3JBbGwoKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiAnW2RhdGEtYmVzcG9rZS1idWxsZXRdJykpLCAwKTtcbiAgICAgIH0pLFxuXG4gICAgICBuZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBuZXh0U2xpZGVJbmRleCA9IGFjdGl2ZVNsaWRlSW5kZXggKyAxO1xuXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KDEpKSB7XG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQoYWN0aXZlU2xpZGVJbmRleCwgYWN0aXZlQnVsbGV0SW5kZXggKyAxKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoYnVsbGV0c1tuZXh0U2xpZGVJbmRleF0pIHtcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChuZXh0U2xpZGVJbmRleCwgMCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIHByZXYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHByZXZTbGlkZUluZGV4ID0gYWN0aXZlU2xpZGVJbmRleCAtIDE7XG5cbiAgICAgICAgaWYgKGFjdGl2ZVNsaWRlSGFzQnVsbGV0QnlPZmZzZXQoLTEpKSB7XG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQoYWN0aXZlU2xpZGVJbmRleCwgYWN0aXZlQnVsbGV0SW5kZXggLSAxKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoYnVsbGV0c1twcmV2U2xpZGVJbmRleF0pIHtcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChwcmV2U2xpZGVJbmRleCwgYnVsbGV0c1twcmV2U2xpZGVJbmRleF0ubGVuZ3RoIC0gMSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIGFjdGl2YXRlQnVsbGV0ID0gZnVuY3Rpb24oc2xpZGVJbmRleCwgYnVsbGV0SW5kZXgpIHtcbiAgICAgICAgYWN0aXZlU2xpZGVJbmRleCA9IHNsaWRlSW5kZXg7XG4gICAgICAgIGFjdGl2ZUJ1bGxldEluZGV4ID0gYnVsbGV0SW5kZXg7XG5cbiAgICAgICAgYnVsbGV0cy5mb3JFYWNoKGZ1bmN0aW9uKHNsaWRlLCBzKSB7XG4gICAgICAgICAgc2xpZGUuZm9yRWFjaChmdW5jdGlvbihidWxsZXQsIGIpIHtcbiAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldCcpO1xuXG4gICAgICAgICAgICBpZiAocyA8IHNsaWRlSW5kZXggfHwgcyA9PT0gc2xpZGVJbmRleCAmJiBiIDw9IGJ1bGxldEluZGV4KSB7XG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldC1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYnVsbGV0LWluYWN0aXZlJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtaW5hY3RpdmUnKTtcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYnVsbGV0LWFjdGl2ZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocyA9PT0gc2xpZGVJbmRleCAmJiBiID09PSBidWxsZXRJbmRleCkge1xuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtY3VycmVudCcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYnVsbGV0LWN1cnJlbnQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICBhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0ID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBidWxsZXRzW2FjdGl2ZVNsaWRlSW5kZXhdW2FjdGl2ZUJ1bGxldEluZGV4ICsgb2Zmc2V0XSAhPT0gdW5kZWZpbmVkO1xuICAgICAgfTtcblxuICAgIGRlY2sub24oJ25leHQnLCBuZXh0KTtcbiAgICBkZWNrLm9uKCdwcmV2JywgcHJldik7XG5cbiAgICBkZWNrLm9uKCdzbGlkZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGFjdGl2YXRlQnVsbGV0KGUuaW5kZXgsIDApO1xuICAgIH0pO1xuXG4gICAgYWN0aXZhdGVCdWxsZXQoMCwgMCk7XG4gIH07XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICBkZWNrLnNsaWRlcy5mb3JFYWNoKGZ1bmN0aW9uKHNsaWRlKSB7XG4gICAgICBzbGlkZS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoL0lOUFVUfFRFWFRBUkVBfFNFTEVDVC8udGVzdChlLnRhcmdldC5ub2RlTmFtZSkgfHwgZS50YXJnZXQuY29udGVudEVkaXRhYmxlID09PSAndHJ1ZScpIHtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZGVjaykge1xuICAgIHZhciBvcHRpb25zID0gb3B0aW9ucyA9PT0gdW5kZWZpbmVkID8ge30gOiBvcHRpb25zO1xuXG4gICAgdmFyIGRpcmVjdGlvbiA9IG9wdGlvbnMuZGlyZWN0aW9uID09PSB1bmRlZmluZWQgfHwgb3B0aW9ucy5kaXJlY3Rpb24gPT09IG51bGwgPyAnaG9yaXpvbnRhbCcgOiBvcHRpb25zLmRpcmVjdGlvbjtcbiAgICB2YXIgZGVmYXVsdF9heGlzID0gZGlyZWN0aW9uID09PSAndmVydGljYWwnID8gJ1knIDogJ1gnO1xuICAgIHZhciB0cmFuc2l0aW9uID0gb3B0aW9ucy50cmFuc2l0aW9uID8gb3B0aW9ucy50cmFuc2l0aW9uIDogJ21vdmUnO1xuICAgIHZhciByZXZlcnNlID0gb3B0aW9ucy5yZXZlcnNlID8gb3B0aW9ucy5yZXZlcnNlIDogZmFsc2U7XG4gICAgdmFyIHBsdWdpbiA9IHtcbiAgICAgIGZ4OiB7XG4gICAgICAgICdtb3ZlJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnbW92ZS10by1sZWZ0LWZyb20tcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnbW92ZS10by1yaWdodC1mcm9tLWxlZnQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ21vdmUtdG8tdG9wLWZyb20tYm90dG9tJyxcbiAgICAgICAgICAgICdwcmV2JzogJ21vdmUtdG8tYm90dG9tLWZyb20tdG9wJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtZmFkZSc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2ZhZGUtZnJvbS1yaWdodCcsXG4gICAgICAgICAgICAncHJldic6ICdmYWRlLWZyb20tbGVmdCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZmFkZS1mcm9tLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdmYWRlLWZyb20tdG9wJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtYm90aC1mYWRlJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZmFkZS1sZWZ0LWZhZGUtcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZmFkZS1yaWdodC1mYWRlLWxlZnQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2ZhZGUtdG9wLWZhZGUtYm90dG9tJyxcbiAgICAgICAgICAgICdwcmV2JzogJ2ZhZGUtYm90dG9tLWZhZGUtdG9wJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtZGlmZmVyZW50LWVhc2luZyc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1yaWdodCcsXG4gICAgICAgICAgICAncHJldic6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tbGVmdCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZGlmZmVyZW50LWVhc2luZy1mcm9tLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tdG9wJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ3NjYWxlLWRvd24tb3V0LW1vdmUtaW4nOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdzY2FsZS1kb3duLWZyb20tcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnbW92ZS10by1yaWdodC1zY2FsZS11cCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnc2NhbGUtZG93bi1mcm9tLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdtb3ZlLXRvLWJvdHRvbS1zY2FsZS11cCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLW91dC1zY2FsZS11cCc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ21vdmUtdG8tbGVmdC1zY2FsZS11cCcsXG4gICAgICAgICAgICAncHJldic6ICdzY2FsZS1kb3duLWZyb20tbGVmdCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnbW92ZS10by10b3Atc2NhbGUtdXAnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnc2NhbGUtZG93bi1mcm9tLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdzY2FsZS11cC11cCc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3NjYWxlLXVwLXNjYWxlLXVwJyxcbiAgICAgICAgICAgICdwcmV2JzogJ3NjYWxlLWRvd24tc2NhbGUtZG93bidcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnc2NhbGUtdXAtc2NhbGUtdXAnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnc2NhbGUtZG93bi1zY2FsZS1kb3duJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ3NjYWxlLWRvd24tdXAnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdzY2FsZS1kb3duLXNjYWxlLXVwJyxcbiAgICAgICAgICAgICdwcmV2JzogJ3NjYWxlLWRvd24tc2NhbGUtdXAnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3NjYWxlLWRvd24tc2NhbGUtdXAnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnc2NhbGUtZG93bi1zY2FsZS11cCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdnbHVlJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZ2x1ZS1sZWZ0LWZyb20tcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZ2x1ZS1yaWdodC1mcm9tLWxlZnQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2dsdWUtdG9wLWZyb20tYm90dG9tJyxcbiAgICAgICAgICAgICdwcmV2JzogJ2dsdWUtYm90dG9tLWZyb20tdG9wJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ2ZsaXAnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdmbGlwLWxlZnQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZmxpcC1yaWdodCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZmxpcC10b3AnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZmxpcC1ib3R0b20nXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnZmFsbCc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2ZhbGwnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZmFsbCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZmFsbCcsXG4gICAgICAgICAgICAncHJldic6ICdmYWxsJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ25ld3NwYXBlcic6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ25ld3NwYXBlcicsXG4gICAgICAgICAgICAncHJldic6ICduZXdzcGFwZXInXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ25ld3NwYXBlcicsXG4gICAgICAgICAgICAncHJldic6ICduZXdzcGFwZXInXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAncHVzaCc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3B1c2gtbGVmdC1mcm9tLXJpZ2h0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ3B1c2gtcmlnaHQtZnJvbS1sZWZ0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdwdXNoLXRvcC1mcm9tLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdwdXNoLWJvdHRvbS1mcm9tLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdwdWxsJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAncHVzaC1sZWZ0LXB1bGwtcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAncHVzaC1yaWdodC1wdWxsLWxlZnQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3B1c2gtYm90dG9tLXB1bGwtdG9wJyxcbiAgICAgICAgICAgICdwcmV2JzogJ3B1c2gtdG9wLXB1bGwtYm90dG9tJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ2ZvbGQnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdmb2xkLWxlZnQtZnJvbS1yaWdodCcsXG4gICAgICAgICAgICAncHJldic6ICdtb3ZlLXRvLXJpZ2h0LXVuZm9sZC1sZWZ0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdmb2xkLWJvdHRvbS1mcm9tLXRvcCcsXG4gICAgICAgICAgICAncHJldic6ICdtb3ZlLXRvLXRvcC11bmZvbGQtYm90dG9tJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ3VuZm9sZCc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ21vdmUtdG8tbGVmdC11bmZvbGQtcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZm9sZC1yaWdodC1mcm9tLWxlZnQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ21vdmUtdG8tYm90dG9tLXVuZm9sZC10b3AnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZm9sZC10b3AtZnJvbS1ib3R0b20nXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAncm9vbSc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3Jvb20tdG8tbGVmdCcsXG4gICAgICAgICAgICAncHJldic6ICdyb29tLXRvLXJpZ2h0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdyb29tLXRvLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdyb29tLXRvLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdjdWJlJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnY3ViZS10by1sZWZ0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ2N1YmUtdG8tcmlnaHQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2N1YmUtdG8tYm90dG9tJyxcbiAgICAgICAgICAgICdwcmV2JzogJ2N1YmUtdG8tdG9wJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ2Nhcm91c2VsJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnY2Fyb3VzZWwtdG8tbGVmdCcsXG4gICAgICAgICAgICAncHJldic6ICdjYXJvdXNlbC10by1yaWdodCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnY2Fyb3VzZWwtdG8tYm90dG9tJyxcbiAgICAgICAgICAgICdwcmV2JzogJ2Nhcm91c2VsLXRvLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdzaWRlcyc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3NpZGVzJyxcbiAgICAgICAgICAgICdwcmV2JzogJ3NpZGVzJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdzaWRlcycsXG4gICAgICAgICAgICAncHJldic6ICdzaWRlcydcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdzbGlkZSc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3NsaWRlJyxcbiAgICAgICAgICAgICdwcmV2JzogJ3NsaWRlJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdzbGlkZScsXG4gICAgICAgICAgICAncHJldic6ICdzbGlkZSdcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBhbmltYXRpb25zOiB7XG4gICAgICAgIC8vIE1vdmVcbiAgICAgICAgJ21vdmUtdG8tbGVmdC1mcm9tLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiAxLFxuICAgICAgICAgIGdyb3VwOiAnbW92ZScsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIGxlZnQgLyBmcm9tIHJpZ2h0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb0xlZnQnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0JyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1yaWdodC1mcm9tLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLXRvLXJpZ2h0LWZyb20tbGVmdCc6IHtcbiAgICAgICAgICBpZDogMixcbiAgICAgICAgICBncm91cDogJ21vdmUnLFxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byByaWdodCAvIGZyb20gbGVmdCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9SaWdodCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tbGVmdC1mcm9tLXJpZ2h0J1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by10b3AtZnJvbS1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDMsXG4gICAgICAgICAgZ3JvdXA6ICdtb3ZlJyxcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gdG9wIC8gZnJvbSBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvVG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b20nLFxuICAgICAgICAgIHJldmVyc2U6ICdtb3ZlLXRvLWJvdHRvbS1mcm9tLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtdG8tYm90dG9tLWZyb20tdG9wJzoge1xuICAgICAgICAgIGlkOiA0LFxuICAgICAgICAgIGdyb3VwOiAnbW92ZScsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIGJvdHRvbSAvIGZyb20gdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb0JvdHRvbScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tVG9wJyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by10b3AtZnJvbS1ib3R0b20nXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gRmFkZVxuICAgICAgICAnZmFkZS1mcm9tLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiA1LFxuICAgICAgICAgIGdyb3VwOiAnZmFkZScsXG4gICAgICAgICAgbGFiZWw6ICdGYWRlIC8gZnJvbSByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1mYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21SaWdodCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhZGUtZnJvbS1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAnZmFkZS1mcm9tLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDYsXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgLyBmcm9tIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtZmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhZGUtZnJvbS1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZhZGUtZnJvbS1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDcsXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgLyBmcm9tIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1mYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b20gZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWZyb20tdG9wJ1xuICAgICAgICB9LFxuICAgICAgICAnZmFkZS1mcm9tLXRvcCc6IHtcbiAgICAgICAgICBpZDogOCxcbiAgICAgICAgICBncm91cDogJ2ZhZGUnLFxuICAgICAgICAgIGxhYmVsOiAnRmFkZSAvIGZyb20gdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZhZGUnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhZGUtZnJvbS1ib3R0b20nXG4gICAgICAgIH0sXG4gICAgICAgICdmYWRlLWxlZnQtZmFkZS1yaWdodCc6IHtcbiAgICAgICAgICBpZDogOSxcbiAgICAgICAgICBncm91cDogJ2ZhZGUnLFxuICAgICAgICAgIGxhYmVsOiAnRmFkZSBsZWZ0IC8gRmFkZSByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9MZWZ0RmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tUmlnaHRGYWRlJyxcbiAgICAgICAgICByZXZlcnNlOiAnZmFkZS1yaWdodC1mYWRlLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdmYWRlLXJpZ2h0LWZhZGUtbGVmdCc6IHtcbiAgICAgICAgICBpZDogMTAsXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgcmlnaHQgLyBGYWRlIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvUmlnaHRGYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21MZWZ0RmFkZScsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhZGUtbGVmdC1mYWRlLXJpZ2h0J1xuICAgICAgICB9LFxuICAgICAgICAnZmFkZS10b3AtZmFkZS1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDExLFxuICAgICAgICAgIGdyb3VwOiAnZmFkZScsXG4gICAgICAgICAgbGFiZWw6ICdGYWRlIHRvcCAvIEZhZGUgYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1RvcEZhZGUnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUJvdHRvbUZhZGUnLFxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWJvdHRvbS1mYWRlLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZhZGUtYm90dG9tLWZhZGUtdG9wJzoge1xuICAgICAgICAgIGlkOiAxMixcbiAgICAgICAgICBncm91cDogJ2ZhZGUnLFxuICAgICAgICAgIGxhYmVsOiAnRmFkZSBib3R0b20gLyBGYWRlIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Cb3R0b21GYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Ub3BGYWRlJyxcbiAgICAgICAgICByZXZlcnNlOiAnZmFkZS10b3AtZmFkZS1ib3R0b20nXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gRGlmZmVyZW50IGVhc2luZ1xuICAgICAgICAnZGlmZmVyZW50LWVhc2luZy1mcm9tLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiAxMyxcbiAgICAgICAgICBncm91cDogJ2RpZmZlcmVudC1lYXNpbmcnLFxuICAgICAgICAgIGxhYmVsOiAnRGlmZmVyZW50IGVhc2luZyAvIGZyb20gcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvTGVmdEVhc2luZyBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tUmlnaHQnLFxuICAgICAgICAgIHJldmVyc2U6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tbGVmdCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiAxNCxcbiAgICAgICAgICBncm91cDogJ2RpZmZlcmVudC1lYXNpbmcnLFxuICAgICAgICAgIGxhYmVsOiAnRGlmZmVyZW50IGVhc2luZyAvIGZyb20gbGVmdCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9SaWdodEVhc2luZyBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDE1LFxuICAgICAgICAgIGdyb3VwOiAnZGlmZmVyZW50LWVhc2luZycsXG4gICAgICAgICAgbGFiZWw6ICdEaWZmZXJlbnQgZWFzaW5nIC8gZnJvbSBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvVG9wRWFzaW5nIGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b20nLFxuICAgICAgICAgIHJldmVyc2U6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tdG9wJ1xuICAgICAgICB9LFxuICAgICAgICAnZGlmZmVyZW50LWVhc2luZy1mcm9tLXRvcCc6IHtcbiAgICAgICAgICBpZDogMTYsXG4gICAgICAgICAgZ3JvdXA6ICdkaWZmZXJlbnQtZWFzaW5nJyxcbiAgICAgICAgICBsYWJlbDogJ0RpZmZlcmVudCBlYXNpbmcgLyBmcm9tIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Cb3R0b21FYXNpbmcgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1ib3R0b20nXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gU2NhbGVcbiAgICAgICAgJ3NjYWxlLWRvd24tZnJvbS1yaWdodCc6IHtcbiAgICAgICAgICBpZDogMTcsXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXG4gICAgICAgICAgbGFiZWw6ICdTY2FsZSBkb3duIC8gZnJvbSByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1zY2FsZURvd24nLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1yaWdodC1zY2FsZS11cCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3NjYWxlLWRvd24tZnJvbS1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiAxOCxcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcbiAgICAgICAgICBsYWJlbDogJ1NjYWxlIGRvd24gLyBmcm9tIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtc2NhbGVEb3duJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21MZWZ0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1sZWZ0LXNjYWxlLXVwJ1xuICAgICAgICB9LFxuICAgICAgICAnc2NhbGUtZG93bi1mcm9tLWJvdHRvbSc6IHtcbiAgICAgICAgICBpZDogMTksXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXG4gICAgICAgICAgbGFiZWw6ICdTY2FsZSBkb3duIC8gZnJvbSBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtc2NhbGVEb3duJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b20gZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdtb3ZlLXRvLWJvdHRvbS1zY2FsZS11cCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3NjYWxlLWRvd24tZnJvbS10b3AnOiB7XG4gICAgICAgICAgaWQ6IDIwLFxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxuICAgICAgICAgIGxhYmVsOiAnU2NhbGUgZG93biAvIGZyb20gdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93bicsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tVG9wIGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by10b3Atc2NhbGUtdXAnXG4gICAgICAgIH0sXG4gICAgICAgICdzY2FsZS1kb3duLXNjYWxlLWRvd24nOiB7XG4gICAgICAgICAgaWQ6IDIxLFxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxuICAgICAgICAgIGxhYmVsOiAnU2NhbGUgZG93biAvIHNjYWxlIGRvd24nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtc2NhbGVEb3duJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcERvd24gZngtc2xpZGUtZGVsYXkzMDAnLFxuICAgICAgICAgIHJldmVyc2U6ICdzY2FsZS11cC1zY2FsZS11cCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3NjYWxlLXVwLXNjYWxlLXVwJzoge1xuICAgICAgICAgIGlkOiAyMixcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcbiAgICAgICAgICBsYWJlbDogJ1NjYWxlIHVwIC8gc2NhbGUgdXAnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtc2NhbGVEb3duVXAnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1zY2FsZVVwIGZ4LXNsaWRlLWRlbGF5MzAwJyxcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1zY2FsZS1kb3duJ1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by1sZWZ0LXNjYWxlLXVwJzoge1xuICAgICAgICAgIGlkOiAyMyxcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gbGVmdCAvIHNjYWxlIHVwJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb0xlZnQgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1zY2FsZVVwJyxcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1mcm9tLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLXRvLXJpZ2h0LXNjYWxlLXVwJzoge1xuICAgICAgICAgIGlkOiAyNCxcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gcmlnaHQgLyBzY2FsZSB1cCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9SaWdodCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXNjYWxlVXAnLFxuICAgICAgICAgIHJldmVyc2U6ICdzY2FsZS1kb3duLWZyb20tcmlnaHQnXG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLXRvLXRvcC1zY2FsZS11cCc6IHtcbiAgICAgICAgICBpZDogMjUsXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIHRvcCAvIHNjYWxlIHVwJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1RvcCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXNjYWxlVXAnLFxuICAgICAgICAgIHJldmVyc2U6ICdzY2FsZS1kb3duLWZyb20tdG9wJ1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by1ib3R0b20tc2NhbGUtdXAnOiB7XG4gICAgICAgICAgaWQ6IDI2LFxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byBib3R0b20gLyBzY2FsZSB1cCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Cb3R0b20gZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1zY2FsZVVwJyxcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1mcm9tLWJvdHRvbSdcbiAgICAgICAgfSxcbiAgICAgICAgJ3NjYWxlLWRvd24tc2NhbGUtdXAnOiB7XG4gICAgICAgICAgaWQ6IDI3LFxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxuICAgICAgICAgIGxhYmVsOiAnU2NhbGUgZG93biAvIHNjYWxlIHVwJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93bkNlbnRlcicsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXNjYWxlVXBDZW50ZXIgZngtc2xpZGUtZGVsYXk0MDAnLFxuICAgICAgICAgIHJldmVyc2U6ICdzY2FsZS1kb3duLXNjYWxlLXVwJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFJvdGF0ZTogR2x1ZVxuICAgICAgICAnZ2x1ZS1sZWZ0LWZyb20tcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDI4LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmdsdWUnLFxuICAgICAgICAgIGxhYmVsOiAnR2x1ZSBsZWZ0IC8gZnJvbSByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSaWdodFNpZGVGaXJzdCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tUmlnaHQgZngtc2xpZGUtZGVsYXkyMDAgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdnbHVlLXJpZ2h0LWZyb20tbGVmdCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2dsdWUtcmlnaHQtZnJvbS1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiAyOSxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpnbHVlJyxcbiAgICAgICAgICBsYWJlbDogJ0dsdWUgcmlnaHQgLyBmcm9tIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlTGVmdFNpZGVGaXJzdCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdCBmeC1zbGlkZS1kZWxheTIwMCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2dsdWUtbGVmdC1mcm9tLXJpZ2h0J1xuICAgICAgICB9LFxuICAgICAgICAnZ2x1ZS1ib3R0b20tZnJvbS10b3AnOiB7XG4gICAgICAgICAgaWQ6IDMwLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmdsdWUnLFxuICAgICAgICAgIGxhYmVsOiAnR2x1ZSBib3R0b20gLyBmcm9tIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVUb3BTaWRlRmlyc3QnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcCBmeC1zbGlkZS1kZWxheTIwMCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2dsdWUtdG9wLWZyb20tYm90dG9tJ1xuICAgICAgICB9LFxuICAgICAgICAnZ2x1ZS10b3AtZnJvbS1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDMxLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmdsdWUnLFxuICAgICAgICAgIGxhYmVsOiAnR2x1ZSB0b3AgLyBmcm9tIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVCb3R0b21TaWRlRmlyc3QnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUJvdHRvbSBmeC1zbGlkZS1kZWxheTIwMCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2dsdWUtYm90dG9tLWZyb20tdG9wJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFJvdGF0ZTogRmxpcFxuICAgICAgICAnZmxpcC1yaWdodCc6IHtcbiAgICAgICAgICBpZDogMzIsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6ZmxpcCcsXG4gICAgICAgICAgbGFiZWw6ICdGbGlwIHJpZ2h0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZsaXBPdXRSaWdodCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLWZsaXBJbkxlZnQgZngtc2xpZGUtZGVsYXk1MDAnLFxuICAgICAgICAgIHJldmVyc2U6ICdmbGlwLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdmbGlwLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDMzLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZsaXAnLFxuICAgICAgICAgIGxhYmVsOiAnRmxpcCBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZsaXBPdXRMZWZ0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtZmxpcEluUmlnaHQgZngtc2xpZGUtZGVsYXk1MDAnLFxuICAgICAgICAgIHJldmVyc2U6ICdmbGlwLXJpZ2h0J1xuICAgICAgICB9LFxuICAgICAgICAnZmxpcC10b3AnOiB7XG4gICAgICAgICAgaWQ6IDM0LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZsaXAnLFxuICAgICAgICAgIGxhYmVsOiAnRmxpcCB0b3AnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtZmxpcE91dFRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLWZsaXBJbkJvdHRvbSBmeC1zbGlkZS1kZWxheTUwMCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZsaXAtYm90dG9tJ1xuICAgICAgICB9LFxuICAgICAgICAnZmxpcC1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDM1LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZsaXAnLFxuICAgICAgICAgIGxhYmVsOiAnRmxpcCBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtZmxpcE91dEJvdHRvbScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLWZsaXBJblRvcCBmeC1zbGlkZS1kZWxheTUwMCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZsaXAtdG9wJ1xuICAgICAgICB9LFxuICAgICAgICAnZmFsbCc6IHtcbiAgICAgICAgICBpZDogMzYsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGUnLFxuICAgICAgICAgIGxhYmVsOiAnRmFsbCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVGYWxsIGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhbGwnXG4gICAgICAgIH0sXG4gICAgICAgICduZXdzcGFwZXInOiB7XG4gICAgICAgICAgaWQ6IDM3LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlJyxcbiAgICAgICAgICBsYWJlbDogJ05ld3NwYXBlcicsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVPdXROZXdzcGFwZXInLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVJbk5ld3NwYXBlciBmeC1zbGlkZS1kZWxheTUwMCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ25ld3NwYXBlcidcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBQdXNoIC8gUHVsbFxuICAgICAgICAncHVzaC1sZWZ0LWZyb20tcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDM4LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnB1c2gtcHVsbCcsXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIGxlZnQgLyBmcm9tIHJpZ2h0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hMZWZ0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21SaWdodCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtcmlnaHQtZnJvbS1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAncHVzaC1yaWdodC1mcm9tLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDM5LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnB1c2gtcHVsbCcsXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIHJpZ2h0IC8gZnJvbSBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hSaWdodCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtbGVmdC1mcm9tLXJpZ2h0J1xuICAgICAgICB9LFxuICAgICAgICAncHVzaC10b3AtZnJvbS1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDQwLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnB1c2gtcHVsbCcsXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIHRvcCAvIGZyb20gYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hUb3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUJvdHRvbScsXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtYm90dG9tLWZyb20tdG9wJ1xuICAgICAgICB9LFxuICAgICAgICAncHVzaC1ib3R0b20tZnJvbS10b3AnOiB7XG4gICAgICAgICAgaWQ6IDQxLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnB1c2gtcHVsbCcsXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIGJvdHRvbSAvIGZyb20gdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hCb3R0b20nLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtdG9wLWZyb20tYm90dG9tJ1xuICAgICAgICB9LFxuICAgICAgICAncHVzaC1sZWZ0LXB1bGwtcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDQyLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnB1c2gtcHVsbCcsXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIGxlZnQgLyBwdWxsIHJpZ2h0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hMZWZ0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVsbFJpZ2h0IGZ4LXNsaWRlLWRlbGF5MTgwJyxcbiAgICAgICAgICByZXZlcnNlOiAncHVzaC1yaWdodC1wdWxsLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdwdXNoLXJpZ2h0LXB1bGwtbGVmdCc6IHtcbiAgICAgICAgICBpZDogNDMsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cHVzaC1wdWxsJyxcbiAgICAgICAgICBsYWJlbDogJ1B1c2ggcmlnaHQgLyBwdWxsIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVzaFJpZ2h0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVsbExlZnQgZngtc2xpZGUtZGVsYXkxODAnLFxuICAgICAgICAgIHJldmVyc2U6ICdwdXNoLWxlZnQtcHVsbC1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3B1c2gtdG9wLXB1bGwtYm90dG9tJzoge1xuICAgICAgICAgIGlkOiA0NCxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxuICAgICAgICAgIGxhYmVsOiAnUHVzaCB0b3AgLyBwdWxsIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdXNoVG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVsbEJvdHRvbSBmeC1zbGlkZS1kZWxheTE4MCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtYm90dG9tLXB1bGwtdG9wJ1xuICAgICAgICB9LFxuICAgICAgICAncHVzaC1ib3R0b20tcHVsbC10b3AnOiB7XG4gICAgICAgICAgaWQ6IDQ1LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnB1c2gtcHVsbCcsXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIGJvdHRvbSAvIHB1bGwgdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hCb3R0b20nLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdWxsVG9wIGZ4LXNsaWRlLWRlbGF5MTgwJyxcbiAgICAgICAgICByZXZlcnNlOiAncHVzaC10b3AtcHVsbC1ib3R0b20nXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gRm9sZCAvIFVuZm9sZFxuICAgICAgICAnZm9sZC1sZWZ0LWZyb20tcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDQ2LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZvbGQtdW5mb2xkJyxcbiAgICAgICAgICBsYWJlbDogJ0ZvbGQgbGVmdCAvIGZyb20gcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlRm9sZExlZnQnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0RmFkZScsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tcmlnaHQtdW5mb2xkLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdmb2xkLXJpZ2h0LWZyb20tbGVmdCc6IHtcbiAgICAgICAgICBpZDogNDcsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Zm9sZC11bmZvbGQnLFxuICAgICAgICAgIGxhYmVsOiAnRm9sZCByaWdodCAvIGZyb20gbGVmdCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVGb2xkUmlnaHQnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUxlZnRGYWRlJyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1sZWZ0LXVuZm9sZC1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZvbGQtdG9wLWZyb20tYm90dG9tJzoge1xuICAgICAgICAgIGlkOiA0OCxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXG4gICAgICAgICAgbGFiZWw6ICdGb2xkIHRvcCAvIGZyb20gYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUZvbGRUb3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUJvdHRvbUZhZGUnLFxuICAgICAgICAgIHJldmVyc2U6ICdtb3ZlLXRvLWJvdHRvbS11bmZvbGQtdG9wJ1xuICAgICAgICB9LFxuICAgICAgICAnZm9sZC1ib3R0b20tZnJvbS10b3AnOiB7XG4gICAgICAgICAgaWQ6IDQ5LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZvbGQtdW5mb2xkJyxcbiAgICAgICAgICBsYWJlbDogJ0ZvbGQgYm90dG9tIC8gZnJvbSB0b3AnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlRm9sZEJvdHRvbScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tVG9wRmFkZScsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tdG9wLXVuZm9sZC1ib3R0b20nXG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLXRvLXJpZ2h0LXVuZm9sZC1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiA1MCxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIHJpZ2h0IC8gdW5mb2xkIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvUmlnaHRGYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlVW5mb2xkTGVmdCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZvbGQtbGVmdC1mcm9tLXJpZ2h0J1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by1sZWZ0LXVuZm9sZC1yaWdodCc6IHtcbiAgICAgICAgICBpZDogNTEsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Zm9sZC11bmZvbGQnLFxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byBsZWZ0IC8gdW5mb2xkIHJpZ2h0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb0xlZnRGYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlVW5mb2xkUmlnaHQnLFxuICAgICAgICAgIHJldmVyc2U6ICdmb2xkLXJpZ2h0LWZyb20tbGVmdCdcbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtdG8tYm90dG9tLXVuZm9sZC10b3AnOiB7XG4gICAgICAgICAgaWQ6IDUyLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZvbGQtdW5mb2xkJyxcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gYm90dG9tIC8gdW5mb2xkIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Cb3R0b21GYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlVW5mb2xkVG9wJyxcbiAgICAgICAgICByZXZlcnNlOiAnZm9sZC10b3AtZnJvbS1ib3R0b20nXG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLXRvLXRvcC11bmZvbGQtYm90dG9tJzoge1xuICAgICAgICAgIGlkOiA1MyxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIHRvcCAvIHVuZm9sZCBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvVG9wRmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVVuZm9sZEJvdHRvbScsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZvbGQtYm90dG9tLWZyb20tdG9wJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFJvb21cbiAgICAgICAgJ3Jvb20tdG8tbGVmdCc6IHtcbiAgICAgICAgICBpZDogNTQsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cm9vbScsXG4gICAgICAgICAgbGFiZWw6ICdSb29tIHRvIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbUxlZnRPdXQgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tTGVmdEluJyxcbiAgICAgICAgICByZXZlcnNlOiAncm9vbS10by1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3Jvb20tdG8tcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDU1LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnJvb20nLFxuICAgICAgICAgIGxhYmVsOiAnUm9vbSB0byByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tUmlnaHRPdXQgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tUmlnaHRJbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ3Jvb20tdG8tbGVmdCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3Jvb20tdG8tdG9wJzoge1xuICAgICAgICAgIGlkOiA1NixcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpyb29tJyxcbiAgICAgICAgICBsYWJlbDogJ1Jvb20gdG8gdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVJvb21Ub3BPdXQgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tVG9wSW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdyb29tLXRvLWJvdHRvbSdcbiAgICAgICAgfSxcbiAgICAgICAgJ3Jvb20tdG8tYm90dG9tJzoge1xuICAgICAgICAgIGlkOiA1NyxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpyb29tJyxcbiAgICAgICAgICBsYWJlbDogJ1Jvb20gdG8gYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVJvb21Cb3R0b21PdXQgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tQm90dG9tSW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdyb29tLXRvLXRvcCdcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBDdWJlXG4gICAgICAgICdjdWJlLXRvLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDU4LFxuICAgICAgICAgIGxhYmVsOiAnQ3ViZSB0byBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVMZWZ0T3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZUxlZnRJbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ2N1YmUtdG8tcmlnaHQnXG4gICAgICAgIH0sXG4gICAgICAgICdjdWJlLXRvLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiA1OSxcbiAgICAgICAgICBsYWJlbDogJ0N1YmUgdG8gcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZVJpZ2h0T3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZVJpZ2h0SW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdjdWJlLXRvLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdjdWJlLXRvLXRvcCc6IHtcbiAgICAgICAgICBpZDogNjAsXG4gICAgICAgICAgbGFiZWw6ICdDdWJlIHRvIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDdWJlVG9wT3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZVRvcEluJyxcbiAgICAgICAgICByZXZlcnNlOiAnY3ViZS10by1ib3R0b20nXG4gICAgICAgIH0sXG4gICAgICAgICdjdWJlLXRvLWJvdHRvbSc6IHtcbiAgICAgICAgICBpZDogNjEsXG4gICAgICAgICAgbGFiZWw6ICdDdWJlIHRvIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDdWJlQm90dG9tT3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZUJvdHRvbUluJyxcbiAgICAgICAgICByZXZlcnNlOiAnY3ViZS10by10b3AnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gQ2Fyb3VzZWxcbiAgICAgICAgJ2Nhcm91c2VsLXRvLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDYyLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmNhcm91c2VsJyxcbiAgICAgICAgICBsYWJlbDogJ0Nhcm91c2VsIHRvIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlQ2Fyb3VzZWxMZWZ0T3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ2Fyb3VzZWxMZWZ0SW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdjYXJvdXNlbC10by1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2Nhcm91c2VsLXRvLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiA2MyxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpjYXJvdXNlbCcsXG4gICAgICAgICAgbGFiZWw6ICdDYXJvdXNlbCB0byByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDYXJvdXNlbFJpZ2h0T3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ2Fyb3VzZWxSaWdodEluJyxcbiAgICAgICAgICByZXZlcnNlOiAnY2Fyb3VzZWwtdG8tbGVmdCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2Nhcm91c2VsLXRvLXRvcCc6IHtcbiAgICAgICAgICBpZDogNjQsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Y2Fyb3VzZWwnLFxuICAgICAgICAgIGxhYmVsOiAnQ2Fyb3VzZWwgdG8gdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsVG9wT3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ2Fyb3VzZWxUb3BJbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ2Nhcm91c2VsLXRvLWJvdHRvbSdcbiAgICAgICAgfSxcbiAgICAgICAgJ2Nhcm91c2VsLXRvLWJvdHRvbSc6IHtcbiAgICAgICAgICBpZDogNjUsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Y2Fyb3VzZWwnLFxuICAgICAgICAgIGxhYmVsOiAnQ2Fyb3VzZWwgdG8gYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsQm90dG9tT3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ2Fyb3VzZWxCb3R0b21JbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ2Nhcm91c2VsLXRvLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3NpZGVzJzoge1xuICAgICAgICAgIGlkOiA2NixcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZScsXG4gICAgICAgICAgbGFiZWw6ICdTaWRlcycsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVTaWRlc091dCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVNpZGVzSW4gZngtc2xpZGUtZGVsYXkyMDAnLFxuICAgICAgICAgIHJldmVyc2U6ICdzaWRlcydcbiAgICAgICAgfSxcbiAgICAgICAgJ3NsaWRlJzoge1xuICAgICAgICAgIGlkOiA2NyxcbiAgICAgICAgICBsYWJlbDogJ1NsaWRlJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVNsaWRlT3V0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlU2xpZGVJbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ3NsaWRlJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZ2V0QXhpc0Zyb21EaXJlY3Rpb246IGZ1bmN0aW9uIChkaXJlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIGRpcmVjdGlvbiA9PT0gJ3ZlcnRpY2FsJyA/ICdZJyA6ICdYJztcbiAgICAgIH0sXG4gICAgICBhZGRDbGFzc05hbWVzOiBmdW5jdGlvbiAoZWxlbWVudCwgY2xhc3NOYW1lcykge1xuICAgICAgICB2YXIgbmFtZXMgPSBjbGFzc05hbWVzLnNwbGl0KCcgJyk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQobmFtZXNbaV0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgcmVtb3ZlQ2xhc3NOYW1lczogZnVuY3Rpb24gKGVsZW1lbnQsIGNsYXNzTmFtZXMpIHtcbiAgICAgICAgdmFyIG5hbWVzID0gY2xhc3NOYW1lcy5zcGxpdCgnICcpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKG5hbWVzW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHByZXY6IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBpZiAoZXZlbnQuaW5kZXggPiAwICYmICFldmVudC50cmFuc2l0aW9uX2NvbXBsZXRlKSB7XG4gICAgICAgICAgdmFyIG91dFNsaWRlID0gZXZlbnQuc2xpZGU7XG4gICAgICAgICAgdmFyIGluU2xpZGUgPSBkZWNrLnNsaWRlc1tldmVudC5pbmRleCAtIDFdO1xuXG4gICAgICAgICAgdGhpcy5kb1RyYW5zaXRpb24ob3V0U2xpZGUsIGluU2xpZGUsICdwcmV2Jyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBuZXh0OiBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgY29uc29sZS5sb2coZXZlbnQpO1xuICAgICAgICBpZiAoZXZlbnQuaW5kZXggPCBkZWNrLnNsaWRlcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgdmFyIG91dFNsaWRlID0gZXZlbnQuc2xpZGU7XG4gICAgICAgICAgdmFyIGluU2xpZGUgPSBkZWNrLnNsaWRlc1tldmVudC5pbmRleCArIDFdO1xuXG4gICAgICAgICAgdGhpcy5kb1RyYW5zaXRpb24ob3V0U2xpZGUsIGluU2xpZGUsICduZXh0Jyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzbGlkZTogZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudC5zbGlkZSkge1xuICAgICAgICAgIHZhciBvdXRTbGlkZUluZGV4ID0gZGVjay5zbGlkZSgpO1xuICAgICAgICAgIHZhciBvdXRTbGlkZSA9IGRlY2suc2xpZGVzW291dFNsaWRlSW5kZXhdO1xuICAgICAgICAgIHZhciBpblNsaWRlSW5kZXggPSBldmVudC5pbmRleDtcbiAgICAgICAgICB2YXIgaW5TbGlkZSA9IGV2ZW50LnNsaWRlO1xuICAgICAgICAgIHZhciBkaXJlY3Rpb24gPSAoaW5TbGlkZUluZGV4ID4gb3V0U2xpZGVJbmRleCkgPyAnbmV4dCcgOiAncHJldic7XG4gICAgICAgICAgdGhpcy5kb1RyYW5zaXRpb24ob3V0U2xpZGUsIGluU2xpZGUsIGRpcmVjdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkb1RyYW5zaXRpb246IGZ1bmN0aW9uIChvdXRTbGlkZSwgaW5TbGlkZSwgZGlyZWN0aXZlKSB7XG4gICAgICAgIHZhciBheGlzID0gaW5TbGlkZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYmVzcG9rZS1meC1kaXJlY3Rpb24nKSA/IHRoaXMuZ2V0QXhpc0Zyb21EaXJlY3Rpb24oaW5TbGlkZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYmVzcG9rZS1meC1kaXJlY3Rpb24nKSkgOiBkZWZhdWx0X2F4aXM7XG4gICAgICAgIGlmIChyZXZlcnNlIHx8IGluU2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtZngtcmV2ZXJzZScpID09PSAndHJ1ZScpIHtcbiAgICAgICAgICBkaXJlY3RpdmUgPSBkaXJlY3RpdmUgPT09ICduZXh0JyA/ICdwcmV2JyA6ICduZXh0JztcbiAgICAgICAgfVxuICAgICAgICB2YXIgc2xpZGVfdHJhbnNpdGlvbl9uYW1lID0gaW5TbGlkZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYmVzcG9rZS1meC10cmFuc2l0aW9uJyk7XG4gICAgICAgIHZhciBzbGlkZV90cmFuc2l0aW9uID0gdGhpcy5meFtzbGlkZV90cmFuc2l0aW9uX25hbWVdW2F4aXNdID8gdGhpcy5meFtzbGlkZV90cmFuc2l0aW9uX25hbWVdW2F4aXNdIDogdGhpcy5meFt0cmFuc2l0aW9uXVtheGlzXTtcbiAgICAgICAgdmFyIHRyYW5zaXRpb25fbmFtZSA9IHNsaWRlX3RyYW5zaXRpb25bZGlyZWN0aXZlXTtcbiAgICAgICAgdmFyIG91dENsYXNzID0gdGhpcy5hbmltYXRpb25zW3RyYW5zaXRpb25fbmFtZV0ub3V0Q2xhc3M7XG4gICAgICAgIHZhciBpbkNsYXNzID0gdGhpcy5hbmltYXRpb25zW3RyYW5zaXRpb25fbmFtZV0uaW5DbGFzcztcbiAgICAgICAgdmFyIGJlc3Bva2VGeCA9IHRoaXM7XG4gICAgICAgIG91dFNsaWRlLmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdEFuaW1hdGlvbkVuZCcsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgIGJlc3Bva2VGeC5yZW1vdmVDbGFzc05hbWVzKGV2ZW50LnRhcmdldCwgb3V0Q2xhc3MgKyAnIGZ4LXRyYW5zaXRpb25pbmctb3V0Jyk7XG4gICAgICAgIH0pO1xuICAgICAgICBpblNsaWRlLmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdEFuaW1hdGlvbkVuZCcsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgIGJlc3Bva2VGeC5yZW1vdmVDbGFzc05hbWVzKGV2ZW50LnRhcmdldCwgaW5DbGFzcyArICcgZngtdHJhbnNpdGlvbmluZy1pbicpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5hZGRDbGFzc05hbWVzKG91dFNsaWRlLCBvdXRDbGFzcyArICcgZngtdHJhbnNpdGlvbmluZy1vdXQnKTtcbiAgICAgICAgdGhpcy5hZGRDbGFzc05hbWVzKGluU2xpZGUsIGluQ2xhc3MgKyAnIGZ4LXRyYW5zaXRpb25pbmctaW4nKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVjay5vbignbmV4dCcsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgcGx1Z2luLm5leHQoZXZlbnQpXG4gICAgfSk7XG4gICAgZGVjay5vbigncHJldicsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgcGx1Z2luLnByZXYoZXZlbnQpXG4gICAgfSk7XG4gICAgZGVjay5vbignc2xpZGUnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHBsdWdpbi5zbGlkZShldmVudClcbiAgICB9KTtcbiAgfTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgYWN0aXZhdGVTbGlkZSA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICB2YXIgaW5kZXhUb0FjdGl2YXRlID0gLTEgPCBpbmRleCAmJiBpbmRleCA8IGRlY2suc2xpZGVzLmxlbmd0aCA/IGluZGV4IDogMDtcbiAgICAgIGlmIChpbmRleFRvQWN0aXZhdGUgIT09IGRlY2suc2xpZGUoKSkge1xuICAgICAgICBkZWNrLnNsaWRlKGluZGV4VG9BY3RpdmF0ZSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHZhciBwYXJzZUhhc2ggPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBoYXNoID0gd2luZG93LmxvY2F0aW9uLmhhc2guc2xpY2UoMSksXG4gICAgICAgIHNsaWRlTnVtYmVyT3JOYW1lID0gcGFyc2VJbnQoaGFzaCwgMTApO1xuXG4gICAgICBpZiAoaGFzaCkge1xuICAgICAgICBpZiAoc2xpZGVOdW1iZXJPck5hbWUpIHtcbiAgICAgICAgICBhY3RpdmF0ZVNsaWRlKHNsaWRlTnVtYmVyT3JOYW1lIC0gMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVjay5zbGlkZXMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSwgaSkge1xuICAgICAgICAgICAgaWYgKHNsaWRlLmdldEF0dHJpYnV0ZSgnZGF0YS1iZXNwb2tlLWhhc2gnKSA9PT0gaGFzaCB8fCBzbGlkZS5pZCA9PT0gaGFzaCkge1xuICAgICAgICAgICAgICBhY3RpdmF0ZVNsaWRlKGkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBwYXJzZUhhc2goKTtcblxuICAgICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHZhciBzbGlkZU5hbWUgPSBlLnNsaWRlLmdldEF0dHJpYnV0ZSgnZGF0YS1iZXNwb2tlLWhhc2gnKSB8fCBlLnNsaWRlLmlkO1xuICAgICAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9IHNsaWRlTmFtZSB8fCBlLmluZGV4ICsgMTtcbiAgICAgIH0pO1xuXG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignaGFzaGNoYW5nZScsIHBhcnNlSGFzaCk7XG4gICAgfSwgMCk7XG4gIH07XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XG4gICAgdmFyIGlzSG9yaXpvbnRhbCA9IG9wdGlvbnMgIT09ICd2ZXJ0aWNhbCc7XG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZSkge1xuICAgICAgaWYgKGUud2hpY2ggPT0gMzQgfHwgLy8gUEFHRSBET1dOXG4gICAgICAgIChlLndoaWNoID09IDMyICYmICFlLnNoaWZ0S2V5KSB8fCAvLyBTUEFDRSBXSVRIT1VUIFNISUZUXG4gICAgICAgIChpc0hvcml6b250YWwgJiYgZS53aGljaCA9PSAzOSkgfHwgLy8gUklHSFRcbiAgICAgICAgKCFpc0hvcml6b250YWwgJiYgZS53aGljaCA9PSA0MCkgLy8gRE9XTlxuICAgICAgKSB7IGRlY2submV4dCgpOyB9XG5cbiAgICAgIGlmIChlLndoaWNoID09IDMzIHx8IC8vIFBBR0UgVVBcbiAgICAgICAgKGUud2hpY2ggPT0gMzIgJiYgZS5zaGlmdEtleSkgfHwgLy8gU1BBQ0UgKyBTSElGVFxuICAgICAgICAoaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gMzcpIHx8IC8vIExFRlRcbiAgICAgICAgKCFpc0hvcml6b250YWwgJiYgZS53aGljaCA9PSAzOCkgLy8gVVBcbiAgICAgICkgeyBkZWNrLnByZXYoKTsgfVxuICAgIH0pO1xuICB9O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24gKGRlY2spIHtcbiAgICB2YXIgcHJvZ3Jlc3NQYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcbiAgICAgIHByb2dyZXNzQmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXG4gICAgICBwcm9wID0gb3B0aW9ucyA9PT0gJ3ZlcnRpY2FsJyA/ICdoZWlnaHQnIDogJ3dpZHRoJztcblxuICAgIHByb2dyZXNzUGFyZW50LmNsYXNzTmFtZSA9ICdiZXNwb2tlLXByb2dyZXNzLXBhcmVudCc7XG4gICAgcHJvZ3Jlc3NCYXIuY2xhc3NOYW1lID0gJ2Jlc3Bva2UtcHJvZ3Jlc3MtYmFyJztcbiAgICBwcm9ncmVzc1BhcmVudC5hcHBlbmRDaGlsZChwcm9ncmVzc0Jhcik7XG4gICAgZGVjay5wYXJlbnQuYXBwZW5kQ2hpbGQocHJvZ3Jlc3NQYXJlbnQpO1xuXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XG4gICAgICBwcm9ncmVzc0Jhci5zdHlsZVtwcm9wXSA9IChlLmluZGV4ICogMTAwIC8gKGRlY2suc2xpZGVzLmxlbmd0aCAtIDEpKSArICclJztcbiAgICB9KTtcbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgcGFyZW50ID0gZGVjay5wYXJlbnQsXG4gICAgICBmaXJzdFNsaWRlID0gZGVjay5zbGlkZXNbMF0sXG4gICAgICBzbGlkZUhlaWdodCA9IGZpcnN0U2xpZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgc2xpZGVXaWR0aCA9IGZpcnN0U2xpZGUub2Zmc2V0V2lkdGgsXG4gICAgICB1c2Vab29tID0gb3B0aW9ucyA9PT0gJ3pvb20nIHx8ICgnem9vbScgaW4gcGFyZW50LnN0eWxlICYmIG9wdGlvbnMgIT09ICd0cmFuc2Zvcm0nKSxcblxuICAgICAgd3JhcCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSAnYmVzcG9rZS1zY2FsZS1wYXJlbnQnO1xuICAgICAgICBlbGVtZW50LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHdyYXBwZXIsIGVsZW1lbnQpO1xuICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuICAgICAgICByZXR1cm4gd3JhcHBlcjtcbiAgICAgIH0sXG5cbiAgICAgIGVsZW1lbnRzID0gdXNlWm9vbSA/IGRlY2suc2xpZGVzIDogZGVjay5zbGlkZXMubWFwKHdyYXApLFxuXG4gICAgICB0cmFuc2Zvcm1Qcm9wZXJ0eSA9IChmdW5jdGlvbihwcm9wZXJ0eSkge1xuICAgICAgICB2YXIgcHJlZml4ZXMgPSAnTW96IFdlYmtpdCBPIG1zJy5zcGxpdCgnICcpO1xuICAgICAgICByZXR1cm4gcHJlZml4ZXMucmVkdWNlKGZ1bmN0aW9uKGN1cnJlbnRQcm9wZXJ0eSwgcHJlZml4KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgcHJvcGVydHkgaW4gcGFyZW50LnN0eWxlID8gcHJlZml4ICsgcHJvcGVydHkgOiBjdXJyZW50UHJvcGVydHk7XG4gICAgICAgICAgfSwgcHJvcGVydHkudG9Mb3dlckNhc2UoKSk7XG4gICAgICB9KCdUcmFuc2Zvcm0nKSksXG5cbiAgICAgIHNjYWxlID0gdXNlWm9vbSA/XG4gICAgICAgIGZ1bmN0aW9uKHJhdGlvLCBlbGVtZW50KSB7XG4gICAgICAgICAgZWxlbWVudC5zdHlsZS56b29tID0gcmF0aW87XG4gICAgICAgIH0gOlxuICAgICAgICBmdW5jdGlvbihyYXRpbywgZWxlbWVudCkge1xuICAgICAgICAgIGVsZW1lbnQuc3R5bGVbdHJhbnNmb3JtUHJvcGVydHldID0gJ3NjYWxlKCcgKyByYXRpbyArICcpJztcbiAgICAgICAgfSxcblxuICAgICAgc2NhbGVBbGwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHhTY2FsZSA9IHBhcmVudC5vZmZzZXRXaWR0aCAvIHNsaWRlV2lkdGgsXG4gICAgICAgICAgeVNjYWxlID0gcGFyZW50Lm9mZnNldEhlaWdodCAvIHNsaWRlSGVpZ2h0O1xuXG4gICAgICAgIGVsZW1lbnRzLmZvckVhY2goc2NhbGUuYmluZChudWxsLCBNYXRoLm1pbih4U2NhbGUsIHlTY2FsZSkpKTtcbiAgICAgIH07XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgc2NhbGVBbGwpO1xuICAgIHNjYWxlQWxsKCk7XG4gIH07XG5cbn07XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4vKiFcbiAqIGJlc3Bva2UtdGhlbWUtY3ViZSB2Mi4wLjFcbiAqXG4gKiBDb3B5cmlnaHQgMjAxNCwgTWFyayBEYWxnbGVpc2hcbiAqIFRoaXMgY29udGVudCBpcyByZWxlYXNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2VcbiAqIGh0dHA6Ly9taXQtbGljZW5zZS5vcmcvbWFya2RhbGdsZWlzaFxuICovXG5cbiFmdW5jdGlvbihlKXtpZihcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyltb2R1bGUuZXhwb3J0cz1lKCk7ZWxzZSBpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQpZGVmaW5lKGUpO2Vsc2V7dmFyIG87XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz9vPXdpbmRvdzpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP289Z2xvYmFsOlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmJiYobz1zZWxmKTt2YXIgZj1vO2Y9Zi5iZXNwb2tlfHwoZi5iZXNwb2tlPXt9KSxmPWYudGhlbWVzfHwoZi50aGVtZXM9e30pLGYuY3ViZT1lKCl9fShmdW5jdGlvbigpe3ZhciBkZWZpbmUsbW9kdWxlLGV4cG9ydHM7cmV0dXJuIChmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pKHsxOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcblxudmFyIGNsYXNzZXMgPSBfZGVyZXFfKCdiZXNwb2tlLWNsYXNzZXMnKTtcbnZhciBpbnNlcnRDc3MgPSBfZGVyZXFfKCdpbnNlcnQtY3NzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBjc3MgPSBcIip7LW1vei1ib3gtc2l6aW5nOmJvcmRlci1ib3g7Ym94LXNpemluZzpib3JkZXItYm94O21hcmdpbjowO3BhZGRpbmc6MH1AbWVkaWEgcHJpbnR7Knstd2Via2l0LXByaW50LWNvbG9yLWFkanVzdDpleGFjdH19QHBhZ2V7c2l6ZTpsYW5kc2NhcGU7bWFyZ2luOjB9LmJlc3Bva2UtcGFyZW50ey13ZWJraXQtdHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC42cyBlYXNlO3RyYW5zaXRpb246YmFja2dyb3VuZCAuNnMgZWFzZTtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtib3R0b206MDtsZWZ0OjA7cmlnaHQ6MDtvdmVyZmxvdzpoaWRkZW59QG1lZGlhIHByaW50ey5iZXNwb2tlLXBhcmVudHtvdmVyZmxvdzp2aXNpYmxlO3Bvc2l0aW9uOnN0YXRpY319LmJlc3Bva2UtdGhlbWUtY3ViZS1zbGlkZS1wYXJlbnR7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3JpZ2h0OjA7Ym90dG9tOjA7LXdlYmtpdC1wZXJzcGVjdGl2ZTo2MDBweDtwZXJzcGVjdGl2ZTo2MDBweDtwb2ludGVyLWV2ZW50czpub25lfS5iZXNwb2tlLXNsaWRle3BvaW50ZXItZXZlbnRzOmF1dG87LXdlYmtpdC10cmFuc2l0aW9uOi13ZWJraXQtdHJhbnNmb3JtIC42cyBlYXNlLG9wYWNpdHkgLjZzIGVhc2UsYmFja2dyb3VuZCAuNnMgZWFzZTt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuNnMgZWFzZSxvcGFjaXR5IC42cyBlYXNlLGJhY2tncm91bmQgLjZzIGVhc2U7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOjUwJSA1MCUgMDt0cmFuc2Zvcm0tb3JpZ2luOjUwJSA1MCUgMDstd2Via2l0LWJhY2tmYWNlLXZpc2liaWxpdHk6aGlkZGVuO2JhY2tmYWNlLXZpc2liaWxpdHk6aGlkZGVuO2Rpc3BsYXk6LXdlYmtpdC1ib3g7ZGlzcGxheTotd2Via2l0LWZsZXg7ZGlzcGxheTotbXMtZmxleGJveDtkaXNwbGF5OmZsZXg7LXdlYmtpdC1ib3gtb3JpZW50OnZlcnRpY2FsOy13ZWJraXQtYm94LWRpcmVjdGlvbjpub3JtYWw7LXdlYmtpdC1mbGV4LWRpcmVjdGlvbjpjb2x1bW47LW1zLWZsZXgtZGlyZWN0aW9uOmNvbHVtbjtmbGV4LWRpcmVjdGlvbjpjb2x1bW47LXdlYmtpdC1ib3gtcGFjazpjZW50ZXI7LXdlYmtpdC1qdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOy1tcy1mbGV4LXBhY2s6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7LXdlYmtpdC1ib3gtYWxpZ246Y2VudGVyOy13ZWJraXQtYWxpZ24taXRlbXM6Y2VudGVyOy1tcy1mbGV4LWFsaWduOmNlbnRlcjthbGlnbi1pdGVtczpjZW50ZXI7dGV4dC1hbGlnbjpjZW50ZXI7d2lkdGg6NjQwcHg7aGVpZ2h0OjQ4MHB4O3Bvc2l0aW9uOmFic29sdXRlO3RvcDo1MCU7bWFyZ2luLXRvcDotMjQwcHg7bGVmdDo1MCU7bWFyZ2luLWxlZnQ6LTMyMHB4O2JhY2tncm91bmQ6I2VhZWFlYTtwYWRkaW5nOjQwcHg7Ym9yZGVyLXJhZGl1czowfUBtZWRpYSBwcmludHsuYmVzcG9rZS1zbGlkZXt6b29tOjEhaW1wb3J0YW50O2hlaWdodDo3NDNweDt3aWR0aDoxMDAlO3BhZ2UtYnJlYWstYmVmb3JlOmFsd2F5cztwb3NpdGlvbjpzdGF0aWM7bWFyZ2luOjA7LXdlYmtpdC10cmFuc2l0aW9uOm5vbmU7dHJhbnNpdGlvbjpub25lfX0uYmVzcG9rZS1iZWZvcmV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlWCgxMDBweCl0cmFuc2xhdGVYKC0zMjBweClyb3RhdGVZKC05MGRlZyl0cmFuc2xhdGVYKC0zMjBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoMTAwcHgpdHJhbnNsYXRlWCgtMzIwcHgpcm90YXRlWSgtOTBkZWcpdHJhbnNsYXRlWCgtMzIwcHgpfUBtZWRpYSBwcmludHsuYmVzcG9rZS1iZWZvcmV7LXdlYmtpdC10cmFuc2Zvcm06bm9uZTt0cmFuc2Zvcm06bm9uZX19LmJlc3Bva2UtYWZ0ZXJ7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTAwcHgpdHJhbnNsYXRlWCgzMjBweClyb3RhdGVZKDkwZGVnKXRyYW5zbGF0ZVgoMzIwcHgpO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC0xMDBweCl0cmFuc2xhdGVYKDMyMHB4KXJvdGF0ZVkoOTBkZWcpdHJhbnNsYXRlWCgzMjBweCl9QG1lZGlhIHByaW50ey5iZXNwb2tlLWFmdGVyey13ZWJraXQtdHJhbnNmb3JtOm5vbmU7dHJhbnNmb3JtOm5vbmV9fS5iZXNwb2tlLWluYWN0aXZle29wYWNpdHk6MDtwb2ludGVyLWV2ZW50czpub25lfUBtZWRpYSBwcmludHsuYmVzcG9rZS1pbmFjdGl2ZXtvcGFjaXR5OjF9fS5iZXNwb2tlLWFjdGl2ZXtvcGFjaXR5OjF9LmJlc3Bva2UtYnVsbGV0ey13ZWJraXQtdHJhbnNpdGlvbjphbGwgLjNzIGVhc2U7dHJhbnNpdGlvbjphbGwgLjNzIGVhc2V9QG1lZGlhIHByaW50ey5iZXNwb2tlLWJ1bGxldHstd2Via2l0LXRyYW5zaXRpb246bm9uZTt0cmFuc2l0aW9uOm5vbmV9fS5iZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZXtvcGFjaXR5OjB9bGkuYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlWCgxNnB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgxNnB4KX1AbWVkaWEgcHJpbnR7bGkuYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7LXdlYmtpdC10cmFuc2Zvcm06bm9uZTt0cmFuc2Zvcm06bm9uZX19QG1lZGlhIHByaW50ey5iZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZXtvcGFjaXR5OjF9fS5iZXNwb2tlLWJ1bGxldC1hY3RpdmV7b3BhY2l0eToxfS5iZXNwb2tlLXNjYWxlLXBhcmVudHstd2Via2l0LXBlcnNwZWN0aXZlOjYwMHB4O3BlcnNwZWN0aXZlOjYwMHB4O3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowO3BvaW50ZXItZXZlbnRzOm5vbmV9LmJlc3Bva2Utc2NhbGUtcGFyZW50IC5iZXNwb2tlLWFjdGl2ZXtwb2ludGVyLWV2ZW50czphdXRvfUBtZWRpYSBwcmludHsuYmVzcG9rZS1zY2FsZS1wYXJlbnR7LXdlYmtpdC10cmFuc2Zvcm06bm9uZSFpbXBvcnRhbnQ7dHJhbnNmb3JtOm5vbmUhaW1wb3J0YW50fX0uYmVzcG9rZS1wcm9ncmVzcy1wYXJlbnR7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3JpZ2h0OjA7aGVpZ2h0OjJweH1AbWVkaWEgb25seSBzY3JlZW4gYW5kIChtaW4td2lkdGg6MTM2NnB4KXsuYmVzcG9rZS1wcm9ncmVzcy1wYXJlbnR7aGVpZ2h0OjRweH19QG1lZGlhIHByaW50ey5iZXNwb2tlLXByb2dyZXNzLXBhcmVudHtkaXNwbGF5Om5vbmV9fS5iZXNwb2tlLXByb2dyZXNzLWJhcnstd2Via2l0LXRyYW5zaXRpb246d2lkdGggLjZzIGVhc2U7dHJhbnNpdGlvbjp3aWR0aCAuNnMgZWFzZTtwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6MTAwJTtiYWNrZ3JvdW5kOiMwMDg5ZjM7Ym9yZGVyLXJhZGl1czowIDRweCA0cHggMH0uZW1waGF0aWN7YmFja2dyb3VuZDojZWFlYWVhfS5iZXNwb2tlLWJhY2tkcm9we3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowOy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZVooMCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCk7LXdlYmtpdC10cmFuc2l0aW9uOm9wYWNpdHkgLjZzIGVhc2U7dHJhbnNpdGlvbjpvcGFjaXR5IC42cyBlYXNlO29wYWNpdHk6MDt6LWluZGV4Oi0xfS5iZXNwb2tlLWJhY2tkcm9wLWFjdGl2ZXtvcGFjaXR5OjF9cHJle3BhZGRpbmc6MjZweCFpbXBvcnRhbnQ7Ym9yZGVyLXJhZGl1czo4cHh9Ym9keXtmb250LWZhbWlseTpoZWx2ZXRpY2EsYXJpYWwsc2Fucy1zZXJpZjtmb250LXNpemU6MThweDtjb2xvcjojNDA0MDQwfWgxe2ZvbnQtc2l6ZTo3MnB4O2xpbmUtaGVpZ2h0OjgycHg7bGV0dGVyLXNwYWNpbmc6LTJweDttYXJnaW4tYm90dG9tOjE2cHh9aDJ7Zm9udC1zaXplOjQycHg7bGV0dGVyLXNwYWNpbmc6LTFweDttYXJnaW4tYm90dG9tOjhweH1oM3tmb250LXNpemU6MjRweDtmb250LXdlaWdodDo0MDA7bWFyZ2luLWJvdHRvbToyNHB4O2NvbG9yOiM2MDYwNjB9aHJ7dmlzaWJpbGl0eTpoaWRkZW47aGVpZ2h0OjIwcHh9dWx7bGlzdC1zdHlsZTpub25lfWxpe21hcmdpbi1ib3R0b206MTJweH1we21hcmdpbjowIDEwMHB4IDEycHg7bGluZS1oZWlnaHQ6MjJweH1he2NvbG9yOiMwMDg5ZjM7dGV4dC1kZWNvcmF0aW9uOm5vbmV9XCI7XG4gIGluc2VydENzcyhjc3MsIHsgcHJlcGVuZDogdHJ1ZSB9KTtcblxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xuICAgIGNsYXNzZXMoKShkZWNrKTtcblxuICAgIHZhciB3cmFwID0gZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2Jlc3Bva2UtdGhlbWUtY3ViZS1zbGlkZS1wYXJlbnQnO1xuICAgICAgZWxlbWVudC5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh3cmFwcGVyLCBlbGVtZW50KTtcbiAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG4gICAgfTtcblxuICAgIGRlY2suc2xpZGVzLmZvckVhY2god3JhcCk7XG4gIH07XG59O1xuXG59LHtcImJlc3Bva2UtY2xhc3Nlc1wiOjIsXCJpbnNlcnQtY3NzXCI6M31dLDI6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgYWRkQ2xhc3MgPSBmdW5jdGlvbihlbCwgY2xzKSB7XG4gICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtJyArIGNscyk7XG4gICAgICB9LFxuXG4gICAgICByZW1vdmVDbGFzcyA9IGZ1bmN0aW9uKGVsLCBjbHMpIHtcbiAgICAgICAgZWwuY2xhc3NOYW1lID0gZWwuY2xhc3NOYW1lXG4gICAgICAgICAgLnJlcGxhY2UobmV3IFJlZ0V4cCgnYmVzcG9rZS0nICsgY2xzICsnKFxcXFxzfCQpJywgJ2cnKSwgJyAnKVxuICAgICAgICAgIC50cmltKCk7XG4gICAgICB9LFxuXG4gICAgICBkZWFjdGl2YXRlID0gZnVuY3Rpb24oZWwsIGluZGV4KSB7XG4gICAgICAgIHZhciBhY3RpdmVTbGlkZSA9IGRlY2suc2xpZGVzW2RlY2suc2xpZGUoKV0sXG4gICAgICAgICAgb2Zmc2V0ID0gaW5kZXggLSBkZWNrLnNsaWRlKCksXG4gICAgICAgICAgb2Zmc2V0Q2xhc3MgPSBvZmZzZXQgPiAwID8gJ2FmdGVyJyA6ICdiZWZvcmUnO1xuXG4gICAgICAgIFsnYmVmb3JlKC1cXFxcZCspPycsICdhZnRlcigtXFxcXGQrKT8nLCAnYWN0aXZlJywgJ2luYWN0aXZlJ10ubWFwKHJlbW92ZUNsYXNzLmJpbmQobnVsbCwgZWwpKTtcblxuICAgICAgICBpZiAoZWwgIT09IGFjdGl2ZVNsaWRlKSB7XG4gICAgICAgICAgWydpbmFjdGl2ZScsIG9mZnNldENsYXNzLCBvZmZzZXRDbGFzcyArICctJyArIE1hdGguYWJzKG9mZnNldCldLm1hcChhZGRDbGFzcy5iaW5kKG51bGwsIGVsKSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICBhZGRDbGFzcyhkZWNrLnBhcmVudCwgJ3BhcmVudCcpO1xuICAgIGRlY2suc2xpZGVzLm1hcChmdW5jdGlvbihlbCkgeyBhZGRDbGFzcyhlbCwgJ3NsaWRlJyk7IH0pO1xuXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XG4gICAgICBkZWNrLnNsaWRlcy5tYXAoZGVhY3RpdmF0ZSk7XG4gICAgICBhZGRDbGFzcyhlLnNsaWRlLCAnYWN0aXZlJyk7XG4gICAgICByZW1vdmVDbGFzcyhlLnNsaWRlLCAnaW5hY3RpdmUnKTtcbiAgICB9KTtcbiAgfTtcbn07XG5cbn0se31dLDM6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xudmFyIGluc2VydGVkID0ge307XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNzcywgb3B0aW9ucykge1xuICAgIGlmIChpbnNlcnRlZFtjc3NdKSByZXR1cm47XG4gICAgaW5zZXJ0ZWRbY3NzXSA9IHRydWU7XG4gICAgXG4gICAgdmFyIGVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIGVsZW0uc2V0QXR0cmlidXRlKCd0eXBlJywgJ3RleHQvY3NzJyk7XG5cbiAgICBpZiAoJ3RleHRDb250ZW50JyBpbiBlbGVtKSB7XG4gICAgICBlbGVtLnRleHRDb250ZW50ID0gY3NzO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbGVtLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzcztcbiAgICB9XG4gICAgXG4gICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucHJlcGVuZCkge1xuICAgICAgICBoZWFkLmluc2VydEJlZm9yZShlbGVtLCBoZWFkLmNoaWxkTm9kZXNbMF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoZWxlbSk7XG4gICAgfVxufTtcblxufSx7fV19LHt9LFsxXSlcbigxKVxufSk7XG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xuICAgIHZhciBheGlzID0gb3B0aW9ucyA9PSAndmVydGljYWwnID8gJ1knIDogJ1gnLFxuICAgICAgc3RhcnRQb3NpdGlvbixcbiAgICAgIGRlbHRhO1xuXG4gICAgZGVjay5wYXJlbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgc3RhcnRQb3NpdGlvbiA9IGUudG91Y2hlc1swXVsncGFnZScgKyBheGlzXTtcbiAgICAgICAgZGVsdGEgPSAwO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVjay5wYXJlbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgZnVuY3Rpb24oZSkge1xuICAgICAgaWYgKGUudG91Y2hlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGRlbHRhID0gZS50b3VjaGVzWzBdWydwYWdlJyArIGF4aXNdIC0gc3RhcnRQb3NpdGlvbjtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlY2sucGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoTWF0aC5hYnMoZGVsdGEpID4gNTApIHtcbiAgICAgICAgZGVja1tkZWx0YSA+IDAgPyAncHJldicgOiAnbmV4dCddKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59O1xuIiwidmFyIGZyb20gPSBmdW5jdGlvbihvcHRzLCBwbHVnaW5zKSB7XG4gIHZhciBwYXJlbnQgPSAob3B0cy5wYXJlbnQgfHwgb3B0cykubm9kZVR5cGUgPT09IDEgPyAob3B0cy5wYXJlbnQgfHwgb3B0cykgOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKG9wdHMucGFyZW50IHx8IG9wdHMpLFxuICAgIHNsaWRlcyA9IFtdLmZpbHRlci5jYWxsKHR5cGVvZiBvcHRzLnNsaWRlcyA9PT0gJ3N0cmluZycgPyBwYXJlbnQucXVlcnlTZWxlY3RvckFsbChvcHRzLnNsaWRlcykgOiAob3B0cy5zbGlkZXMgfHwgcGFyZW50LmNoaWxkcmVuKSwgZnVuY3Rpb24oZWwpIHsgcmV0dXJuIGVsLm5vZGVOYW1lICE9PSAnU0NSSVBUJzsgfSksXG4gICAgYWN0aXZlU2xpZGUgPSBzbGlkZXNbMF0sXG4gICAgbGlzdGVuZXJzID0ge30sXG5cbiAgICBhY3RpdmF0ZSA9IGZ1bmN0aW9uKGluZGV4LCBjdXN0b21EYXRhKSB7XG4gICAgICBpZiAoIXNsaWRlc1tpbmRleF0pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBmaXJlKCdkZWFjdGl2YXRlJywgY3JlYXRlRXZlbnREYXRhKGFjdGl2ZVNsaWRlLCBjdXN0b21EYXRhKSk7XG4gICAgICBhY3RpdmVTbGlkZSA9IHNsaWRlc1tpbmRleF07XG4gICAgICBmaXJlKCdhY3RpdmF0ZScsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpO1xuICAgIH0sXG5cbiAgICBzbGlkZSA9IGZ1bmN0aW9uKGluZGV4LCBjdXN0b21EYXRhKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICBmaXJlKCdzbGlkZScsIGNyZWF0ZUV2ZW50RGF0YShzbGlkZXNbaW5kZXhdLCBjdXN0b21EYXRhKSkgJiYgYWN0aXZhdGUoaW5kZXgsIGN1c3RvbURhdGEpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHNsaWRlcy5pbmRleE9mKGFjdGl2ZVNsaWRlKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgc3RlcCA9IGZ1bmN0aW9uKG9mZnNldCwgY3VzdG9tRGF0YSkge1xuICAgICAgdmFyIHNsaWRlSW5kZXggPSBzbGlkZXMuaW5kZXhPZihhY3RpdmVTbGlkZSkgKyBvZmZzZXQ7XG5cbiAgICAgIGZpcmUob2Zmc2V0ID4gMCA/ICduZXh0JyA6ICdwcmV2JywgY3JlYXRlRXZlbnREYXRhKGFjdGl2ZVNsaWRlLCBjdXN0b21EYXRhKSkgJiYgYWN0aXZhdGUoc2xpZGVJbmRleCwgY3VzdG9tRGF0YSk7XG4gICAgfSxcblxuICAgIG9uID0gZnVuY3Rpb24oZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgKGxpc3RlbmVyc1tldmVudE5hbWVdIHx8IChsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdKSkucHVzaChjYWxsYmFjayk7XG4gICAgICByZXR1cm4gb2ZmLmJpbmQobnVsbCwgZXZlbnROYW1lLCBjYWxsYmFjayk7XG4gICAgfSxcblxuICAgIG9mZiA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdID0gKGxpc3RlbmVyc1tldmVudE5hbWVdIHx8IFtdKS5maWx0ZXIoZnVuY3Rpb24obGlzdGVuZXIpIHsgcmV0dXJuIGxpc3RlbmVyICE9PSBjYWxsYmFjazsgfSk7XG4gICAgfSxcblxuICAgIGZpcmUgPSBmdW5jdGlvbihldmVudE5hbWUsIGV2ZW50RGF0YSkge1xuICAgICAgcmV0dXJuIChsaXN0ZW5lcnNbZXZlbnROYW1lXSB8fCBbXSlcbiAgICAgICAgLnJlZHVjZShmdW5jdGlvbihub3RDYW5jZWxsZWQsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgcmV0dXJuIG5vdENhbmNlbGxlZCAmJiBjYWxsYmFjayhldmVudERhdGEpICE9PSBmYWxzZTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfSxcblxuICAgIGNyZWF0ZUV2ZW50RGF0YSA9IGZ1bmN0aW9uKGVsLCBldmVudERhdGEpIHtcbiAgICAgIGV2ZW50RGF0YSA9IGV2ZW50RGF0YSB8fCB7fTtcbiAgICAgIGV2ZW50RGF0YS5pbmRleCA9IHNsaWRlcy5pbmRleE9mKGVsKTtcbiAgICAgIGV2ZW50RGF0YS5zbGlkZSA9IGVsO1xuICAgICAgcmV0dXJuIGV2ZW50RGF0YTtcbiAgICB9LFxuXG4gICAgZGVjayA9IHtcbiAgICAgIG9uOiBvbixcbiAgICAgIG9mZjogb2ZmLFxuICAgICAgZmlyZTogZmlyZSxcbiAgICAgIHNsaWRlOiBzbGlkZSxcbiAgICAgIG5leHQ6IHN0ZXAuYmluZChudWxsLCAxKSxcbiAgICAgIHByZXY6IHN0ZXAuYmluZChudWxsLCAtMSksXG4gICAgICBwYXJlbnQ6IHBhcmVudCxcbiAgICAgIHNsaWRlczogc2xpZGVzXG4gICAgfTtcblxuICAocGx1Z2lucyB8fCBbXSkuZm9yRWFjaChmdW5jdGlvbihwbHVnaW4pIHtcbiAgICBwbHVnaW4oZGVjayk7XG4gIH0pO1xuXG4gIGFjdGl2YXRlKDApO1xuXG4gIHJldHVybiBkZWNrO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGZyb206IGZyb21cbn07XG4iLCIvLyBSZXF1aXJlIE5vZGUgbW9kdWxlcyBpbiB0aGUgYnJvd3NlciB0aGFua3MgdG8gQnJvd3NlcmlmeTogaHR0cDovL2Jyb3dzZXJpZnkub3JnXG52YXIgYmVzcG9rZSA9IHJlcXVpcmUoJ2Jlc3Bva2UnKSxcbiAgZnggPSByZXF1aXJlKCdiZXNwb2tlLWZ4JyksXG4gIGN1YmUgPSByZXF1aXJlKCdiZXNwb2tlLXRoZW1lLWN1YmUnKSxcbiAga2V5cyA9IHJlcXVpcmUoJ2Jlc3Bva2Uta2V5cycpLFxuICB0b3VjaCA9IHJlcXVpcmUoJ2Jlc3Bva2UtdG91Y2gnKSxcbiAgYnVsbGV0cyA9IHJlcXVpcmUoJ2Jlc3Bva2UtYnVsbGV0cycpLFxuICBiYWNrZHJvcCA9IHJlcXVpcmUoJ2Jlc3Bva2UtYmFja2Ryb3AnKSxcbiAgc2NhbGUgPSByZXF1aXJlKCdiZXNwb2tlLXNjYWxlJyksXG4gIGhhc2ggPSByZXF1aXJlKCdiZXNwb2tlLWhhc2gnKSxcbiAgcHJvZ3Jlc3MgPSByZXF1aXJlKCdiZXNwb2tlLXByb2dyZXNzJyksXG4gIGZvcm1zID0gcmVxdWlyZSgnYmVzcG9rZS1mb3JtcycpO1xuXG4vLyBCZXNwb2tlLmpzXG5iZXNwb2tlLmZyb20oJ2FydGljbGUnLCBbXG4gIGN1YmUoKSxcbiAga2V5cygpLFxuICB0b3VjaCgpLFxuICBidWxsZXRzKCdsaSwgLmJ1bGxldCcpLFxuICBiYWNrZHJvcCgpLFxuICBzY2FsZSgpLFxuICBoYXNoKCksXG4gIHByb2dyZXNzKCksXG4gIGZvcm1zKClcbl0pO1xuYmVzcG9rZS5mcm9tKCcjcHJlc2VudGF0aW9uJywgW1xuICBiZXNwb2tlLnBsdWdpbnMuZngoKVxuXSk7XG5iZXNwb2tlLmhvcml6b250YWwuZnJvbSgnYXJ0aWNsZScsIHtcbiAgZng6IHRydWVcbn0pXG4vLyBQcmlzbSBzeW50YXggaGlnaGxpZ2h0aW5nXG4vLyBUaGlzIGlzIGFjdHVhbGx5IGxvYWRlZCBmcm9tIFwiYm93ZXJfY29tcG9uZW50c1wiIHRoYW5rcyB0b1xuLy8gZGVib3dlcmlmeTogaHR0cHM6Ly9naXRodWIuY29tL2V1Z2VuZXdhcmUvZGVib3dlcmlmeVxucmVxdWlyZShcIi4vLi4vLi4vYm93ZXJfY29tcG9uZW50cy9wcmlzbS9wcmlzbS5qc1wiKTtcblxuIl19

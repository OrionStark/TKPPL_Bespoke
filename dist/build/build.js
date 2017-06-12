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
(function (global){
/*!
 * bespoke-theme-greeny v0.0.3
 *
 * Copyright 2015, cedced19
 * This content is released under the MIT license
 * http://cedced19.github.io/license/
 */

!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self);var f=o;f=f.bespoke||(f.bespoke={}),f=f.themes||(f.themes={}),f.greeny=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){

var classes = _dereq_('bespoke-classes');
var insertCss = _dereq_('insert-css');

module.exports = {
    theme: function() {
      var css = "*{box-sizing:border-box;margin:0;padding:0}@media print{*{-webkit-print-color-adjust:exact}}@page{size:landscape;margin:0}.bespoke-parent{-webkit-transition:background .62s ease-in-out;transition:background .62s ease-in-out;position:absolute;top:0;bottom:0;left:0;right:0;overflow:hidden;-webkit-perspective:600px;perspective:600px}@media print{.bespoke-parent{overflow:visible;position:static}}.bespoke-slide{-webkit-transition:-webkit-transform .62s ease-in-out,opacity .62s ease-in-out,background .62s ease-in-out;transition:transform .62s ease-in-out,opacity .62s ease-in-out,background .62s ease-in-out;-webkit-transform-origin:50% 50% 0;-ms-transform-origin:50% 50% 0;transform-origin:50% 50% 0;-webkit-backface-visibility:hidden;backface-visibility:hidden;display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;-ms-flex-pack:center;justify-content:center;-webkit-box-align:center;-webkit-align-items:center;-ms-flex-align:center;align-items:center;text-align:center;width:640px;height:480px;position:absolute;top:50%;margin-top:-240px;left:50%;margin-left:-320px;background-color:#2ecc71;padding:40px;border-radius:0}@media print{.bespoke-slide{zoom:1!important;height:743px;width:100%;page-break-before:always;position:static;margin:0;-webkit-transition:none;transition:none}}.bespoke-before{-webkit-transform:translateX(130px)translateX(-320px)rotateY(-120deg)translateX(-320px);transform:translateX(130px)translateX(-320px)rotateY(-120deg)translateX(-320px)}@media print{.bespoke-before{-webkit-transform:none;-ms-transform:none;transform:none}}.bespoke-after{-webkit-transform:translateX(-130px)translateX(320px)rotateY(120deg)translateX(320px);transform:translateX(-130px)translateX(320px)rotateY(120deg)translateX(320px)}@media print{.bespoke-after{-webkit-transform:none;-ms-transform:none;transform:none}}.bespoke-inactive{opacity:0;pointer-events:none}@media print{.bespoke-inactive{opacity:1}}.bespoke-active{opacity:1}.bespoke-bullet{-webkit-transition:all .3s ease;transition:all .3s ease}@media print{.bespoke-bullet{-webkit-transition:none;transition:none}}.bespoke-bullet-inactive{opacity:0}li.bespoke-bullet-inactive{-webkit-transform:translateX(16px);-ms-transform:translateX(16px);transform:translateX(16px)}@media print{li.bespoke-bullet-inactive{-webkit-transform:none;-ms-transform:none;transform:none}}@media print{.bespoke-bullet-inactive{opacity:1}}.bespoke-bullet-active{opacity:1}.bespoke-scale-parent{-webkit-perspective:600px;perspective:600px;position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none}.bespoke-scale-parent .bespoke-active{pointer-events:auto}@media print{.bespoke-scale-parent{-webkit-transform:none!important;-ms-transform:none!important;transform:none!important}}.bespoke-progress-parent{position:absolute;top:0;left:0;right:0;height:16px}@media only screen and (max-width:400px){.bespoke-progress-parent{height:8px}}@media print{.bespoke-progress-parent{display:none}}.bespoke-progress-bar{-webkit-transition:width .6s ease;transition:width .6s ease;position:absolute;height:100%;background:#16a085}.bespoke-backdrop{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-transform:translateZ(0);transform:translateZ(0);-webkit-transition:opacity .62s ease-in-out;transition:opacity .62s ease-in-out;opacity:0;z-index:-1}.bespoke-backdrop-active{opacity:1}pre{padding:26px!important;border-radius:8px}body{font-family:helvetica,arial,sans-serif;font-size:18px;color:#ecf0f1;background:#2ecc71}h1{line-height:82px;letter-spacing:-2px;margin-bottom:16px;font-size:50px;white-space:nowarp}h2{letter-spacing:-1px;margin-bottom:8px;font-size:40px}h3{margin-bottom:24px;color:#ecf0f1;font-size:30px;font-weight:700}h4{margin-bottom:5px}hr{visibility:hidden;height:20px}ul{list-style:none}li{margin-bottom:12px;display:block}p{margin:0 100px 12px;line-height:22px}a{color:#0089f3;text-decoration:none}::-moz-selection{color:#2ecc71;background-color:#ecf0f1}::selection{color:#2ecc71;background-color:#ecf0f1}.inverse{background-color:#2ecc71;color:#2c3e50}.stick{border-width:3px 0;border-style:solid;border-color:#ddd}.single-words{word-spacing:9999px;line-height:2.9em;overflow:hidden}.src{font-size:8px;margin-bottom:5px}.src::before{content:'Source: '}";
      insertCss(css, { prepend: true });

      return function(deck) {
        classes()(deck);
      };
    },
    scale: function() {
      return function(deck) {
        var parent = deck.parent,
          firstSlide = deck.slides[0],
          slideHeight = firstSlide.offsetHeight,
          slideWidth = firstSlide.offsetWidth,
          useZoom = 'WebkitAppearance' in document.documentElement.style,

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
    }
}

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
},{}],12:[function(require,module,exports){
(function (global){
/*!
 * bespoke-theme-sea v0.3.1
 *
 * Copyright 2016, 
 * This content is released under the MIT license
 * 
 */

!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self);var f=o;f=f.bespoke||(f.bespoke={}),f=f.themes||(f.themes={}),f.sea=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){

var classes = _dereq_('bespoke-classes');
var insertCss = _dereq_('insert-css');

module.exports = function() {
  var css = "/*! normalize.css v3.0.0 | MIT License | git.io/normalize */html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}article,aside,details,figcaption,figure,footer,header,hgroup,main,nav,section,summary{display:block}audio,canvas,progress,video{display:inline-block;vertical-align:baseline}audio:not([controls]){display:none;height:0}[hidden],template{display:none}a{background:0 0}a:active,a:hover{outline:0}abbr[title]{border-bottom:1px dotted}b,strong{font-weight:700}dfn{font-style:italic}h1{font-size:2em;margin:.67em 0}mark{background:#ff0;color:#000}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sup{top:-.5em}sub{bottom:-.25em}img{border:0}svg:not(:root){overflow:hidden}figure{margin:1em 40px}hr{box-sizing:content-box;height:0}pre{overflow:auto}code,kbd,pre,samp{font-family:monospace,monospace;font-size:1em}button,input,optgroup,select,textarea{color:inherit;font:inherit;margin:0}button{overflow:visible}button,select{text-transform:none}button,html input[type=\"button\"],input[type=\"reset\"],input[type=\"submit\"]{-webkit-appearance:button;cursor:pointer}button[disabled],html input[disabled]{cursor:default}button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0}input{line-height:normal}input[type=\"checkbox\"],input[type=\"radio\"]{box-sizing:border-box;padding:0}input[type=\"number\"]::-webkit-inner-spin-button,input[type=\"number\"]::-webkit-outer-spin-button{height:auto}input[type=\"search\"]{-webkit-appearance:textfield;box-sizing:content-box}input[type=\"search\"]::-webkit-search-cancel-button,input[type=\"search\"]::-webkit-search-decoration{-webkit-appearance:none}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{border:0;padding:0}textarea{overflow:auto}optgroup{font-weight:700}table{border-collapse:collapse;border-spacing:0}td,th{padding:0}body{font-family:\"Helvetica Neue\",Helvetica,sans-serif}h3{opacity:.75}a{color:#ddd;transition:color .2s ease}a:hover{color:#fff}li{margin:.25em}.bespoke-parent{-webkit-text-size-adjust:auto;-ms-text-size-adjust:auto;text-size-adjust:auto;overflow:hidden;background:#34495e}.bespoke-parent,.bespoke-scale-parent{position:absolute;top:0;left:0;right:0;bottom:0}.bespoke-scale-parent{pointer-events:none}.bespoke-scale-parent .bespoke-active{pointer-events:auto}.bespoke-slide{width:640px;height:480px;position:absolute;top:50%;left:50%;margin-left:-320px;margin-top:-240px;display:-ms-flexbox;display:flex;-ms-flex-direction:column;flex-direction:column;-ms-flex-pack:center;justify-content:center;-ms-flex-align:center;align-items:center;background:#00659a;color:#fff;transition:-webkit-transform .7s ease 0s,opacity .7s ease 0s,background-color .7s ease 0s;transition:transform .7s ease 0s,opacity .7s ease 0s,background-color .7s ease 0s}.bespoke-active{opacity:1;z-index:10}.bespoke-inactive{opacity:.3;pointer-events:none}.bespoke-before{opacity:0}.bespoke-before-1{opacity:.3;-webkit-transform:translateX(-640px);transform:translateX(-640px);z-index:9}.bespoke-after{opacity:0}.bespoke-after-1{opacity:.3;-webkit-transform:translateX(640px);transform:translateX(640px);z-index:9}.bespoke-bullet{transition:all .3s ease}.bespoke-bullet-inactive{-webkit-transform:translateY(-20px);transform:translateY(-20px);opacity:0;pointer-events:none}.bespoke-backdrop{position:absolute;top:0;left:0;right:0;bottom:0;z-index:-1;opacity:0}.bespoke-backdrop-active{opacity:1}.bespoke-progress-parent{position:absolute;top:0;left:0;right:0;height:.3vw;z-index:11}.bespoke-progress-bar{position:absolute;height:100%;background:#fff;transition:width .6s ease}.emphatic{background:#0ad}.emphatic-text{color:#fff;font-size:larger}";
  insertCss(css, { prepend: true });

  return function(deck) {
    classes()(deck);
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
},{}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
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

},{}],15:[function(require,module,exports){
// Require Node modules in the browser thanks to Browserify: http://browserify.org
var bespoke = require('bespoke'),
  fx = require('bespoke-fx'),
  greeny = require('bespoke-theme-greeny'),
  cube = require('bespoke-theme-cube'),
  //carousel = require('bespoke-theme-carousel'),
  sea = require('bespoke-theme-sea'),
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
  //carousel(),
  //sea(),
  keys(),
  touch(),
  bullets('li, .bullet'),
  backdrop(),
  scale(),
  hash(),
  progress(),
  forms()
]);
bespoke.from('article', {
  fullscreenbackground: true
});
// Prism syntax highlighting
// This is actually loaded from "bower_components" thanks to
// debowerify: https://github.com/eugeneware/debowerify
require("./..\\..\\bower_components\\prism\\prism.js");


},{"./..\\..\\bower_components\\prism\\prism.js":1,"bespoke":14,"bespoke-backdrop":2,"bespoke-bullets":3,"bespoke-forms":4,"bespoke-fx":5,"bespoke-hash":6,"bespoke-keys":7,"bespoke-progress":8,"bespoke-scale":9,"bespoke-theme-cube":10,"bespoke-theme-greeny":11,"bespoke-theme-sea":12,"bespoke-touch":13}]},{},[15])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcZmFucmluMTIxMlxcRGVza3RvcFxcUmVwb0JhcnVcXG5vZGVfbW9kdWxlc1xcYnJvd3Nlci1wYWNrXFxfcHJlbHVkZS5qcyIsIkM6L1VzZXJzL2ZhbnJpbjEyMTIvRGVza3RvcC9SZXBvQmFydS9ib3dlcl9jb21wb25lbnRzL3ByaXNtL3ByaXNtLmpzIiwiQzovVXNlcnMvZmFucmluMTIxMi9EZXNrdG9wL1JlcG9CYXJ1L25vZGVfbW9kdWxlcy9iZXNwb2tlLWJhY2tkcm9wL2xpYi9iZXNwb2tlLWJhY2tkcm9wLmpzIiwiQzovVXNlcnMvZmFucmluMTIxMi9EZXNrdG9wL1JlcG9CYXJ1L25vZGVfbW9kdWxlcy9iZXNwb2tlLWJ1bGxldHMvbGliL2Jlc3Bva2UtYnVsbGV0cy5qcyIsIkM6L1VzZXJzL2ZhbnJpbjEyMTIvRGVza3RvcC9SZXBvQmFydS9ub2RlX21vZHVsZXMvYmVzcG9rZS1mb3Jtcy9saWIvYmVzcG9rZS1mb3Jtcy5qcyIsIkM6L1VzZXJzL2ZhbnJpbjEyMTIvRGVza3RvcC9SZXBvQmFydS9ub2RlX21vZHVsZXMvYmVzcG9rZS1meC9saWIvYmVzcG9rZS1meC5qcyIsIkM6L1VzZXJzL2ZhbnJpbjEyMTIvRGVza3RvcC9SZXBvQmFydS9ub2RlX21vZHVsZXMvYmVzcG9rZS1oYXNoL2xpYi9iZXNwb2tlLWhhc2guanMiLCJDOi9Vc2Vycy9mYW5yaW4xMjEyL0Rlc2t0b3AvUmVwb0JhcnUvbm9kZV9tb2R1bGVzL2Jlc3Bva2Uta2V5cy9saWIvYmVzcG9rZS1rZXlzLmpzIiwiQzovVXNlcnMvZmFucmluMTIxMi9EZXNrdG9wL1JlcG9CYXJ1L25vZGVfbW9kdWxlcy9iZXNwb2tlLXByb2dyZXNzL2xpYi9iZXNwb2tlLXByb2dyZXNzLmpzIiwiQzovVXNlcnMvZmFucmluMTIxMi9EZXNrdG9wL1JlcG9CYXJ1L25vZGVfbW9kdWxlcy9iZXNwb2tlLXNjYWxlL2xpYi9iZXNwb2tlLXNjYWxlLmpzIiwiQzovVXNlcnMvZmFucmluMTIxMi9EZXNrdG9wL1JlcG9CYXJ1L25vZGVfbW9kdWxlcy9iZXNwb2tlLXRoZW1lLWN1YmUvZGlzdC9iZXNwb2tlLXRoZW1lLWN1YmUuanMiLCJDOi9Vc2Vycy9mYW5yaW4xMjEyL0Rlc2t0b3AvUmVwb0JhcnUvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdGhlbWUtZ3JlZW55L2Rpc3QvYmVzcG9rZS10aGVtZS1ncmVlbnkuanMiLCJDOi9Vc2Vycy9mYW5yaW4xMjEyL0Rlc2t0b3AvUmVwb0JhcnUvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdGhlbWUtc2VhL2Rpc3QvYmVzcG9rZS10aGVtZS1zZWEuanMiLCJDOi9Vc2Vycy9mYW5yaW4xMjEyL0Rlc2t0b3AvUmVwb0JhcnUvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdG91Y2gvbGliL2Jlc3Bva2UtdG91Y2guanMiLCJDOi9Vc2Vycy9mYW5yaW4xMjEyL0Rlc2t0b3AvUmVwb0JhcnUvbm9kZV9tb2R1bGVzL2Jlc3Bva2UvbGliL2Jlc3Bva2UuanMiLCJDOi9Vc2Vycy9mYW5yaW4xMjEyL0Rlc2t0b3AvUmVwb0JhcnUvc3JjL3NjcmlwdHMvZmFrZV8yNjA0ZTIyMC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcHpCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2oxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcblxyXG52YXIgX3NlbGYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXHJcblx0PyB3aW5kb3cgICAvLyBpZiBpbiBicm93c2VyXHJcblx0OiAoXHJcblx0XHQodHlwZW9mIFdvcmtlckdsb2JhbFNjb3BlICE9PSAndW5kZWZpbmVkJyAmJiBzZWxmIGluc3RhbmNlb2YgV29ya2VyR2xvYmFsU2NvcGUpXHJcblx0XHQ/IHNlbGYgLy8gaWYgaW4gd29ya2VyXHJcblx0XHQ6IHt9ICAgLy8gaWYgaW4gbm9kZSBqc1xyXG5cdCk7XHJcblxyXG4vKipcclxuICogUHJpc206IExpZ2h0d2VpZ2h0LCByb2J1c3QsIGVsZWdhbnQgc3ludGF4IGhpZ2hsaWdodGluZ1xyXG4gKiBNSVQgbGljZW5zZSBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocC9cclxuICogQGF1dGhvciBMZWEgVmVyb3UgaHR0cDovL2xlYS52ZXJvdS5tZVxyXG4gKi9cclxuXHJcbnZhciBQcmlzbSA9IChmdW5jdGlvbigpe1xyXG5cclxuLy8gUHJpdmF0ZSBoZWxwZXIgdmFyc1xyXG52YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LShcXHcrKVxcYi9pO1xyXG52YXIgdW5pcXVlSWQgPSAwO1xyXG5cclxudmFyIF8gPSBfc2VsZi5QcmlzbSA9IHtcclxuXHRtYW51YWw6IF9zZWxmLlByaXNtICYmIF9zZWxmLlByaXNtLm1hbnVhbCxcclxuXHR1dGlsOiB7XHJcblx0XHRlbmNvZGU6IGZ1bmN0aW9uICh0b2tlbnMpIHtcclxuXHRcdFx0aWYgKHRva2VucyBpbnN0YW5jZW9mIFRva2VuKSB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyBUb2tlbih0b2tlbnMudHlwZSwgXy51dGlsLmVuY29kZSh0b2tlbnMuY29udGVudCksIHRva2Vucy5hbGlhcyk7XHJcblx0XHRcdH0gZWxzZSBpZiAoXy51dGlsLnR5cGUodG9rZW5zKSA9PT0gJ0FycmF5Jykge1xyXG5cdFx0XHRcdHJldHVybiB0b2tlbnMubWFwKF8udXRpbC5lbmNvZGUpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJldHVybiB0b2tlbnMucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpO1xyXG5cdFx0XHR9XHJcblx0XHR9LFxyXG5cclxuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7XHJcblx0XHRcdHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobykubWF0Y2goL1xcW29iamVjdCAoXFx3KylcXF0vKVsxXTtcclxuXHRcdH0sXHJcblxyXG5cdFx0b2JqSWQ6IGZ1bmN0aW9uIChvYmopIHtcclxuXHRcdFx0aWYgKCFvYmpbJ19faWQnXSkge1xyXG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdfX2lkJywgeyB2YWx1ZTogKyt1bmlxdWVJZCB9KTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gb2JqWydfX2lkJ107XHJcblx0XHR9LFxyXG5cclxuXHRcdC8vIERlZXAgY2xvbmUgYSBsYW5ndWFnZSBkZWZpbml0aW9uIChlLmcuIHRvIGV4dGVuZCBpdClcclxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xyXG5cdFx0XHR2YXIgdHlwZSA9IF8udXRpbC50eXBlKG8pO1xyXG5cclxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRcdFx0Y2FzZSAnT2JqZWN0JzpcclxuXHRcdFx0XHRcdHZhciBjbG9uZSA9IHt9O1xyXG5cclxuXHRcdFx0XHRcdGZvciAodmFyIGtleSBpbiBvKSB7XHJcblx0XHRcdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gXy51dGlsLmNsb25lKG9ba2V5XSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gY2xvbmU7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ0FycmF5JzpcclxuXHRcdFx0XHRcdC8vIENoZWNrIGZvciBleGlzdGVuY2UgZm9yIElFOFxyXG5cdFx0XHRcdFx0cmV0dXJuIG8ubWFwICYmIG8ubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIF8udXRpbC5jbG9uZSh2KTsgfSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBvO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGxhbmd1YWdlczoge1xyXG5cdFx0ZXh0ZW5kOiBmdW5jdGlvbiAoaWQsIHJlZGVmKSB7XHJcblx0XHRcdHZhciBsYW5nID0gXy51dGlsLmNsb25lKF8ubGFuZ3VhZ2VzW2lkXSk7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gcmVkZWYpIHtcclxuXHRcdFx0XHRsYW5nW2tleV0gPSByZWRlZltrZXldO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gbGFuZztcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbnNlcnQgYSB0b2tlbiBiZWZvcmUgYW5vdGhlciB0b2tlbiBpbiBhIGxhbmd1YWdlIGxpdGVyYWxcclxuXHRcdCAqIEFzIHRoaXMgbmVlZHMgdG8gcmVjcmVhdGUgdGhlIG9iamVjdCAod2UgY2Fubm90IGFjdHVhbGx5IGluc2VydCBiZWZvcmUga2V5cyBpbiBvYmplY3QgbGl0ZXJhbHMpLFxyXG5cdFx0ICogd2UgY2Fubm90IGp1c3QgcHJvdmlkZSBhbiBvYmplY3QsIHdlIG5lZWQgYW5vYmplY3QgYW5kIGEga2V5LlxyXG5cdFx0ICogQHBhcmFtIGluc2lkZSBUaGUga2V5IChvciBsYW5ndWFnZSBpZCkgb2YgdGhlIHBhcmVudFxyXG5cdFx0ICogQHBhcmFtIGJlZm9yZSBUaGUga2V5IHRvIGluc2VydCBiZWZvcmUuIElmIG5vdCBwcm92aWRlZCwgdGhlIGZ1bmN0aW9uIGFwcGVuZHMgaW5zdGVhZC5cclxuXHRcdCAqIEBwYXJhbSBpbnNlcnQgT2JqZWN0IHdpdGggdGhlIGtleS92YWx1ZSBwYWlycyB0byBpbnNlcnRcclxuXHRcdCAqIEBwYXJhbSByb290IFRoZSBvYmplY3QgdGhhdCBjb250YWlucyBgaW5zaWRlYC4gSWYgZXF1YWwgdG8gUHJpc20ubGFuZ3VhZ2VzLCBpdCBjYW4gYmUgb21pdHRlZC5cclxuXHRcdCAqL1xyXG5cdFx0aW5zZXJ0QmVmb3JlOiBmdW5jdGlvbiAoaW5zaWRlLCBiZWZvcmUsIGluc2VydCwgcm9vdCkge1xyXG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcclxuXHRcdFx0dmFyIGdyYW1tYXIgPSByb290W2luc2lkZV07XHJcblxyXG5cdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XHJcblx0XHRcdFx0aW5zZXJ0ID0gYXJndW1lbnRzWzFdO1xyXG5cclxuXHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcclxuXHRcdFx0XHRcdGlmIChpbnNlcnQuaGFzT3duUHJvcGVydHkobmV3VG9rZW4pKSB7XHJcblx0XHRcdFx0XHRcdGdyYW1tYXJbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBncmFtbWFyO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgcmV0ID0ge307XHJcblxyXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XHJcblxyXG5cdFx0XHRcdGlmIChncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSkge1xyXG5cclxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcclxuXHJcblx0XHRcdFx0XHRcdGZvciAodmFyIG5ld1Rva2VuIGluIGluc2VydCkge1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0W25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmV0W3Rva2VuXSA9IGdyYW1tYXJbdG9rZW5dO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gVXBkYXRlIHJlZmVyZW5jZXMgaW4gb3RoZXIgbGFuZ3VhZ2UgZGVmaW5pdGlvbnNcclxuXHRcdFx0Xy5sYW5ndWFnZXMuREZTKF8ubGFuZ3VhZ2VzLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XHJcblx0XHRcdFx0aWYgKHZhbHVlID09PSByb290W2luc2lkZV0gJiYga2V5ICE9IGluc2lkZSkge1xyXG5cdFx0XHRcdFx0dGhpc1trZXldID0gcmV0O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gcm9vdFtpbnNpZGVdID0gcmV0O1xyXG5cdFx0fSxcclxuXHJcblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcclxuXHRcdERGUzogZnVuY3Rpb24obywgY2FsbGJhY2ssIHR5cGUsIHZpc2l0ZWQpIHtcclxuXHRcdFx0dmlzaXRlZCA9IHZpc2l0ZWQgfHwge307XHJcblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xyXG5cdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGkpKSB7XHJcblx0XHRcdFx0XHRjYWxsYmFjay5jYWxsKG8sIGksIG9baV0sIHR5cGUgfHwgaSk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKF8udXRpbC50eXBlKG9baV0pID09PSAnT2JqZWN0JyAmJiAhdmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldKSB7XHJcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XHJcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgbnVsbCwgdmlzaXRlZCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlbHNlIGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ0FycmF5JyAmJiAhdmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldKSB7XHJcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XHJcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgaSwgdmlzaXRlZCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSxcclxuXHRwbHVnaW5zOiB7fSxcclxuXHJcblx0aGlnaGxpZ2h0QWxsOiBmdW5jdGlvbihhc3luYywgY2FsbGJhY2spIHtcclxuXHRcdHZhciBlbnYgPSB7XHJcblx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0c2VsZWN0b3I6ICdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZSdcclxuXHRcdH07XHJcblxyXG5cdFx0Xy5ob29rcy5ydW4oXCJiZWZvcmUtaGlnaGxpZ2h0YWxsXCIsIGVudik7XHJcblxyXG5cdFx0dmFyIGVsZW1lbnRzID0gZW52LmVsZW1lbnRzIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoZW52LnNlbGVjdG9yKTtcclxuXHJcblx0XHRmb3IgKHZhciBpPTAsIGVsZW1lbnQ7IGVsZW1lbnQgPSBlbGVtZW50c1tpKytdOykge1xyXG5cdFx0XHRfLmhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgPT09IHRydWUsIGVudi5jYWxsYmFjayk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0aGlnaGxpZ2h0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCwgYXN5bmMsIGNhbGxiYWNrKSB7XHJcblx0XHQvLyBGaW5kIGxhbmd1YWdlXHJcblx0XHR2YXIgbGFuZ3VhZ2UsIGdyYW1tYXIsIHBhcmVudCA9IGVsZW1lbnQ7XHJcblxyXG5cdFx0d2hpbGUgKHBhcmVudCAmJiAhbGFuZy50ZXN0KHBhcmVudC5jbGFzc05hbWUpKSB7XHJcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChwYXJlbnQpIHtcclxuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV0udG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0Z3JhbW1hciA9IF8ubGFuZ3VhZ2VzW2xhbmd1YWdlXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIGVsZW1lbnQsIGlmIG5vdCBwcmVzZW50XHJcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cclxuXHRcdC8vIFNldCBsYW5ndWFnZSBvbiB0aGUgcGFyZW50LCBmb3Igc3R5bGluZ1xyXG5cdFx0cGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xyXG5cclxuXHRcdGlmICgvcHJlL2kudGVzdChwYXJlbnQubm9kZU5hbWUpKSB7XHJcblx0XHRcdHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBjb2RlID0gZWxlbWVudC50ZXh0Q29udGVudDtcclxuXHJcblx0XHR2YXIgZW52ID0ge1xyXG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LFxyXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXHJcblx0XHRcdGdyYW1tYXI6IGdyYW1tYXIsXHJcblx0XHRcdGNvZGU6IGNvZGVcclxuXHRcdH07XHJcblxyXG5cdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1zYW5pdHktY2hlY2snLCBlbnYpO1xyXG5cclxuXHRcdGlmICghZW52LmNvZGUgfHwgIWVudi5ncmFtbWFyKSB7XHJcblx0XHRcdGlmIChlbnYuY29kZSkge1xyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcclxuXHRcdFx0XHRlbnYuZWxlbWVudC50ZXh0Q29udGVudCA9IGVudi5jb2RlO1xyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xyXG5cdFx0XHR9XHJcblx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XHJcblxyXG5cdFx0aWYgKGFzeW5jICYmIF9zZWxmLldvcmtlcikge1xyXG5cdFx0XHR2YXIgd29ya2VyID0gbmV3IFdvcmtlcihfLmZpbGVuYW1lKTtcclxuXHJcblx0XHRcdHdvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gZXZ0LmRhdGE7XHJcblxyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcclxuXHJcblx0XHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcclxuXHJcblx0XHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbnYuZWxlbWVudCk7XHJcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XHJcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHdvcmtlci5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeSh7XHJcblx0XHRcdFx0bGFuZ3VhZ2U6IGVudi5sYW5ndWFnZSxcclxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZSxcclxuXHRcdFx0XHRpbW1lZGlhdGVDbG9zZTogdHJ1ZVxyXG5cdFx0XHR9KSk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IF8uaGlnaGxpZ2h0KGVudi5jb2RlLCBlbnYuZ3JhbW1hciwgZW52Lmxhbmd1YWdlKTtcclxuXHJcblx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcclxuXHJcblx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XHJcblxyXG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVsZW1lbnQpO1xyXG5cclxuXHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XHJcblx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcclxuXHRcdHZhciB0b2tlbnMgPSBfLnRva2VuaXplKHRleHQsIGdyYW1tYXIpO1xyXG5cdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShfLnV0aWwuZW5jb2RlKHRva2VucyksIGxhbmd1YWdlKTtcclxuXHR9LFxyXG5cclxuXHRtYXRjaEdyYW1tYXI6IGZ1bmN0aW9uICh0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIGluZGV4LCBzdGFydFBvcywgb25lc2hvdCwgdGFyZ2V0KSB7XHJcblx0XHR2YXIgVG9rZW4gPSBfLlRva2VuO1xyXG5cclxuXHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcclxuXHRcdFx0aWYoIWdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pIHx8ICFncmFtbWFyW3Rva2VuXSkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodG9rZW4gPT0gdGFyZ2V0KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgcGF0dGVybnMgPSBncmFtbWFyW3Rva2VuXTtcclxuXHRcdFx0cGF0dGVybnMgPSAoXy51dGlsLnR5cGUocGF0dGVybnMpID09PSBcIkFycmF5XCIpID8gcGF0dGVybnMgOiBbcGF0dGVybnNdO1xyXG5cclxuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwYXR0ZXJucy5sZW5ndGg7ICsraikge1xyXG5cdFx0XHRcdHZhciBwYXR0ZXJuID0gcGF0dGVybnNbal0sXHJcblx0XHRcdFx0XHRpbnNpZGUgPSBwYXR0ZXJuLmluc2lkZSxcclxuXHRcdFx0XHRcdGxvb2tiZWhpbmQgPSAhIXBhdHRlcm4ubG9va2JlaGluZCxcclxuXHRcdFx0XHRcdGdyZWVkeSA9ICEhcGF0dGVybi5ncmVlZHksXHJcblx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gMCxcclxuXHRcdFx0XHRcdGFsaWFzID0gcGF0dGVybi5hbGlhcztcclxuXHJcblx0XHRcdFx0aWYgKGdyZWVkeSAmJiAhcGF0dGVybi5wYXR0ZXJuLmdsb2JhbCkge1xyXG5cdFx0XHRcdFx0Ly8gV2l0aG91dCB0aGUgZ2xvYmFsIGZsYWcsIGxhc3RJbmRleCB3b24ndCB3b3JrXHJcblx0XHRcdFx0XHR2YXIgZmxhZ3MgPSBwYXR0ZXJuLnBhdHRlcm4udG9TdHJpbmcoKS5tYXRjaCgvW2ltdXldKiQvKVswXTtcclxuXHRcdFx0XHRcdHBhdHRlcm4ucGF0dGVybiA9IFJlZ0V4cChwYXR0ZXJuLnBhdHRlcm4uc291cmNlLCBmbGFncyArIFwiZ1wiKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHBhdHRlcm4gPSBwYXR0ZXJuLnBhdHRlcm4gfHwgcGF0dGVybjtcclxuXHJcblx0XHRcdFx0Ly8gRG9u4oCZdCBjYWNoZSBsZW5ndGggYXMgaXQgY2hhbmdlcyBkdXJpbmcgdGhlIGxvb3BcclxuXHRcdFx0XHRmb3IgKHZhciBpID0gaW5kZXgsIHBvcyA9IHN0YXJ0UG9zOyBpIDwgc3RyYXJyLmxlbmd0aDsgcG9zICs9IHN0cmFycltpXS5sZW5ndGgsICsraSkge1xyXG5cclxuXHRcdFx0XHRcdHZhciBzdHIgPSBzdHJhcnJbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKHN0cmFyci5sZW5ndGggPiB0ZXh0Lmxlbmd0aCkge1xyXG5cdFx0XHRcdFx0XHQvLyBTb21ldGhpbmcgd2VudCB0ZXJyaWJseSB3cm9uZywgQUJPUlQsIEFCT1JUIVxyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKHN0ciBpbnN0YW5jZW9mIFRva2VuKSB7XHJcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gMDtcclxuXHJcblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMoc3RyKSxcclxuXHRcdFx0XHRcdCAgICBkZWxOdW0gPSAxO1xyXG5cclxuXHRcdFx0XHRcdC8vIEdyZWVkeSBwYXR0ZXJucyBjYW4gb3ZlcnJpZGUvcmVtb3ZlIHVwIHRvIHR3byBwcmV2aW91c2x5IG1hdGNoZWQgdG9rZW5zXHJcblx0XHRcdFx0XHRpZiAoIW1hdGNoICYmIGdyZWVkeSAmJiBpICE9IHN0cmFyci5sZW5ndGggLSAxKSB7XHJcblx0XHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gcG9zO1xyXG5cdFx0XHRcdFx0XHRtYXRjaCA9IHBhdHRlcm4uZXhlYyh0ZXh0KTtcclxuXHRcdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xyXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgKGxvb2tiZWhpbmQgPyBtYXRjaFsxXS5sZW5ndGggOiAwKSxcclxuXHRcdFx0XHRcdFx0ICAgIHRvID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgsXHJcblx0XHRcdFx0XHRcdCAgICBrID0gaSxcclxuXHRcdFx0XHRcdFx0ICAgIHAgPSBwb3M7XHJcblxyXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBsZW4gPSBzdHJhcnIubGVuZ3RoOyBrIDwgbGVuICYmIChwIDwgdG8gfHwgKCFzdHJhcnJba10udHlwZSAmJiAhc3RyYXJyW2sgLSAxXS5ncmVlZHkpKTsgKytrKSB7XHJcblx0XHRcdFx0XHRcdFx0cCArPSBzdHJhcnJba10ubGVuZ3RoO1xyXG5cdFx0XHRcdFx0XHRcdC8vIE1vdmUgdGhlIGluZGV4IGkgdG8gdGhlIGVsZW1lbnQgaW4gc3RyYXJyIHRoYXQgaXMgY2xvc2VzdCB0byBmcm9tXHJcblx0XHRcdFx0XHRcdFx0aWYgKGZyb20gPj0gcCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0KytpO1xyXG5cdFx0XHRcdFx0XHRcdFx0cG9zID0gcDtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8qXHJcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltpXSBpcyBhIFRva2VuLCB0aGVuIHRoZSBtYXRjaCBzdGFydHMgaW5zaWRlIGFub3RoZXIgVG9rZW4sIHdoaWNoIGlzIGludmFsaWRcclxuXHRcdFx0XHRcdFx0ICogSWYgc3RyYXJyW2sgLSAxXSBpcyBncmVlZHkgd2UgYXJlIGluIGNvbmZsaWN0IHdpdGggYW5vdGhlciBncmVlZHkgcGF0dGVyblxyXG5cdFx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdFx0aWYgKHN0cmFycltpXSBpbnN0YW5jZW9mIFRva2VuIHx8IHN0cmFycltrIC0gMV0uZ3JlZWR5KSB7XHJcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8vIE51bWJlciBvZiB0b2tlbnMgdG8gZGVsZXRlIGFuZCByZXBsYWNlIHdpdGggdGhlIG5ldyBtYXRjaFxyXG5cdFx0XHRcdFx0XHRkZWxOdW0gPSBrIC0gaTtcclxuXHRcdFx0XHRcdFx0c3RyID0gdGV4dC5zbGljZShwb3MsIHApO1xyXG5cdFx0XHRcdFx0XHRtYXRjaC5pbmRleCAtPSBwb3M7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xyXG5cdFx0XHRcdFx0XHRpZiAob25lc2hvdCkge1xyXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XHJcblx0XHRcdFx0XHRcdGxvb2tiZWhpbmRMZW5ndGggPSBtYXRjaFsxXS5sZW5ndGg7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dmFyIGZyb20gPSBtYXRjaC5pbmRleCArIGxvb2tiZWhpbmRMZW5ndGgsXHJcblx0XHRcdFx0XHQgICAgbWF0Y2ggPSBtYXRjaFswXS5zbGljZShsb29rYmVoaW5kTGVuZ3RoKSxcclxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBtYXRjaC5sZW5ndGgsXHJcblx0XHRcdFx0XHQgICAgYmVmb3JlID0gc3RyLnNsaWNlKDAsIGZyb20pLFxyXG5cdFx0XHRcdFx0ICAgIGFmdGVyID0gc3RyLnNsaWNlKHRvKTtcclxuXHJcblx0XHRcdFx0XHR2YXIgYXJncyA9IFtpLCBkZWxOdW1dO1xyXG5cclxuXHRcdFx0XHRcdGlmIChiZWZvcmUpIHtcclxuXHRcdFx0XHRcdFx0KytpO1xyXG5cdFx0XHRcdFx0XHRwb3MgKz0gYmVmb3JlLmxlbmd0aDtcclxuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGJlZm9yZSk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoLCBhbGlhcywgbWF0Y2gsIGdyZWVkeSk7XHJcblxyXG5cdFx0XHRcdFx0YXJncy5wdXNoKHdyYXBwZWQpO1xyXG5cclxuXHRcdFx0XHRcdGlmIChhZnRlcikge1xyXG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYWZ0ZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkoc3RyYXJyLCBhcmdzKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoZGVsTnVtICE9IDEpXHJcblx0XHRcdFx0XHRcdF8ubWF0Y2hHcmFtbWFyKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgaSwgcG9zLCB0cnVlLCB0b2tlbik7XHJcblxyXG5cdFx0XHRcdFx0aWYgKG9uZXNob3QpXHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdHRva2VuaXplOiBmdW5jdGlvbih0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xyXG5cdFx0dmFyIHN0cmFyciA9IFt0ZXh0XTtcclxuXHJcblx0XHR2YXIgcmVzdCA9IGdyYW1tYXIucmVzdDtcclxuXHJcblx0XHRpZiAocmVzdCkge1xyXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiByZXN0KSB7XHJcblx0XHRcdFx0Z3JhbW1hclt0b2tlbl0gPSByZXN0W3Rva2VuXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGVsZXRlIGdyYW1tYXIucmVzdDtcclxuXHRcdH1cclxuXHJcblx0XHRfLm1hdGNoR3JhbW1hcih0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIDAsIDAsIGZhbHNlKTtcclxuXHJcblx0XHRyZXR1cm4gc3RyYXJyO1xyXG5cdH0sXHJcblxyXG5cdGhvb2tzOiB7XHJcblx0XHRhbGw6IHt9LFxyXG5cclxuXHRcdGFkZDogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XHJcblx0XHRcdHZhciBob29rcyA9IF8uaG9va3MuYWxsO1xyXG5cclxuXHRcdFx0aG9va3NbbmFtZV0gPSBob29rc1tuYW1lXSB8fCBbXTtcclxuXHJcblx0XHRcdGhvb2tzW25hbWVdLnB1c2goY2FsbGJhY2spO1xyXG5cdFx0fSxcclxuXHJcblx0XHRydW46IGZ1bmN0aW9uIChuYW1lLCBlbnYpIHtcclxuXHRcdFx0dmFyIGNhbGxiYWNrcyA9IF8uaG9va3MuYWxsW25hbWVdO1xyXG5cclxuXHRcdFx0aWYgKCFjYWxsYmFja3MgfHwgIWNhbGxiYWNrcy5sZW5ndGgpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZvciAodmFyIGk9MCwgY2FsbGJhY2s7IGNhbGxiYWNrID0gY2FsbGJhY2tzW2krK107KSB7XHJcblx0XHRcdFx0Y2FsbGJhY2soZW52KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbnZhciBUb2tlbiA9IF8uVG9rZW4gPSBmdW5jdGlvbih0eXBlLCBjb250ZW50LCBhbGlhcywgbWF0Y2hlZFN0ciwgZ3JlZWR5KSB7XHJcblx0dGhpcy50eXBlID0gdHlwZTtcclxuXHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xyXG5cdHRoaXMuYWxpYXMgPSBhbGlhcztcclxuXHQvLyBDb3B5IG9mIHRoZSBmdWxsIHN0cmluZyB0aGlzIHRva2VuIHdhcyBjcmVhdGVkIGZyb21cclxuXHR0aGlzLmxlbmd0aCA9IChtYXRjaGVkU3RyIHx8IFwiXCIpLmxlbmd0aHwwO1xyXG5cdHRoaXMuZ3JlZWR5ID0gISFncmVlZHk7XHJcbn07XHJcblxyXG5Ub2tlbi5zdHJpbmdpZnkgPSBmdW5jdGlvbihvLCBsYW5ndWFnZSwgcGFyZW50KSB7XHJcblx0aWYgKHR5cGVvZiBvID09ICdzdHJpbmcnKSB7XHJcblx0XHRyZXR1cm4gbztcclxuXHR9XHJcblxyXG5cdGlmIChfLnV0aWwudHlwZShvKSA9PT0gJ0FycmF5Jykge1xyXG5cdFx0cmV0dXJuIG8ubWFwKGZ1bmN0aW9uKGVsZW1lbnQpIHtcclxuXHRcdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShlbGVtZW50LCBsYW5ndWFnZSwgbyk7XHJcblx0XHR9KS5qb2luKCcnKTtcclxuXHR9XHJcblxyXG5cdHZhciBlbnYgPSB7XHJcblx0XHR0eXBlOiBvLnR5cGUsXHJcblx0XHRjb250ZW50OiBUb2tlbi5zdHJpbmdpZnkoby5jb250ZW50LCBsYW5ndWFnZSwgcGFyZW50KSxcclxuXHRcdHRhZzogJ3NwYW4nLFxyXG5cdFx0Y2xhc3NlczogWyd0b2tlbicsIG8udHlwZV0sXHJcblx0XHRhdHRyaWJ1dGVzOiB7fSxcclxuXHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcclxuXHRcdHBhcmVudDogcGFyZW50XHJcblx0fTtcclxuXHJcblx0aWYgKGVudi50eXBlID09ICdjb21tZW50Jykge1xyXG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3NwZWxsY2hlY2snXSA9ICd0cnVlJztcclxuXHR9XHJcblxyXG5cdGlmIChvLmFsaWFzKSB7XHJcblx0XHR2YXIgYWxpYXNlcyA9IF8udXRpbC50eXBlKG8uYWxpYXMpID09PSAnQXJyYXknID8gby5hbGlhcyA6IFtvLmFsaWFzXTtcclxuXHRcdEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KGVudi5jbGFzc2VzLCBhbGlhc2VzKTtcclxuXHR9XHJcblxyXG5cdF8uaG9va3MucnVuKCd3cmFwJywgZW52KTtcclxuXHJcblx0dmFyIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhlbnYuYXR0cmlidXRlcykubWFwKGZ1bmN0aW9uKG5hbWUpIHtcclxuXHRcdHJldHVybiBuYW1lICsgJz1cIicgKyAoZW52LmF0dHJpYnV0ZXNbbmFtZV0gfHwgJycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKSArICdcIic7XHJcblx0fSkuam9pbignICcpO1xyXG5cclxuXHRyZXR1cm4gJzwnICsgZW52LnRhZyArICcgY2xhc3M9XCInICsgZW52LmNsYXNzZXMuam9pbignICcpICsgJ1wiJyArIChhdHRyaWJ1dGVzID8gJyAnICsgYXR0cmlidXRlcyA6ICcnKSArICc+JyArIGVudi5jb250ZW50ICsgJzwvJyArIGVudi50YWcgKyAnPic7XHJcblxyXG59O1xyXG5cclxuaWYgKCFfc2VsZi5kb2N1bWVudCkge1xyXG5cdGlmICghX3NlbGYuYWRkRXZlbnRMaXN0ZW5lcikge1xyXG5cdFx0Ly8gaW4gTm9kZS5qc1xyXG5cdFx0cmV0dXJuIF9zZWxmLlByaXNtO1xyXG5cdH1cclxuIFx0Ly8gSW4gd29ya2VyXHJcblx0X3NlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIG1lc3NhZ2UgPSBKU09OLnBhcnNlKGV2dC5kYXRhKSxcclxuXHRcdCAgICBsYW5nID0gbWVzc2FnZS5sYW5ndWFnZSxcclxuXHRcdCAgICBjb2RlID0gbWVzc2FnZS5jb2RlLFxyXG5cdFx0ICAgIGltbWVkaWF0ZUNsb3NlID0gbWVzc2FnZS5pbW1lZGlhdGVDbG9zZTtcclxuXHJcblx0XHRfc2VsZi5wb3N0TWVzc2FnZShfLmhpZ2hsaWdodChjb2RlLCBfLmxhbmd1YWdlc1tsYW5nXSwgbGFuZykpO1xyXG5cdFx0aWYgKGltbWVkaWF0ZUNsb3NlKSB7XHJcblx0XHRcdF9zZWxmLmNsb3NlKCk7XHJcblx0XHR9XHJcblx0fSwgZmFsc2UpO1xyXG5cclxuXHRyZXR1cm4gX3NlbGYuUHJpc207XHJcbn1cclxuXHJcbi8vR2V0IGN1cnJlbnQgc2NyaXB0IGFuZCBoaWdobGlnaHRcclxudmFyIHNjcmlwdCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQgfHwgW10uc2xpY2UuY2FsbChkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKSkucG9wKCk7XHJcblxyXG5pZiAoc2NyaXB0KSB7XHJcblx0Xy5maWxlbmFtZSA9IHNjcmlwdC5zcmM7XHJcblxyXG5cdGlmIChkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyICYmICFfLm1hbnVhbCAmJiAhc2NyaXB0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1tYW51YWwnKSkge1xyXG5cdFx0aWYoZG9jdW1lbnQucmVhZHlTdGF0ZSAhPT0gXCJsb2FkaW5nXCIpIHtcclxuXHRcdFx0aWYgKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcclxuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKF8uaGlnaGxpZ2h0QWxsKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dChfLmhpZ2hsaWdodEFsbCwgMTYpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIF8uaGlnaGxpZ2h0QWxsKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbnJldHVybiBfc2VsZi5QcmlzbTtcclxuXHJcbn0pKCk7XHJcblxyXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcclxuXHRtb2R1bGUuZXhwb3J0cyA9IFByaXNtO1xyXG59XHJcblxyXG4vLyBoYWNrIGZvciBjb21wb25lbnRzIHRvIHdvcmsgY29ycmVjdGx5IGluIG5vZGUuanNcclxuaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XHJcblx0Z2xvYmFsLlByaXNtID0gUHJpc207XHJcbn1cclxuXHJcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XHJcblx0J2NvbW1lbnQnOiAvPCEtLVtcXHNcXFNdKj8tLT4vLFxyXG5cdCdwcm9sb2cnOiAvPFxcP1tcXHNcXFNdKz9cXD8+LyxcclxuXHQnZG9jdHlwZSc6IC88IURPQ1RZUEVbXFxzXFxTXSs/Pi9pLFxyXG5cdCdjZGF0YSc6IC88IVxcW0NEQVRBXFxbW1xcc1xcU10qP11dPi9pLFxyXG5cdCd0YWcnOiB7XHJcblx0XHRwYXR0ZXJuOiAvPFxcLz8oPyFcXGQpW15cXHM+XFwvPSQ8XSsoPzpcXHMrW15cXHM+XFwvPV0rKD86PSg/OihcInwnKSg/OlxcXFxcXDF8XFxcXD8oPyFcXDEpW1xcc1xcU10pKlxcMXxbXlxccydcIj49XSspKT8pKlxccypcXC8/Pi9pLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdCd0YWcnOiB7XHJcblx0XHRcdFx0cGF0dGVybjogL148XFwvP1teXFxzPlxcL10rL2ksXHJcblx0XHRcdFx0aW5zaWRlOiB7XHJcblx0XHRcdFx0XHQncHVuY3R1YXRpb24nOiAvXjxcXC8/LyxcclxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvPSg/OignfFwiKVtcXHNcXFNdKj8oXFwxKXxbXlxccz5dKykvaSxcclxuXHRcdFx0XHRpbnNpZGU6IHtcclxuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9bPT5cIiddL1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+LyxcclxuXHRcdFx0J2F0dHItbmFtZSc6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvW15cXHM+XFwvXSsvLFxyXG5cdFx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdFx0J25hbWVzcGFjZSc6IC9eW15cXHM+XFwvOl0rOi9cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblx0fSxcclxuXHQnZW50aXR5JzogLyYjP1tcXGRhLXpdezEsOH07L2lcclxufTtcclxuXHJcbi8vIFBsdWdpbiB0byBtYWtlIGVudGl0eSB0aXRsZSBzaG93IHRoZSByZWFsIGVudGl0eSwgaWRlYSBieSBSb21hbiBLb21hcm92XHJcblByaXNtLmhvb2tzLmFkZCgnd3JhcCcsIGZ1bmN0aW9uKGVudikge1xyXG5cclxuXHRpZiAoZW52LnR5cGUgPT09ICdlbnRpdHknKSB7XHJcblx0XHRlbnYuYXR0cmlidXRlc1sndGl0bGUnXSA9IGVudi5jb250ZW50LnJlcGxhY2UoLyZhbXA7LywgJyYnKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLnhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XHJcblByaXNtLmxhbmd1YWdlcy5odG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcclxuUHJpc20ubGFuZ3VhZ2VzLm1hdGhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XHJcblByaXNtLmxhbmd1YWdlcy5zdmcgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xyXG5cclxuXHJcbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgICBCZWdpbiBwcmlzbS1jc3MuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNzcyA9IHtcclxuXHQnY29tbWVudCc6IC9cXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcclxuXHQnYXRydWxlJzoge1xyXG5cdFx0cGF0dGVybjogL0BbXFx3LV0rPy4qPyg7fCg/PVxccypcXHspKS9pLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdCdydWxlJzogL0BbXFx3LV0rL1xyXG5cdFx0XHQvLyBTZWUgcmVzdCBiZWxvd1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0J3VybCc6IC91cmxcXCgoPzooW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDF8Lio/KVxcKS9pLFxyXG5cdCdzZWxlY3Rvcic6IC9bXlxce1xcfVxcc11bXlxce1xcfTtdKj8oPz1cXHMqXFx7KS8sXHJcblx0J3N0cmluZyc6IHtcclxuXHRcdHBhdHRlcm46IC8oXCJ8JykoXFxcXCg/OlxcclxcbnxbXFxzXFxTXSl8KD8hXFwxKVteXFxcXFxcclxcbl0pKlxcMS8sXHJcblx0XHRncmVlZHk6IHRydWVcclxuXHR9LFxyXG5cdCdwcm9wZXJ0eSc6IC8oXFxifFxcQilbXFx3LV0rKD89XFxzKjopL2ksXHJcblx0J2ltcG9ydGFudCc6IC9cXEIhaW1wb3J0YW50XFxiL2ksXHJcblx0J2Z1bmN0aW9uJzogL1stYS16MC05XSsoPz1cXCgpL2ksXHJcblx0J3B1bmN0dWF0aW9uJzogL1soKXt9OzpdL1xyXG59O1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNzc1snYXRydWxlJ10uaW5zaWRlLnJlc3QgPSBQcmlzbS51dGlsLmNsb25lKFByaXNtLmxhbmd1YWdlcy5jc3MpO1xyXG5cclxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcclxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xyXG5cdFx0J3N0eWxlJzoge1xyXG5cdFx0XHRwYXR0ZXJuOiAvKDxzdHlsZVtcXHNcXFNdKj8+KVtcXHNcXFNdKj8oPz08XFwvc3R5bGU+KS9pLFxyXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5jc3MsXHJcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cdFxyXG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2luc2lkZScsICdhdHRyLXZhbHVlJywge1xyXG5cdFx0J3N0eWxlLWF0dHInOiB7XHJcblx0XHRcdHBhdHRlcm46IC9cXHMqc3R5bGU9KFwifCcpLio/XFwxL2ksXHJcblx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdCdhdHRyLW5hbWUnOiB7XHJcblx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxccypzdHlsZS9pLFxyXG5cdFx0XHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZy5pbnNpZGVcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9eXFxzKj1cXHMqWydcIl18WydcIl1cXHMqJC8sXHJcblx0XHRcdFx0J2F0dHItdmFsdWUnOiB7XHJcblx0XHRcdFx0XHRwYXR0ZXJuOiAvLisvaSxcclxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzc1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1jc3MnXHJcblx0XHR9XHJcblx0fSwgUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcpO1xyXG59XHJcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tY2xpa2UuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNsaWtlID0ge1xyXG5cdCdjb21tZW50JzogW1xyXG5cdFx0e1xyXG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcXSlcXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcclxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxyXG5cdFx0fSxcclxuXHRcdHtcclxuXHRcdFx0cGF0dGVybjogLyhefFteXFxcXDpdKVxcL1xcLy4qLyxcclxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxyXG5cdFx0fVxyXG5cdF0sXHJcblx0J3N0cmluZyc6IHtcclxuXHRcdHBhdHRlcm46IC8oW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxyXG5cdFx0Z3JlZWR5OiB0cnVlXHJcblx0fSxcclxuXHQnY2xhc3MtbmFtZSc6IHtcclxuXHRcdHBhdHRlcm46IC8oKD86XFxiKD86Y2xhc3N8aW50ZXJmYWNlfGV4dGVuZHN8aW1wbGVtZW50c3x0cmFpdHxpbnN0YW5jZW9mfG5ldylcXHMrKXwoPzpjYXRjaFxccytcXCgpKVthLXowLTlfXFwuXFxcXF0rL2ksXHJcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdHB1bmN0dWF0aW9uOiAvKFxcLnxcXFxcKS9cclxuXHRcdH1cclxuXHR9LFxyXG5cdCdrZXl3b3JkJzogL1xcYihpZnxlbHNlfHdoaWxlfGRvfGZvcnxyZXR1cm58aW58aW5zdGFuY2VvZnxmdW5jdGlvbnxuZXd8dHJ5fHRocm93fGNhdGNofGZpbmFsbHl8bnVsbHxicmVha3xjb250aW51ZSlcXGIvLFxyXG5cdCdib29sZWFuJzogL1xcYih0cnVlfGZhbHNlKVxcYi8sXHJcblx0J2Z1bmN0aW9uJzogL1thLXowLTlfXSsoPz1cXCgpL2ksXHJcblx0J251bWJlcic6IC9cXGItPyg/OjB4W1xcZGEtZl0rfFxcZCpcXC4/XFxkKyg/OmVbKy1dP1xcZCspPylcXGIvaSxcclxuXHQnb3BlcmF0b3InOiAvLS0/fFxcK1xcKz98IT0/PT98PD0/fD49P3w9PT89P3wmJj98XFx8XFx8P3xcXD98XFwqfFxcL3x+fFxcXnwlLyxcclxuXHQncHVuY3R1YXRpb24nOiAvW3t9W1xcXTsoKSwuOl0vXHJcbn07XHJcblxyXG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLWphdmFzY3JpcHQuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQgPSBQcmlzbS5sYW5ndWFnZXMuZXh0ZW5kKCdjbGlrZScsIHtcclxuXHQna2V5d29yZCc6IC9cXGIoYXN8YXN5bmN8YXdhaXR8YnJlYWt8Y2FzZXxjYXRjaHxjbGFzc3xjb25zdHxjb250aW51ZXxkZWJ1Z2dlcnxkZWZhdWx0fGRlbGV0ZXxkb3xlbHNlfGVudW18ZXhwb3J0fGV4dGVuZHN8ZmluYWxseXxmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dmFyfHZvaWR8d2hpbGV8d2l0aHx5aWVsZClcXGIvLFxyXG5cdCdudW1iZXInOiAvXFxiLT8oMHhbXFxkQS1GYS1mXSt8MGJbMDFdK3wwb1swLTddK3xcXGQqXFwuP1xcZCsoW0VlXVsrLV0/XFxkKyk/fE5hTnxJbmZpbml0eSlcXGIvLFxyXG5cdC8vIEFsbG93IGZvciBhbGwgbm9uLUFTQ0lJIGNoYXJhY3RlcnMgKFNlZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMDA4NDQ0KVxyXG5cdCdmdW5jdGlvbic6IC9bXyRhLXpBLVpcXHhBMC1cXHVGRkZGXVtfJGEtekEtWjAtOVxceEEwLVxcdUZGRkZdKig/PVxcKCkvaSxcclxuXHQnb3BlcmF0b3InOiAvLVstPV0/fFxcK1srPV0/fCE9Pz0/fDw8Pz0/fD4+Pz4/PT98PSg/Oj09P3w+KT98JlsmPV0/fFxcfFt8PV0/fFxcKlxcKj89P3xcXC89P3x+fFxcXj0/fCU9P3xcXD98XFwuezN9L1xyXG59KTtcclxuXHJcblByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2phdmFzY3JpcHQnLCAna2V5d29yZCcsIHtcclxuXHQncmVnZXgnOiB7XHJcblx0XHRwYXR0ZXJuOiAvKF58W14vXSlcXC8oPyFcXC8pKFxcWy4rP118XFxcXC58W14vXFxcXFxcclxcbl0pK1xcL1tnaW15dV17MCw1fSg/PVxccyooJHxbXFxyXFxuLC47fSldKSkvLFxyXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcclxuXHRcdGdyZWVkeTogdHJ1ZVxyXG5cdH1cclxufSk7XHJcblxyXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ3N0cmluZycsIHtcclxuXHQndGVtcGxhdGUtc3RyaW5nJzoge1xyXG5cdFx0cGF0dGVybjogL2AoPzpcXFxcXFxcXHxcXFxcP1teXFxcXF0pKj9gLyxcclxuXHRcdGdyZWVkeTogdHJ1ZSxcclxuXHRcdGluc2lkZToge1xyXG5cdFx0XHQnaW50ZXJwb2xhdGlvbic6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvXFwkXFx7W159XStcXH0vLFxyXG5cdFx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdFx0J2ludGVycG9sYXRpb24tcHVuY3R1YXRpb24nOiB7XHJcblx0XHRcdFx0XHRcdHBhdHRlcm46IC9eXFwkXFx7fFxcfSQvLFxyXG5cdFx0XHRcdFx0XHRhbGlhczogJ3B1bmN0dWF0aW9uJ1xyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHJlc3Q6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnc3RyaW5nJzogL1tcXHNcXFNdKy9cclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG5cclxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcclxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xyXG5cdFx0J3NjcmlwdCc6IHtcclxuXHRcdFx0cGF0dGVybjogLyg8c2NyaXB0W1xcc1xcU10qPz4pW1xcc1xcU10qPyg/PTxcXC9zY3JpcHQ+KS9pLFxyXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0LFxyXG5cdFx0XHRhbGlhczogJ2xhbmd1YWdlLWphdmFzY3JpcHQnXHJcblx0XHR9XHJcblx0fSk7XHJcbn1cclxuXHJcblByaXNtLmxhbmd1YWdlcy5qcyA9IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0O1xyXG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLWZpbGUtaGlnaGxpZ2h0LmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcbihmdW5jdGlvbiAoKSB7XHJcblx0aWYgKHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyB8fCAhc2VsZi5QcmlzbSB8fCAhc2VsZi5kb2N1bWVudCB8fCAhZG9jdW1lbnQucXVlcnlTZWxlY3Rvcikge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0c2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdFx0dmFyIEV4dGVuc2lvbnMgPSB7XHJcblx0XHRcdCdqcyc6ICdqYXZhc2NyaXB0JyxcclxuXHRcdFx0J3B5JzogJ3B5dGhvbicsXHJcblx0XHRcdCdyYic6ICdydWJ5JyxcclxuXHRcdFx0J3BzMSc6ICdwb3dlcnNoZWxsJyxcclxuXHRcdFx0J3BzbTEnOiAncG93ZXJzaGVsbCcsXHJcblx0XHRcdCdzaCc6ICdiYXNoJyxcclxuXHRcdFx0J2JhdCc6ICdiYXRjaCcsXHJcblx0XHRcdCdoJzogJ2MnLFxyXG5cdFx0XHQndGV4JzogJ2xhdGV4J1xyXG5cdFx0fTtcclxuXHJcblx0XHRpZihBcnJheS5wcm90b3R5cGUuZm9yRWFjaCkgeyAvLyBDaGVjayB0byBwcmV2ZW50IGVycm9yIGluIElFOFxyXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdwcmVbZGF0YS1zcmNdJykpLmZvckVhY2goZnVuY3Rpb24gKHByZSkge1xyXG5cdFx0XHRcdHZhciBzcmMgPSBwcmUuZ2V0QXR0cmlidXRlKCdkYXRhLXNyYycpO1xyXG5cclxuXHRcdFx0XHR2YXIgbGFuZ3VhZ2UsIHBhcmVudCA9IHByZTtcclxuXHRcdFx0XHR2YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LSg/IVxcKikoXFx3KylcXGIvaTtcclxuXHRcdFx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcclxuXHRcdFx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKHBhcmVudCkge1xyXG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSAocHJlLmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCAnJ10pWzFdO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCFsYW5ndWFnZSkge1xyXG5cdFx0XHRcdFx0dmFyIGV4dGVuc2lvbiA9IChzcmMubWF0Y2goL1xcLihcXHcrKSQvKSB8fCBbLCAnJ10pWzFdO1xyXG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSBFeHRlbnNpb25zW2V4dGVuc2lvbl0gfHwgZXh0ZW5zaW9uO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIGNvZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjb2RlJyk7XHJcblx0XHRcdFx0Y29kZS5jbGFzc05hbWUgPSAnbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cclxuXHRcdFx0XHRwcmUudGV4dENvbnRlbnQgPSAnJztcclxuXHJcblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICdMb2FkaW5n4oCmJztcclxuXHJcblx0XHRcdFx0cHJlLmFwcGVuZENoaWxkKGNvZGUpO1xyXG5cclxuXHRcdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcblxyXG5cdFx0XHRcdHhoci5vcGVuKCdHRVQnLCBzcmMsIHRydWUpO1xyXG5cclxuXHRcdFx0XHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlID09IDQpIHtcclxuXHJcblx0XHRcdFx0XHRcdGlmICh4aHIuc3RhdHVzIDwgNDAwICYmIHhoci5yZXNwb25zZVRleHQpIHtcclxuXHRcdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0geGhyLnJlc3BvbnNlVGV4dDtcclxuXHJcblx0XHRcdFx0XHRcdFx0UHJpc20uaGlnaGxpZ2h0RWxlbWVudChjb2RlKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRlbHNlIGlmICh4aHIuc3RhdHVzID49IDQwMCkge1xyXG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yICcgKyB4aHIuc3RhdHVzICsgJyB3aGlsZSBmZXRjaGluZyBmaWxlOiAnICsgeGhyLnN0YXR1c1RleHQ7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3I6IEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgaXMgZW1wdHknO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0eGhyLnNlbmQobnVsbCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgc2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0KTtcclxuXHJcbn0pKCk7XHJcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgYmFja2Ryb3BzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUJhY2tkcm9wRm9yU2xpZGUoc2xpZGUpIHtcclxuICAgICAgdmFyIGJhY2tkcm9wQXR0cmlidXRlID0gc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtYmFja2Ryb3AnKTtcclxuXHJcbiAgICAgIGlmIChiYWNrZHJvcEF0dHJpYnV0ZSkge1xyXG4gICAgICAgIHZhciBiYWNrZHJvcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTmFtZSA9IGJhY2tkcm9wQXR0cmlidXRlO1xyXG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYmFja2Ryb3AnKTtcclxuICAgICAgICBkZWNrLnBhcmVudC5hcHBlbmRDaGlsZChiYWNrZHJvcCk7XHJcbiAgICAgICAgcmV0dXJuIGJhY2tkcm9wO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlQ2xhc3NlcyhlbCkge1xyXG4gICAgICBpZiAoZWwpIHtcclxuICAgICAgICB2YXIgaW5kZXggPSBiYWNrZHJvcHMuaW5kZXhPZihlbCksXHJcbiAgICAgICAgICBjdXJyZW50SW5kZXggPSBkZWNrLnNsaWRlKCk7XHJcblxyXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYWN0aXZlJyk7XHJcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdpbmFjdGl2ZScpO1xyXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYmVmb3JlJyk7XHJcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdhZnRlcicpO1xyXG5cclxuICAgICAgICBpZiAoaW5kZXggIT09IGN1cnJlbnRJbmRleCkge1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdpbmFjdGl2ZScpO1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsIGluZGV4IDwgY3VycmVudEluZGV4ID8gJ2JlZm9yZScgOiAnYWZ0ZXInKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdhY3RpdmUnKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZW1vdmVDbGFzcyhlbCwgY2xhc3NOYW1lKSB7XHJcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYmFja2Ryb3AtJyArIGNsYXNzTmFtZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkQ2xhc3MoZWwsIGNsYXNzTmFtZSkge1xyXG4gICAgICBlbC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJhY2tkcm9wLScgKyBjbGFzc05hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGJhY2tkcm9wcyA9IGRlY2suc2xpZGVzXHJcbiAgICAgIC5tYXAoY3JlYXRlQmFja2Ryb3BGb3JTbGlkZSk7XHJcblxyXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgYmFja2Ryb3BzLmZvckVhY2godXBkYXRlQ2xhc3Nlcyk7XHJcbiAgICB9KTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGFjdGl2ZVNsaWRlSW5kZXgsXHJcbiAgICAgIGFjdGl2ZUJ1bGxldEluZGV4LFxyXG5cclxuICAgICAgYnVsbGV0cyA9IGRlY2suc2xpZGVzLm1hcChmdW5jdGlvbihzbGlkZSkge1xyXG4gICAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKHNsaWRlLnF1ZXJ5U2VsZWN0b3JBbGwoKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiAnW2RhdGEtYmVzcG9rZS1idWxsZXRdJykpLCAwKTtcclxuICAgICAgfSksXHJcblxyXG4gICAgICBuZXh0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIG5leHRTbGlkZUluZGV4ID0gYWN0aXZlU2xpZGVJbmRleCArIDE7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KDEpKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChhY3RpdmVTbGlkZUluZGV4LCBhY3RpdmVCdWxsZXRJbmRleCArIDEpO1xyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoYnVsbGV0c1tuZXh0U2xpZGVJbmRleF0pIHtcclxuICAgICAgICAgIGFjdGl2YXRlQnVsbGV0KG5leHRTbGlkZUluZGV4LCAwKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBwcmV2ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIHByZXZTbGlkZUluZGV4ID0gYWN0aXZlU2xpZGVJbmRleCAtIDE7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KC0xKSkge1xyXG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQoYWN0aXZlU2xpZGVJbmRleCwgYWN0aXZlQnVsbGV0SW5kZXggLSAxKTtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGJ1bGxldHNbcHJldlNsaWRlSW5kZXhdKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChwcmV2U2xpZGVJbmRleCwgYnVsbGV0c1twcmV2U2xpZGVJbmRleF0ubGVuZ3RoIC0gMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgYWN0aXZhdGVCdWxsZXQgPSBmdW5jdGlvbihzbGlkZUluZGV4LCBidWxsZXRJbmRleCkge1xyXG4gICAgICAgIGFjdGl2ZVNsaWRlSW5kZXggPSBzbGlkZUluZGV4O1xyXG4gICAgICAgIGFjdGl2ZUJ1bGxldEluZGV4ID0gYnVsbGV0SW5kZXg7XHJcblxyXG4gICAgICAgIGJ1bGxldHMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSwgcykge1xyXG4gICAgICAgICAgc2xpZGUuZm9yRWFjaChmdW5jdGlvbihidWxsZXQsIGIpIHtcclxuICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0Jyk7XHJcblxyXG4gICAgICAgICAgICBpZiAocyA8IHNsaWRlSW5kZXggfHwgcyA9PT0gc2xpZGVJbmRleCAmJiBiIDw9IGJ1bGxldEluZGV4KSB7XHJcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0LWFjdGl2ZScpO1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZScpO1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1hY3RpdmUnKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHMgPT09IHNsaWRlSW5kZXggJiYgYiA9PT0gYnVsbGV0SW5kZXgpIHtcclxuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtY3VycmVudCcpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1jdXJyZW50Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9LFxyXG5cclxuICAgICAgYWN0aXZlU2xpZGVIYXNCdWxsZXRCeU9mZnNldCA9IGZ1bmN0aW9uKG9mZnNldCkge1xyXG4gICAgICAgIHJldHVybiBidWxsZXRzW2FjdGl2ZVNsaWRlSW5kZXhdW2FjdGl2ZUJ1bGxldEluZGV4ICsgb2Zmc2V0XSAhPT0gdW5kZWZpbmVkO1xyXG4gICAgICB9O1xyXG5cclxuICAgIGRlY2sub24oJ25leHQnLCBuZXh0KTtcclxuICAgIGRlY2sub24oJ3ByZXYnLCBwcmV2KTtcclxuXHJcbiAgICBkZWNrLm9uKCdzbGlkZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgYWN0aXZhdGVCdWxsZXQoZS5pbmRleCwgMCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBhY3RpdmF0ZUJ1bGxldCgwLCAwKTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICBkZWNrLnNsaWRlcy5mb3JFYWNoKGZ1bmN0aW9uKHNsaWRlKSB7XHJcbiAgICAgIHNsaWRlLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKC9JTlBVVHxURVhUQVJFQXxTRUxFQ1QvLnRlc3QoZS50YXJnZXQubm9kZU5hbWUpIHx8IGUudGFyZ2V0LmNvbnRlbnRFZGl0YWJsZSA9PT0gJ3RydWUnKSB7XHJcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIChkZWNrKSB7XHJcbiAgICB2YXIgb3B0aW9ucyA9IG9wdGlvbnMgPT09IHVuZGVmaW5lZCA/IHt9IDogb3B0aW9ucztcclxuXHJcbiAgICB2YXIgZGlyZWN0aW9uID0gb3B0aW9ucy5kaXJlY3Rpb24gPT09IHVuZGVmaW5lZCB8fCBvcHRpb25zLmRpcmVjdGlvbiA9PT0gbnVsbCA/ICdob3Jpem9udGFsJyA6IG9wdGlvbnMuZGlyZWN0aW9uO1xyXG4gICAgdmFyIGRlZmF1bHRfYXhpcyA9IGRpcmVjdGlvbiA9PT0gJ3ZlcnRpY2FsJyA/ICdZJyA6ICdYJztcclxuICAgIHZhciB0cmFuc2l0aW9uID0gb3B0aW9ucy50cmFuc2l0aW9uID8gb3B0aW9ucy50cmFuc2l0aW9uIDogJ21vdmUnO1xyXG4gICAgdmFyIHJldmVyc2UgPSBvcHRpb25zLnJldmVyc2UgPyBvcHRpb25zLnJldmVyc2UgOiBmYWxzZTtcclxuICAgIHZhciBwbHVnaW4gPSB7XHJcbiAgICAgIGZ4OiB7XHJcbiAgICAgICAgJ21vdmUnOiB7XHJcbiAgICAgICAgICAnWCc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnbW92ZS10by1sZWZ0LWZyb20tcmlnaHQnLFxyXG4gICAgICAgICAgICAncHJldic6ICdtb3ZlLXRvLXJpZ2h0LWZyb20tbGVmdCdcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAnWSc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnbW92ZS10by10b3AtZnJvbS1ib3R0b20nLFxyXG4gICAgICAgICAgICAncHJldic6ICdtb3ZlLXRvLWJvdHRvbS1mcm9tLXRvcCdcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdtb3ZlLWZhZGUnOiB7XHJcbiAgICAgICAgICAnWCc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnZmFkZS1mcm9tLXJpZ2h0JyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnZmFkZS1mcm9tLWxlZnQnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ1knOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2ZhZGUtZnJvbS1ib3R0b20nLFxyXG4gICAgICAgICAgICAncHJldic6ICdmYWRlLWZyb20tdG9wJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ21vdmUtYm90aC1mYWRlJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2ZhZGUtbGVmdC1mYWRlLXJpZ2h0JyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnZmFkZS1yaWdodC1mYWRlLWxlZnQnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ1knOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2ZhZGUtdG9wLWZhZGUtYm90dG9tJyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnZmFkZS1ib3R0b20tZmFkZS10b3AnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAnbW92ZS1kaWZmZXJlbnQtZWFzaW5nJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1yaWdodCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1sZWZ0J1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdZJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tYm90dG9tJyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnZGlmZmVyZW50LWVhc2luZy1mcm9tLXRvcCdcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdzY2FsZS1kb3duLW91dC1tb3ZlLWluJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ3NjYWxlLWRvd24tZnJvbS1yaWdodCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ21vdmUtdG8tcmlnaHQtc2NhbGUtdXAnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ1knOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ3NjYWxlLWRvd24tZnJvbS1ib3R0b20nLFxyXG4gICAgICAgICAgICAncHJldic6ICdtb3ZlLXRvLWJvdHRvbS1zY2FsZS11cCdcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdtb3ZlLW91dC1zY2FsZS11cCc6IHtcclxuICAgICAgICAgICdYJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdtb3ZlLXRvLWxlZnQtc2NhbGUtdXAnLFxyXG4gICAgICAgICAgICAncHJldic6ICdzY2FsZS1kb3duLWZyb20tbGVmdCdcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAnWSc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnbW92ZS10by10b3Atc2NhbGUtdXAnLFxyXG4gICAgICAgICAgICAncHJldic6ICdzY2FsZS1kb3duLWZyb20tdG9wJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3NjYWxlLXVwLXVwJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ3NjYWxlLXVwLXNjYWxlLXVwJyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnc2NhbGUtZG93bi1zY2FsZS1kb3duJ1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdZJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdzY2FsZS11cC1zY2FsZS11cCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ3NjYWxlLWRvd24tc2NhbGUtZG93bidcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdzY2FsZS1kb3duLXVwJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ3NjYWxlLWRvd24tc2NhbGUtdXAnLFxyXG4gICAgICAgICAgICAncHJldic6ICdzY2FsZS1kb3duLXNjYWxlLXVwJ1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdZJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdzY2FsZS1kb3duLXNjYWxlLXVwJyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnc2NhbGUtZG93bi1zY2FsZS11cCdcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdnbHVlJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2dsdWUtbGVmdC1mcm9tLXJpZ2h0JyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnZ2x1ZS1yaWdodC1mcm9tLWxlZnQnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ1knOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2dsdWUtdG9wLWZyb20tYm90dG9tJyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnZ2x1ZS1ib3R0b20tZnJvbS10b3AnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZmxpcCc6IHtcclxuICAgICAgICAgICdYJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdmbGlwLWxlZnQnLFxyXG4gICAgICAgICAgICAncHJldic6ICdmbGlwLXJpZ2h0J1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdZJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdmbGlwLXRvcCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ2ZsaXAtYm90dG9tJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2ZhbGwnOiB7XHJcbiAgICAgICAgICAnWCc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnZmFsbCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ2ZhbGwnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ1knOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2ZhbGwnLFxyXG4gICAgICAgICAgICAncHJldic6ICdmYWxsJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ25ld3NwYXBlcic6IHtcclxuICAgICAgICAgICdYJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICduZXdzcGFwZXInLFxyXG4gICAgICAgICAgICAncHJldic6ICduZXdzcGFwZXInXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ1knOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ25ld3NwYXBlcicsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ25ld3NwYXBlcidcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdwdXNoJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ3B1c2gtbGVmdC1mcm9tLXJpZ2h0JyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAncHVzaC1yaWdodC1mcm9tLWxlZnQnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ1knOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ3B1c2gtdG9wLWZyb20tYm90dG9tJyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAncHVzaC1ib3R0b20tZnJvbS10b3AnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAncHVsbCc6IHtcclxuICAgICAgICAgICdYJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdwdXNoLWxlZnQtcHVsbC1yaWdodCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ3B1c2gtcmlnaHQtcHVsbC1sZWZ0J1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdZJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdwdXNoLWJvdHRvbS1wdWxsLXRvcCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ3B1c2gtdG9wLXB1bGwtYm90dG9tJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2ZvbGQnOiB7XHJcbiAgICAgICAgICAnWCc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnZm9sZC1sZWZ0LWZyb20tcmlnaHQnLFxyXG4gICAgICAgICAgICAncHJldic6ICdtb3ZlLXRvLXJpZ2h0LXVuZm9sZC1sZWZ0J1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdZJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdmb2xkLWJvdHRvbS1mcm9tLXRvcCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ21vdmUtdG8tdG9wLXVuZm9sZC1ib3R0b20nXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAndW5mb2xkJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ21vdmUtdG8tbGVmdC11bmZvbGQtcmlnaHQnLFxyXG4gICAgICAgICAgICAncHJldic6ICdmb2xkLXJpZ2h0LWZyb20tbGVmdCdcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAnWSc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnbW92ZS10by1ib3R0b20tdW5mb2xkLXRvcCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ2ZvbGQtdG9wLWZyb20tYm90dG9tJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3Jvb20nOiB7XHJcbiAgICAgICAgICAnWCc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAncm9vbS10by1sZWZ0JyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAncm9vbS10by1yaWdodCdcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAnWSc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAncm9vbS10by1ib3R0b20nLFxyXG4gICAgICAgICAgICAncHJldic6ICdyb29tLXRvLXRvcCdcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdjdWJlJzoge1xyXG4gICAgICAgICAgJ1gnOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2N1YmUtdG8tbGVmdCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ2N1YmUtdG8tcmlnaHQnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ1knOiB7XHJcbiAgICAgICAgICAgICduZXh0JzogJ2N1YmUtdG8tYm90dG9tJyxcclxuICAgICAgICAgICAgJ3ByZXYnOiAnY3ViZS10by10b3AnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAnY2Fyb3VzZWwnOiB7XHJcbiAgICAgICAgICAnWCc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnY2Fyb3VzZWwtdG8tbGVmdCcsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ2Nhcm91c2VsLXRvLXJpZ2h0J1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdZJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdjYXJvdXNlbC10by1ib3R0b20nLFxyXG4gICAgICAgICAgICAncHJldic6ICdjYXJvdXNlbC10by10b3AnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAnc2lkZXMnOiB7XHJcbiAgICAgICAgICAnWCc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnc2lkZXMnLFxyXG4gICAgICAgICAgICAncHJldic6ICdzaWRlcydcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAnWSc6IHtcclxuICAgICAgICAgICAgJ25leHQnOiAnc2lkZXMnLFxyXG4gICAgICAgICAgICAncHJldic6ICdzaWRlcydcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdzbGlkZSc6IHtcclxuICAgICAgICAgICdYJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdzbGlkZScsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ3NsaWRlJ1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdZJzoge1xyXG4gICAgICAgICAgICAnbmV4dCc6ICdzbGlkZScsXHJcbiAgICAgICAgICAgICdwcmV2JzogJ3NsaWRlJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgYW5pbWF0aW9uczoge1xyXG4gICAgICAgIC8vIE1vdmVcclxuICAgICAgICAnbW92ZS10by1sZWZ0LWZyb20tcmlnaHQnOiB7XHJcbiAgICAgICAgICBpZDogMSxcclxuICAgICAgICAgIGdyb3VwOiAnbW92ZScsXHJcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gbGVmdCAvIGZyb20gcmlnaHQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9MZWZ0JyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0JyxcclxuICAgICAgICAgIHJldmVyc2U6ICdtb3ZlLXRvLXJpZ2h0LWZyb20tbGVmdCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdtb3ZlLXRvLXJpZ2h0LWZyb20tbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiAyLFxyXG4gICAgICAgICAgZ3JvdXA6ICdtb3ZlJyxcclxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byByaWdodCAvIGZyb20gbGVmdCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1JpZ2h0JyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUxlZnQnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tbGVmdC1mcm9tLXJpZ2h0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ21vdmUtdG8tdG9wLWZyb20tYm90dG9tJzoge1xyXG4gICAgICAgICAgaWQ6IDMsXHJcbiAgICAgICAgICBncm91cDogJ21vdmUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIHRvcCAvIGZyb20gYm90dG9tJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvVG9wJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUJvdHRvbScsXHJcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1ib3R0b20tZnJvbS10b3AnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnbW92ZS10by1ib3R0b20tZnJvbS10b3AnOiB7XHJcbiAgICAgICAgICBpZDogNCxcclxuICAgICAgICAgIGdyb3VwOiAnbW92ZScsXHJcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gYm90dG9tIC8gZnJvbSB0b3AnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Cb3R0b20nLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tVG9wJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdtb3ZlLXRvLXRvcC1mcm9tLWJvdHRvbSdcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBGYWRlXHJcbiAgICAgICAgJ2ZhZGUtZnJvbS1yaWdodCc6IHtcclxuICAgICAgICAgIGlkOiA1LFxyXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcclxuICAgICAgICAgIGxhYmVsOiAnRmFkZSAvIGZyb20gcmlnaHQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1mYWRlJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0IGZ4LXNsaWRlLW9udG9wJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWZyb20tbGVmdCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdmYWRlLWZyb20tbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiA2LFxyXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcclxuICAgICAgICAgIGxhYmVsOiAnRmFkZSAvIGZyb20gbGVmdCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZhZGUnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnZmFkZS1mcm9tLXJpZ2h0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2ZhZGUtZnJvbS1ib3R0b20nOiB7XHJcbiAgICAgICAgICBpZDogNyxcclxuICAgICAgICAgIGdyb3VwOiAnZmFkZScsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgLyBmcm9tIGJvdHRvbScsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZhZGUnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tQm90dG9tIGZ4LXNsaWRlLW9udG9wJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWZyb20tdG9wJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2ZhZGUtZnJvbS10b3AnOiB7XHJcbiAgICAgICAgICBpZDogOCxcclxuICAgICAgICAgIGdyb3VwOiAnZmFkZScsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgLyBmcm9tIHRvcCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZhZGUnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tVG9wIGZ4LXNsaWRlLW9udG9wJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWZyb20tYm90dG9tJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2ZhZGUtbGVmdC1mYWRlLXJpZ2h0Jzoge1xyXG4gICAgICAgICAgaWQ6IDksXHJcbiAgICAgICAgICBncm91cDogJ2ZhZGUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdGYWRlIGxlZnQgLyBGYWRlIHJpZ2h0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvTGVmdEZhZGUnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tUmlnaHRGYWRlJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLXJpZ2h0LWZhZGUtbGVmdCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdmYWRlLXJpZ2h0LWZhZGUtbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiAxMCxcclxuICAgICAgICAgIGdyb3VwOiAnZmFkZScsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgcmlnaHQgLyBGYWRlIGxlZnQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9SaWdodEZhZGUnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdEZhZGUnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhZGUtbGVmdC1mYWRlLXJpZ2h0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2ZhZGUtdG9wLWZhZGUtYm90dG9tJzoge1xyXG4gICAgICAgICAgaWQ6IDExLFxyXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcclxuICAgICAgICAgIGxhYmVsOiAnRmFkZSB0b3AgLyBGYWRlIGJvdHRvbScsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1RvcEZhZGUnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tQm90dG9tRmFkZScsXHJcbiAgICAgICAgICByZXZlcnNlOiAnZmFkZS1ib3R0b20tZmFkZS10b3AnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZmFkZS1ib3R0b20tZmFkZS10b3AnOiB7XHJcbiAgICAgICAgICBpZDogMTIsXHJcbiAgICAgICAgICBncm91cDogJ2ZhZGUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdGYWRlIGJvdHRvbSAvIEZhZGUgdG9wJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvQm90dG9tRmFkZScsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Ub3BGYWRlJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLXRvcC1mYWRlLWJvdHRvbSdcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBEaWZmZXJlbnQgZWFzaW5nXHJcbiAgICAgICAgJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1yaWdodCc6IHtcclxuICAgICAgICAgIGlkOiAxMyxcclxuICAgICAgICAgIGdyb3VwOiAnZGlmZmVyZW50LWVhc2luZycsXHJcbiAgICAgICAgICBsYWJlbDogJ0RpZmZlcmVudCBlYXNpbmcgLyBmcm9tIHJpZ2h0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvTGVmdEVhc2luZyBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21SaWdodCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnZGlmZmVyZW50LWVhc2luZy1mcm9tLWxlZnQnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZGlmZmVyZW50LWVhc2luZy1mcm9tLWxlZnQnOiB7XHJcbiAgICAgICAgICBpZDogMTQsXHJcbiAgICAgICAgICBncm91cDogJ2RpZmZlcmVudC1lYXNpbmcnLFxyXG4gICAgICAgICAgbGFiZWw6ICdEaWZmZXJlbnQgZWFzaW5nIC8gZnJvbSBsZWZ0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvUmlnaHRFYXNpbmcgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnZGlmZmVyZW50LWVhc2luZy1mcm9tLXJpZ2h0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1ib3R0b20nOiB7XHJcbiAgICAgICAgICBpZDogMTUsXHJcbiAgICAgICAgICBncm91cDogJ2RpZmZlcmVudC1lYXNpbmcnLFxyXG4gICAgICAgICAgbGFiZWw6ICdEaWZmZXJlbnQgZWFzaW5nIC8gZnJvbSBib3R0b20nLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Ub3BFYXNpbmcgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tQm90dG9tJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tdG9wJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2RpZmZlcmVudC1lYXNpbmctZnJvbS10b3AnOiB7XHJcbiAgICAgICAgICBpZDogMTYsXHJcbiAgICAgICAgICBncm91cDogJ2RpZmZlcmVudC1lYXNpbmcnLFxyXG4gICAgICAgICAgbGFiZWw6ICdEaWZmZXJlbnQgZWFzaW5nIC8gZnJvbSB0b3AnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Cb3R0b21FYXNpbmcgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tVG9wJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tYm90dG9tJ1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIFNjYWxlXHJcbiAgICAgICAgJ3NjYWxlLWRvd24tZnJvbS1yaWdodCc6IHtcclxuICAgICAgICAgIGlkOiAxNyxcclxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdTY2FsZSBkb3duIC8gZnJvbSByaWdodCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93bicsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21SaWdodCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1yaWdodC1zY2FsZS11cCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdzY2FsZS1kb3duLWZyb20tbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiAxOCxcclxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdTY2FsZSBkb3duIC8gZnJvbSBsZWZ0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtc2NhbGVEb3duJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUxlZnQgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tbGVmdC1zY2FsZS11cCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdzY2FsZS1kb3duLWZyb20tYm90dG9tJzoge1xyXG4gICAgICAgICAgaWQ6IDE5LFxyXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXHJcbiAgICAgICAgICBsYWJlbDogJ1NjYWxlIGRvd24gLyBmcm9tIGJvdHRvbScsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93bicsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b20gZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tYm90dG9tLXNjYWxlLXVwJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3NjYWxlLWRvd24tZnJvbS10b3AnOiB7XHJcbiAgICAgICAgICBpZDogMjAsXHJcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcclxuICAgICAgICAgIGxhYmVsOiAnU2NhbGUgZG93biAvIGZyb20gdG9wJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtc2NhbGVEb3duJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by10b3Atc2NhbGUtdXAnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnc2NhbGUtZG93bi1zY2FsZS1kb3duJzoge1xyXG4gICAgICAgICAgaWQ6IDIxLFxyXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXHJcbiAgICAgICAgICBsYWJlbDogJ1NjYWxlIGRvd24gLyBzY2FsZSBkb3duJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtc2NhbGVEb3duJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1zY2FsZVVwRG93biBmeC1zbGlkZS1kZWxheTMwMCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtdXAtc2NhbGUtdXAnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnc2NhbGUtdXAtc2NhbGUtdXAnOiB7XHJcbiAgICAgICAgICBpZDogMjIsXHJcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcclxuICAgICAgICAgIGxhYmVsOiAnU2NhbGUgdXAgLyBzY2FsZSB1cCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93blVwJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1zY2FsZVVwIGZ4LXNsaWRlLWRlbGF5MzAwJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdzY2FsZS1kb3duLXNjYWxlLWRvd24nXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnbW92ZS10by1sZWZ0LXNjYWxlLXVwJzoge1xyXG4gICAgICAgICAgaWQ6IDIzLFxyXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXHJcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gbGVmdCAvIHNjYWxlIHVwJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvTGVmdCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1mcm9tLWxlZnQnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnbW92ZS10by1yaWdodC1zY2FsZS11cCc6IHtcclxuICAgICAgICAgIGlkOiAyNCxcclxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIHJpZ2h0IC8gc2NhbGUgdXAnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9SaWdodCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1mcm9tLXJpZ2h0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ21vdmUtdG8tdG9wLXNjYWxlLXVwJzoge1xyXG4gICAgICAgICAgaWQ6IDI1LFxyXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXHJcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gdG9wIC8gc2NhbGUgdXAnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Ub3AgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXNjYWxlVXAnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ3NjYWxlLWRvd24tZnJvbS10b3AnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnbW92ZS10by1ib3R0b20tc2NhbGUtdXAnOiB7XHJcbiAgICAgICAgICBpZDogMjYsXHJcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcclxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byBib3R0b20gLyBzY2FsZSB1cCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb0JvdHRvbSBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1mcm9tLWJvdHRvbSdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdzY2FsZS1kb3duLXNjYWxlLXVwJzoge1xyXG4gICAgICAgICAgaWQ6IDI3LFxyXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXHJcbiAgICAgICAgICBsYWJlbDogJ1NjYWxlIGRvd24gLyBzY2FsZSB1cCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93bkNlbnRlcicsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcENlbnRlciBmeC1zbGlkZS1kZWxheTQwMCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1zY2FsZS11cCdcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBSb3RhdGU6IEdsdWVcclxuICAgICAgICAnZ2x1ZS1sZWZ0LWZyb20tcmlnaHQnOiB7XHJcbiAgICAgICAgICBpZDogMjgsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpnbHVlJyxcclxuICAgICAgICAgIGxhYmVsOiAnR2x1ZSBsZWZ0IC8gZnJvbSByaWdodCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVJpZ2h0U2lkZUZpcnN0JyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0IGZ4LXNsaWRlLWRlbGF5MjAwIGZ4LXNsaWRlLW9udG9wJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdnbHVlLXJpZ2h0LWZyb20tbGVmdCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdnbHVlLXJpZ2h0LWZyb20tbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiAyOSxcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmdsdWUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdHbHVlIHJpZ2h0IC8gZnJvbSBsZWZ0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlTGVmdFNpZGVGaXJzdCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21MZWZ0IGZ4LXNsaWRlLWRlbGF5MjAwIGZ4LXNsaWRlLW9udG9wJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdnbHVlLWxlZnQtZnJvbS1yaWdodCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdnbHVlLWJvdHRvbS1mcm9tLXRvcCc6IHtcclxuICAgICAgICAgIGlkOiAzMCxcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmdsdWUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdHbHVlIGJvdHRvbSAvIGZyb20gdG9wJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlVG9wU2lkZUZpcnN0JyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcCBmeC1zbGlkZS1kZWxheTIwMCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnZ2x1ZS10b3AtZnJvbS1ib3R0b20nXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZ2x1ZS10b3AtZnJvbS1ib3R0b20nOiB7XHJcbiAgICAgICAgICBpZDogMzEsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpnbHVlJyxcclxuICAgICAgICAgIGxhYmVsOiAnR2x1ZSB0b3AgLyBmcm9tIGJvdHRvbScsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUJvdHRvbVNpZGVGaXJzdCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b20gZngtc2xpZGUtZGVsYXkyMDAgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2dsdWUtYm90dG9tLWZyb20tdG9wJ1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIFJvdGF0ZTogRmxpcFxyXG4gICAgICAgICdmbGlwLXJpZ2h0Jzoge1xyXG4gICAgICAgICAgaWQ6IDMyLFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6ZmxpcCcsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZsaXAgcmlnaHQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1mbGlwT3V0UmlnaHQnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLWZsaXBJbkxlZnQgZngtc2xpZGUtZGVsYXk1MDAnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZsaXAtbGVmdCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdmbGlwLWxlZnQnOiB7XHJcbiAgICAgICAgICBpZDogMzMsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmbGlwJyxcclxuICAgICAgICAgIGxhYmVsOiAnRmxpcCBsZWZ0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtZmxpcE91dExlZnQnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLWZsaXBJblJpZ2h0IGZ4LXNsaWRlLWRlbGF5NTAwJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmbGlwLXJpZ2h0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2ZsaXAtdG9wJzoge1xyXG4gICAgICAgICAgaWQ6IDM0LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6ZmxpcCcsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZsaXAgdG9wJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtZmxpcE91dFRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtZmxpcEluQm90dG9tIGZ4LXNsaWRlLWRlbGF5NTAwJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmbGlwLWJvdHRvbSdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdmbGlwLWJvdHRvbSc6IHtcclxuICAgICAgICAgIGlkOiAzNSxcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZsaXAnLFxyXG4gICAgICAgICAgbGFiZWw6ICdGbGlwIGJvdHRvbScsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZsaXBPdXRCb3R0b20nLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLWZsaXBJblRvcCBmeC1zbGlkZS1kZWxheTUwMCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnZmxpcC10b3AnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZmFsbCc6IHtcclxuICAgICAgICAgIGlkOiAzNixcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlJyxcclxuICAgICAgICAgIGxhYmVsOiAnRmFsbCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUZhbGwgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXNjYWxlVXAnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhbGwnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnbmV3c3BhcGVyJzoge1xyXG4gICAgICAgICAgaWQ6IDM3LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdOZXdzcGFwZXInLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVPdXROZXdzcGFwZXInLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUluTmV3c3BhcGVyIGZ4LXNsaWRlLWRlbGF5NTAwJyxcclxuICAgICAgICAgIHJldmVyc2U6ICduZXdzcGFwZXInXHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gUHVzaCAvIFB1bGxcclxuICAgICAgICAncHVzaC1sZWZ0LWZyb20tcmlnaHQnOiB7XHJcbiAgICAgICAgICBpZDogMzgsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxyXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIGxlZnQgLyBmcm9tIHJpZ2h0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVzaExlZnQnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tUmlnaHQnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtcmlnaHQtZnJvbS1sZWZ0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3B1c2gtcmlnaHQtZnJvbS1sZWZ0Jzoge1xyXG4gICAgICAgICAgaWQ6IDM5LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cHVzaC1wdWxsJyxcclxuICAgICAgICAgIGxhYmVsOiAnUHVzaCByaWdodCAvIGZyb20gbGVmdCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hSaWdodCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21MZWZ0JyxcclxuICAgICAgICAgIHJldmVyc2U6ICdwdXNoLWxlZnQtZnJvbS1yaWdodCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdwdXNoLXRvcC1mcm9tLWJvdHRvbSc6IHtcclxuICAgICAgICAgIGlkOiA0MCxcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnB1c2gtcHVsbCcsXHJcbiAgICAgICAgICBsYWJlbDogJ1B1c2ggdG9wIC8gZnJvbSBib3R0b20nLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdXNoVG9wJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUJvdHRvbScsXHJcbiAgICAgICAgICByZXZlcnNlOiAncHVzaC1ib3R0b20tZnJvbS10b3AnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAncHVzaC1ib3R0b20tZnJvbS10b3AnOiB7XHJcbiAgICAgICAgICBpZDogNDEsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxyXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIGJvdHRvbSAvIGZyb20gdG9wJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVzaEJvdHRvbScsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Ub3AnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtdG9wLWZyb20tYm90dG9tJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3B1c2gtbGVmdC1wdWxsLXJpZ2h0Jzoge1xyXG4gICAgICAgICAgaWQ6IDQyLFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cHVzaC1wdWxsJyxcclxuICAgICAgICAgIGxhYmVsOiAnUHVzaCBsZWZ0IC8gcHVsbCByaWdodCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hMZWZ0JyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdWxsUmlnaHQgZngtc2xpZGUtZGVsYXkxODAnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtcmlnaHQtcHVsbC1sZWZ0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3B1c2gtcmlnaHQtcHVsbC1sZWZ0Jzoge1xyXG4gICAgICAgICAgaWQ6IDQzLFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cHVzaC1wdWxsJyxcclxuICAgICAgICAgIGxhYmVsOiAnUHVzaCByaWdodCAvIHB1bGwgbGVmdCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hSaWdodCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVsbExlZnQgZngtc2xpZGUtZGVsYXkxODAnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtbGVmdC1wdWxsLXJpZ2h0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3B1c2gtdG9wLXB1bGwtYm90dG9tJzoge1xyXG4gICAgICAgICAgaWQ6IDQ0LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cHVzaC1wdWxsJyxcclxuICAgICAgICAgIGxhYmVsOiAnUHVzaCB0b3AgLyBwdWxsIGJvdHRvbScsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hUb3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1bGxCb3R0b20gZngtc2xpZGUtZGVsYXkxODAnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtYm90dG9tLXB1bGwtdG9wJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3B1c2gtYm90dG9tLXB1bGwtdG9wJzoge1xyXG4gICAgICAgICAgaWQ6IDQ1LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cHVzaC1wdWxsJyxcclxuICAgICAgICAgIGxhYmVsOiAnUHVzaCBib3R0b20gLyBwdWxsIHRvcCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hCb3R0b20nLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1bGxUb3AgZngtc2xpZGUtZGVsYXkxODAnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtdG9wLXB1bGwtYm90dG9tJ1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIEZvbGQgLyBVbmZvbGRcclxuICAgICAgICAnZm9sZC1sZWZ0LWZyb20tcmlnaHQnOiB7XHJcbiAgICAgICAgICBpZDogNDYsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZvbGQgbGVmdCAvIGZyb20gcmlnaHQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVGb2xkTGVmdCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21SaWdodEZhZGUnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tcmlnaHQtdW5mb2xkLWxlZnQnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZm9sZC1yaWdodC1mcm9tLWxlZnQnOiB7XHJcbiAgICAgICAgICBpZDogNDcsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZvbGQgcmlnaHQgLyBmcm9tIGxlZnQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVGb2xkUmlnaHQnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdEZhZGUnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tbGVmdC11bmZvbGQtcmlnaHQnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZm9sZC10b3AtZnJvbS1ib3R0b20nOiB7XHJcbiAgICAgICAgICBpZDogNDgsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZvbGQgdG9wIC8gZnJvbSBib3R0b20nLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVGb2xkVG9wJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUJvdHRvbUZhZGUnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tYm90dG9tLXVuZm9sZC10b3AnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZm9sZC1ib3R0b20tZnJvbS10b3AnOiB7XHJcbiAgICAgICAgICBpZDogNDksXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXHJcbiAgICAgICAgICBsYWJlbDogJ0ZvbGQgYm90dG9tIC8gZnJvbSB0b3AnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVGb2xkQm90dG9tJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcEZhZGUnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tdG9wLXVuZm9sZC1ib3R0b20nXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnbW92ZS10by1yaWdodC11bmZvbGQtbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiA1MCxcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZvbGQtdW5mb2xkJyxcclxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byByaWdodCAvIHVuZm9sZCBsZWZ0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvUmlnaHRGYWRlJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVVbmZvbGRMZWZ0JyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmb2xkLWxlZnQtZnJvbS1yaWdodCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdtb3ZlLXRvLWxlZnQtdW5mb2xkLXJpZ2h0Jzoge1xyXG4gICAgICAgICAgaWQ6IDUxLFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Zm9sZC11bmZvbGQnLFxyXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIGxlZnQgLyB1bmZvbGQgcmlnaHQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9MZWZ0RmFkZScsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlVW5mb2xkUmlnaHQnLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZvbGQtcmlnaHQtZnJvbS1sZWZ0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ21vdmUtdG8tYm90dG9tLXVuZm9sZC10b3AnOiB7XHJcbiAgICAgICAgICBpZDogNTIsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXHJcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gYm90dG9tIC8gdW5mb2xkIHRvcCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb0JvdHRvbUZhZGUnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVVuZm9sZFRvcCcsXHJcbiAgICAgICAgICByZXZlcnNlOiAnZm9sZC10b3AtZnJvbS1ib3R0b20nXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnbW92ZS10by10b3AtdW5mb2xkLWJvdHRvbSc6IHtcclxuICAgICAgICAgIGlkOiA1MyxcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZvbGQtdW5mb2xkJyxcclxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byB0b3AgLyB1bmZvbGQgYm90dG9tJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvVG9wRmFkZScsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlVW5mb2xkQm90dG9tJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdmb2xkLWJvdHRvbS1mcm9tLXRvcCdcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBSb29tXHJcbiAgICAgICAgJ3Jvb20tdG8tbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiA1NCxcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnJvb20nLFxyXG4gICAgICAgICAgbGFiZWw6ICdSb29tIHRvIGxlZnQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tTGVmdE91dCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbUxlZnRJbicsXHJcbiAgICAgICAgICByZXZlcnNlOiAncm9vbS10by1yaWdodCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdyb29tLXRvLXJpZ2h0Jzoge1xyXG4gICAgICAgICAgaWQ6IDU1LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cm9vbScsXHJcbiAgICAgICAgICBsYWJlbDogJ1Jvb20gdG8gcmlnaHQnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tUmlnaHRPdXQgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVJvb21SaWdodEluJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdyb29tLXRvLWxlZnQnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAncm9vbS10by10b3AnOiB7XHJcbiAgICAgICAgICBpZDogNTYsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpyb29tJyxcclxuICAgICAgICAgIGxhYmVsOiAnUm9vbSB0byB0b3AnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tVG9wT3V0IGZ4LXNsaWRlLW9udG9wJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tVG9wSW4nLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ3Jvb20tdG8tYm90dG9tJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3Jvb20tdG8tYm90dG9tJzoge1xyXG4gICAgICAgICAgaWQ6IDU3LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cm9vbScsXHJcbiAgICAgICAgICBsYWJlbDogJ1Jvb20gdG8gYm90dG9tJyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbUJvdHRvbU91dCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbUJvdHRvbUluJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdyb29tLXRvLXRvcCdcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBDdWJlXHJcbiAgICAgICAgJ2N1YmUtdG8tbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiA1OCxcclxuICAgICAgICAgIGxhYmVsOiAnQ3ViZSB0byBsZWZ0JyxcclxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZUxlZnRPdXQgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVMZWZ0SW4nLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2N1YmUtdG8tcmlnaHQnXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnY3ViZS10by1yaWdodCc6IHtcclxuICAgICAgICAgIGlkOiA1OSxcclxuICAgICAgICAgIGxhYmVsOiAnQ3ViZSB0byByaWdodCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVSaWdodE91dCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZVJpZ2h0SW4nLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2N1YmUtdG8tbGVmdCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdjdWJlLXRvLXRvcCc6IHtcclxuICAgICAgICAgIGlkOiA2MCxcclxuICAgICAgICAgIGxhYmVsOiAnQ3ViZSB0byB0b3AnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDdWJlVG9wT3V0IGZ4LXNsaWRlLW9udG9wJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDdWJlVG9wSW4nLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2N1YmUtdG8tYm90dG9tJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2N1YmUtdG8tYm90dG9tJzoge1xyXG4gICAgICAgICAgaWQ6IDYxLFxyXG4gICAgICAgICAgbGFiZWw6ICdDdWJlIHRvIGJvdHRvbScsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVCb3R0b21PdXQgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVCb3R0b21JbicsXHJcbiAgICAgICAgICByZXZlcnNlOiAnY3ViZS10by10b3AnXHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gQ2Fyb3VzZWxcclxuICAgICAgICAnY2Fyb3VzZWwtdG8tbGVmdCc6IHtcclxuICAgICAgICAgIGlkOiA2MixcclxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmNhcm91c2VsJyxcclxuICAgICAgICAgIGxhYmVsOiAnQ2Fyb3VzZWwgdG8gbGVmdCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsTGVmdE91dCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ2Fyb3VzZWxMZWZ0SW4nLFxyXG4gICAgICAgICAgcmV2ZXJzZTogJ2Nhcm91c2VsLXRvLXJpZ2h0J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2Nhcm91c2VsLXRvLXJpZ2h0Jzoge1xyXG4gICAgICAgICAgaWQ6IDYzLFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Y2Fyb3VzZWwnLFxyXG4gICAgICAgICAgbGFiZWw6ICdDYXJvdXNlbCB0byByaWdodCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsUmlnaHRPdXQgZngtc2xpZGUtb250b3AnLFxyXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsUmlnaHRJbicsXHJcbiAgICAgICAgICByZXZlcnNlOiAnY2Fyb3VzZWwtdG8tbGVmdCdcclxuICAgICAgICB9LFxyXG4gICAgICAgICdjYXJvdXNlbC10by10b3AnOiB7XHJcbiAgICAgICAgICBpZDogNjQsXHJcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpjYXJvdXNlbCcsXHJcbiAgICAgICAgICBsYWJlbDogJ0Nhcm91c2VsIHRvIHRvcCcsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsVG9wT3V0IGZ4LXNsaWRlLW9udG9wJyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDYXJvdXNlbFRvcEluJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdjYXJvdXNlbC10by1ib3R0b20nXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnY2Fyb3VzZWwtdG8tYm90dG9tJzoge1xyXG4gICAgICAgICAgaWQ6IDY1LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Y2Fyb3VzZWwnLFxyXG4gICAgICAgICAgbGFiZWw6ICdDYXJvdXNlbCB0byBib3R0b20nLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDYXJvdXNlbEJvdHRvbU91dCBmeC1zbGlkZS1vbnRvcCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlQ2Fyb3VzZWxCb3R0b21JbicsXHJcbiAgICAgICAgICByZXZlcnNlOiAnY2Fyb3VzZWwtdG8tdG9wJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ3NpZGVzJzoge1xyXG4gICAgICAgICAgaWQ6IDY2LFxyXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGUnLFxyXG4gICAgICAgICAgbGFiZWw6ICdTaWRlcycsXHJcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVNpZGVzT3V0JyxcclxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVTaWRlc0luIGZ4LXNsaWRlLWRlbGF5MjAwJyxcclxuICAgICAgICAgIHJldmVyc2U6ICdzaWRlcydcclxuICAgICAgICB9LFxyXG4gICAgICAgICdzbGlkZSc6IHtcclxuICAgICAgICAgIGlkOiA2NyxcclxuICAgICAgICAgIGxhYmVsOiAnU2xpZGUnLFxyXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVTbGlkZU91dCcsXHJcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlU2xpZGVJbicsXHJcbiAgICAgICAgICByZXZlcnNlOiAnc2xpZGUnXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBnZXRBeGlzRnJvbURpcmVjdGlvbjogZnVuY3Rpb24gKGRpcmVjdGlvbikge1xyXG4gICAgICAgIHJldHVybiBkaXJlY3Rpb24gPT09ICd2ZXJ0aWNhbCcgPyAnWScgOiAnWCc7XHJcbiAgICAgIH0sXHJcbiAgICAgIGFkZENsYXNzTmFtZXM6IGZ1bmN0aW9uIChlbGVtZW50LCBjbGFzc05hbWVzKSB7XHJcbiAgICAgICAgdmFyIG5hbWVzID0gY2xhc3NOYW1lcy5zcGxpdCgnICcpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LmFkZChuYW1lc1tpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICByZW1vdmVDbGFzc05hbWVzOiBmdW5jdGlvbiAoZWxlbWVudCwgY2xhc3NOYW1lcykge1xyXG4gICAgICAgIHZhciBuYW1lcyA9IGNsYXNzTmFtZXMuc3BsaXQoJyAnKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUobmFtZXNbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgcHJldjogZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgaWYgKGV2ZW50LmluZGV4ID4gMCAmJiAhZXZlbnQudHJhbnNpdGlvbl9jb21wbGV0ZSkge1xyXG4gICAgICAgICAgdmFyIG91dFNsaWRlID0gZXZlbnQuc2xpZGU7XHJcbiAgICAgICAgICB2YXIgaW5TbGlkZSA9IGRlY2suc2xpZGVzW2V2ZW50LmluZGV4IC0gMV07XHJcblxyXG4gICAgICAgICAgdGhpcy5kb1RyYW5zaXRpb24ob3V0U2xpZGUsIGluU2xpZGUsICdwcmV2Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBuZXh0OiBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhldmVudCk7XHJcbiAgICAgICAgaWYgKGV2ZW50LmluZGV4IDwgZGVjay5zbGlkZXMubGVuZ3RoIC0gMSkge1xyXG4gICAgICAgICAgdmFyIG91dFNsaWRlID0gZXZlbnQuc2xpZGU7XHJcbiAgICAgICAgICB2YXIgaW5TbGlkZSA9IGRlY2suc2xpZGVzW2V2ZW50LmluZGV4ICsgMV07XHJcblxyXG4gICAgICAgICAgdGhpcy5kb1RyYW5zaXRpb24ob3V0U2xpZGUsIGluU2xpZGUsICduZXh0Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBzbGlkZTogZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgaWYgKGV2ZW50LnNsaWRlKSB7XHJcbiAgICAgICAgICB2YXIgb3V0U2xpZGVJbmRleCA9IGRlY2suc2xpZGUoKTtcclxuICAgICAgICAgIHZhciBvdXRTbGlkZSA9IGRlY2suc2xpZGVzW291dFNsaWRlSW5kZXhdO1xyXG4gICAgICAgICAgdmFyIGluU2xpZGVJbmRleCA9IGV2ZW50LmluZGV4O1xyXG4gICAgICAgICAgdmFyIGluU2xpZGUgPSBldmVudC5zbGlkZTtcclxuICAgICAgICAgIHZhciBkaXJlY3Rpb24gPSAoaW5TbGlkZUluZGV4ID4gb3V0U2xpZGVJbmRleCkgPyAnbmV4dCcgOiAncHJldic7XHJcbiAgICAgICAgICB0aGlzLmRvVHJhbnNpdGlvbihvdXRTbGlkZSwgaW5TbGlkZSwgZGlyZWN0aW9uKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGRvVHJhbnNpdGlvbjogZnVuY3Rpb24gKG91dFNsaWRlLCBpblNsaWRlLCBkaXJlY3RpdmUpIHtcclxuICAgICAgICB2YXIgYXhpcyA9IGluU2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtZngtZGlyZWN0aW9uJykgPyB0aGlzLmdldEF4aXNGcm9tRGlyZWN0aW9uKGluU2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtZngtZGlyZWN0aW9uJykpIDogZGVmYXVsdF9heGlzO1xyXG4gICAgICAgIGlmIChyZXZlcnNlIHx8IGluU2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtZngtcmV2ZXJzZScpID09PSAndHJ1ZScpIHtcclxuICAgICAgICAgIGRpcmVjdGl2ZSA9IGRpcmVjdGl2ZSA9PT0gJ25leHQnID8gJ3ByZXYnIDogJ25leHQnO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgc2xpZGVfdHJhbnNpdGlvbl9uYW1lID0gaW5TbGlkZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYmVzcG9rZS1meC10cmFuc2l0aW9uJyk7XHJcbiAgICAgICAgdmFyIHNsaWRlX3RyYW5zaXRpb24gPSB0aGlzLmZ4W3NsaWRlX3RyYW5zaXRpb25fbmFtZV1bYXhpc10gPyB0aGlzLmZ4W3NsaWRlX3RyYW5zaXRpb25fbmFtZV1bYXhpc10gOiB0aGlzLmZ4W3RyYW5zaXRpb25dW2F4aXNdO1xyXG4gICAgICAgIHZhciB0cmFuc2l0aW9uX25hbWUgPSBzbGlkZV90cmFuc2l0aW9uW2RpcmVjdGl2ZV07XHJcbiAgICAgICAgdmFyIG91dENsYXNzID0gdGhpcy5hbmltYXRpb25zW3RyYW5zaXRpb25fbmFtZV0ub3V0Q2xhc3M7XHJcbiAgICAgICAgdmFyIGluQ2xhc3MgPSB0aGlzLmFuaW1hdGlvbnNbdHJhbnNpdGlvbl9uYW1lXS5pbkNsYXNzO1xyXG4gICAgICAgIHZhciBiZXNwb2tlRnggPSB0aGlzO1xyXG4gICAgICAgIG91dFNsaWRlLmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdEFuaW1hdGlvbkVuZCcsIGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICAgICAgYmVzcG9rZUZ4LnJlbW92ZUNsYXNzTmFtZXMoZXZlbnQudGFyZ2V0LCBvdXRDbGFzcyArICcgZngtdHJhbnNpdGlvbmluZy1vdXQnKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBpblNsaWRlLmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdEFuaW1hdGlvbkVuZCcsIGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICAgICAgYmVzcG9rZUZ4LnJlbW92ZUNsYXNzTmFtZXMoZXZlbnQudGFyZ2V0LCBpbkNsYXNzICsgJyBmeC10cmFuc2l0aW9uaW5nLWluJyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5hZGRDbGFzc05hbWVzKG91dFNsaWRlLCBvdXRDbGFzcyArICcgZngtdHJhbnNpdGlvbmluZy1vdXQnKTtcclxuICAgICAgICB0aGlzLmFkZENsYXNzTmFtZXMoaW5TbGlkZSwgaW5DbGFzcyArICcgZngtdHJhbnNpdGlvbmluZy1pbicpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGRlY2sub24oJ25leHQnLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgcGx1Z2luLm5leHQoZXZlbnQpXHJcbiAgICB9KTtcclxuICAgIGRlY2sub24oJ3ByZXYnLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgcGx1Z2luLnByZXYoZXZlbnQpXHJcbiAgICB9KTtcclxuICAgIGRlY2sub24oJ3NsaWRlJywgZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgIHBsdWdpbi5zbGlkZShldmVudClcclxuICAgIH0pO1xyXG4gIH07XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGFjdGl2YXRlU2xpZGUgPSBmdW5jdGlvbihpbmRleCkge1xyXG4gICAgICB2YXIgaW5kZXhUb0FjdGl2YXRlID0gLTEgPCBpbmRleCAmJiBpbmRleCA8IGRlY2suc2xpZGVzLmxlbmd0aCA/IGluZGV4IDogMDtcclxuICAgICAgaWYgKGluZGV4VG9BY3RpdmF0ZSAhPT0gZGVjay5zbGlkZSgpKSB7XHJcbiAgICAgICAgZGVjay5zbGlkZShpbmRleFRvQWN0aXZhdGUpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBwYXJzZUhhc2ggPSBmdW5jdGlvbigpIHtcclxuICAgICAgdmFyIGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zbGljZSgxKSxcclxuICAgICAgICBzbGlkZU51bWJlck9yTmFtZSA9IHBhcnNlSW50KGhhc2gsIDEwKTtcclxuXHJcbiAgICAgIGlmIChoYXNoKSB7XHJcbiAgICAgICAgaWYgKHNsaWRlTnVtYmVyT3JOYW1lKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZVNsaWRlKHNsaWRlTnVtYmVyT3JOYW1lIC0gMSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGRlY2suc2xpZGVzLmZvckVhY2goZnVuY3Rpb24oc2xpZGUsIGkpIHtcclxuICAgICAgICAgICAgaWYgKHNsaWRlLmdldEF0dHJpYnV0ZSgnZGF0YS1iZXNwb2tlLWhhc2gnKSA9PT0gaGFzaCB8fCBzbGlkZS5pZCA9PT0gaGFzaCkge1xyXG4gICAgICAgICAgICAgIGFjdGl2YXRlU2xpZGUoaSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICBwYXJzZUhhc2goKTtcclxuXHJcbiAgICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHZhciBzbGlkZU5hbWUgPSBlLnNsaWRlLmdldEF0dHJpYnV0ZSgnZGF0YS1iZXNwb2tlLWhhc2gnKSB8fCBlLnNsaWRlLmlkO1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gc2xpZGVOYW1lIHx8IGUuaW5kZXggKyAxO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdoYXNoY2hhbmdlJywgcGFyc2VIYXNoKTtcclxuICAgIH0sIDApO1xyXG4gIH07XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgaXNIb3Jpem9udGFsID0gb3B0aW9ucyAhPT0gJ3ZlcnRpY2FsJztcclxuXHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBpZiAoZS53aGljaCA9PSAzNCB8fCAvLyBQQUdFIERPV05cclxuICAgICAgICAoZS53aGljaCA9PSAzMiAmJiAhZS5zaGlmdEtleSkgfHwgLy8gU1BBQ0UgV0lUSE9VVCBTSElGVFxyXG4gICAgICAgIChpc0hvcml6b250YWwgJiYgZS53aGljaCA9PSAzOSkgfHwgLy8gUklHSFRcclxuICAgICAgICAoIWlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDQwKSAvLyBET1dOXHJcbiAgICAgICkgeyBkZWNrLm5leHQoKTsgfVxyXG5cclxuICAgICAgaWYgKGUud2hpY2ggPT0gMzMgfHwgLy8gUEFHRSBVUFxyXG4gICAgICAgIChlLndoaWNoID09IDMyICYmIGUuc2hpZnRLZXkpIHx8IC8vIFNQQUNFICsgU0hJRlRcclxuICAgICAgICAoaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gMzcpIHx8IC8vIExFRlRcclxuICAgICAgICAoIWlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDM4KSAvLyBVUFxyXG4gICAgICApIHsgZGVjay5wcmV2KCk7IH1cclxuICAgIH0pO1xyXG4gIH07XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBmdW5jdGlvbiAoZGVjaykge1xyXG4gICAgdmFyIHByb2dyZXNzUGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgIHByb2dyZXNzQmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgIHByb3AgPSBvcHRpb25zID09PSAndmVydGljYWwnID8gJ2hlaWdodCcgOiAnd2lkdGgnO1xyXG5cclxuICAgIHByb2dyZXNzUGFyZW50LmNsYXNzTmFtZSA9ICdiZXNwb2tlLXByb2dyZXNzLXBhcmVudCc7XHJcbiAgICBwcm9ncmVzc0Jhci5jbGFzc05hbWUgPSAnYmVzcG9rZS1wcm9ncmVzcy1iYXInO1xyXG4gICAgcHJvZ3Jlc3NQYXJlbnQuYXBwZW5kQ2hpbGQocHJvZ3Jlc3NCYXIpO1xyXG4gICAgZGVjay5wYXJlbnQuYXBwZW5kQ2hpbGQocHJvZ3Jlc3NQYXJlbnQpO1xyXG5cclxuICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBwcm9ncmVzc0Jhci5zdHlsZVtwcm9wXSA9IChlLmluZGV4ICogMTAwIC8gKGRlY2suc2xpZGVzLmxlbmd0aCAtIDEpKSArICclJztcclxuICAgIH0pO1xyXG4gIH07XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgcGFyZW50ID0gZGVjay5wYXJlbnQsXHJcbiAgICAgIGZpcnN0U2xpZGUgPSBkZWNrLnNsaWRlc1swXSxcclxuICAgICAgc2xpZGVIZWlnaHQgPSBmaXJzdFNsaWRlLm9mZnNldEhlaWdodCxcclxuICAgICAgc2xpZGVXaWR0aCA9IGZpcnN0U2xpZGUub2Zmc2V0V2lkdGgsXHJcbiAgICAgIHVzZVpvb20gPSBvcHRpb25zID09PSAnem9vbScgfHwgKCd6b29tJyBpbiBwYXJlbnQuc3R5bGUgJiYgb3B0aW9ucyAhPT0gJ3RyYW5zZm9ybScpLFxyXG5cclxuICAgICAgd3JhcCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcclxuICAgICAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2Jlc3Bva2Utc2NhbGUtcGFyZW50JztcclxuICAgICAgICBlbGVtZW50LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHdyYXBwZXIsIGVsZW1lbnQpO1xyXG4gICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XHJcbiAgICAgICAgcmV0dXJuIHdyYXBwZXI7XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBlbGVtZW50cyA9IHVzZVpvb20gPyBkZWNrLnNsaWRlcyA6IGRlY2suc2xpZGVzLm1hcCh3cmFwKSxcclxuXHJcbiAgICAgIHRyYW5zZm9ybVByb3BlcnR5ID0gKGZ1bmN0aW9uKHByb3BlcnR5KSB7XHJcbiAgICAgICAgdmFyIHByZWZpeGVzID0gJ01veiBXZWJraXQgTyBtcycuc3BsaXQoJyAnKTtcclxuICAgICAgICByZXR1cm4gcHJlZml4ZXMucmVkdWNlKGZ1bmN0aW9uKGN1cnJlbnRQcm9wZXJ0eSwgcHJlZml4KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyBwcm9wZXJ0eSBpbiBwYXJlbnQuc3R5bGUgPyBwcmVmaXggKyBwcm9wZXJ0eSA6IGN1cnJlbnRQcm9wZXJ0eTtcclxuICAgICAgICAgIH0sIHByb3BlcnR5LnRvTG93ZXJDYXNlKCkpO1xyXG4gICAgICB9KCdUcmFuc2Zvcm0nKSksXHJcblxyXG4gICAgICBzY2FsZSA9IHVzZVpvb20gP1xyXG4gICAgICAgIGZ1bmN0aW9uKHJhdGlvLCBlbGVtZW50KSB7XHJcbiAgICAgICAgICBlbGVtZW50LnN0eWxlLnpvb20gPSByYXRpbztcclxuICAgICAgICB9IDpcclxuICAgICAgICBmdW5jdGlvbihyYXRpbywgZWxlbWVudCkge1xyXG4gICAgICAgICAgZWxlbWVudC5zdHlsZVt0cmFuc2Zvcm1Qcm9wZXJ0eV0gPSAnc2NhbGUoJyArIHJhdGlvICsgJyknO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICBzY2FsZUFsbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciB4U2NhbGUgPSBwYXJlbnQub2Zmc2V0V2lkdGggLyBzbGlkZVdpZHRoLFxyXG4gICAgICAgICAgeVNjYWxlID0gcGFyZW50Lm9mZnNldEhlaWdodCAvIHNsaWRlSGVpZ2h0O1xyXG5cclxuICAgICAgICBlbGVtZW50cy5mb3JFYWNoKHNjYWxlLmJpbmQobnVsbCwgTWF0aC5taW4oeFNjYWxlLCB5U2NhbGUpKSk7XHJcbiAgICAgIH07XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHNjYWxlQWxsKTtcclxuICAgIHNjYWxlQWxsKCk7XHJcbiAgfTtcclxuXHJcbn07XHJcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbi8qIVxyXG4gKiBiZXNwb2tlLXRoZW1lLWN1YmUgdjIuMC4xXHJcbiAqXHJcbiAqIENvcHlyaWdodCAyMDE0LCBNYXJrIERhbGdsZWlzaFxyXG4gKiBUaGlzIGNvbnRlbnQgaXMgcmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlXHJcbiAqIGh0dHA6Ly9taXQtbGljZW5zZS5vcmcvbWFya2RhbGdsZWlzaFxyXG4gKi9cclxuXHJcbiFmdW5jdGlvbihlKXtpZihcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyltb2R1bGUuZXhwb3J0cz1lKCk7ZWxzZSBpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQpZGVmaW5lKGUpO2Vsc2V7dmFyIG87XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz9vPXdpbmRvdzpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP289Z2xvYmFsOlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmJiYobz1zZWxmKTt2YXIgZj1vO2Y9Zi5iZXNwb2tlfHwoZi5iZXNwb2tlPXt9KSxmPWYudGhlbWVzfHwoZi50aGVtZXM9e30pLGYuY3ViZT1lKCl9fShmdW5jdGlvbigpe3ZhciBkZWZpbmUsbW9kdWxlLGV4cG9ydHM7cmV0dXJuIChmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pKHsxOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcclxuXHJcbnZhciBjbGFzc2VzID0gX2RlcmVxXygnYmVzcG9rZS1jbGFzc2VzJyk7XHJcbnZhciBpbnNlcnRDc3MgPSBfZGVyZXFfKCdpbnNlcnQtY3NzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHZhciBjc3MgPSBcIip7LW1vei1ib3gtc2l6aW5nOmJvcmRlci1ib3g7Ym94LXNpemluZzpib3JkZXItYm94O21hcmdpbjowO3BhZGRpbmc6MH1AbWVkaWEgcHJpbnR7Knstd2Via2l0LXByaW50LWNvbG9yLWFkanVzdDpleGFjdH19QHBhZ2V7c2l6ZTpsYW5kc2NhcGU7bWFyZ2luOjB9LmJlc3Bva2UtcGFyZW50ey13ZWJraXQtdHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC42cyBlYXNlO3RyYW5zaXRpb246YmFja2dyb3VuZCAuNnMgZWFzZTtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtib3R0b206MDtsZWZ0OjA7cmlnaHQ6MDtvdmVyZmxvdzpoaWRkZW59QG1lZGlhIHByaW50ey5iZXNwb2tlLXBhcmVudHtvdmVyZmxvdzp2aXNpYmxlO3Bvc2l0aW9uOnN0YXRpY319LmJlc3Bva2UtdGhlbWUtY3ViZS1zbGlkZS1wYXJlbnR7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3JpZ2h0OjA7Ym90dG9tOjA7LXdlYmtpdC1wZXJzcGVjdGl2ZTo2MDBweDtwZXJzcGVjdGl2ZTo2MDBweDtwb2ludGVyLWV2ZW50czpub25lfS5iZXNwb2tlLXNsaWRle3BvaW50ZXItZXZlbnRzOmF1dG87LXdlYmtpdC10cmFuc2l0aW9uOi13ZWJraXQtdHJhbnNmb3JtIC42cyBlYXNlLG9wYWNpdHkgLjZzIGVhc2UsYmFja2dyb3VuZCAuNnMgZWFzZTt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuNnMgZWFzZSxvcGFjaXR5IC42cyBlYXNlLGJhY2tncm91bmQgLjZzIGVhc2U7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOjUwJSA1MCUgMDt0cmFuc2Zvcm0tb3JpZ2luOjUwJSA1MCUgMDstd2Via2l0LWJhY2tmYWNlLXZpc2liaWxpdHk6aGlkZGVuO2JhY2tmYWNlLXZpc2liaWxpdHk6aGlkZGVuO2Rpc3BsYXk6LXdlYmtpdC1ib3g7ZGlzcGxheTotd2Via2l0LWZsZXg7ZGlzcGxheTotbXMtZmxleGJveDtkaXNwbGF5OmZsZXg7LXdlYmtpdC1ib3gtb3JpZW50OnZlcnRpY2FsOy13ZWJraXQtYm94LWRpcmVjdGlvbjpub3JtYWw7LXdlYmtpdC1mbGV4LWRpcmVjdGlvbjpjb2x1bW47LW1zLWZsZXgtZGlyZWN0aW9uOmNvbHVtbjtmbGV4LWRpcmVjdGlvbjpjb2x1bW47LXdlYmtpdC1ib3gtcGFjazpjZW50ZXI7LXdlYmtpdC1qdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOy1tcy1mbGV4LXBhY2s6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7LXdlYmtpdC1ib3gtYWxpZ246Y2VudGVyOy13ZWJraXQtYWxpZ24taXRlbXM6Y2VudGVyOy1tcy1mbGV4LWFsaWduOmNlbnRlcjthbGlnbi1pdGVtczpjZW50ZXI7dGV4dC1hbGlnbjpjZW50ZXI7d2lkdGg6NjQwcHg7aGVpZ2h0OjQ4MHB4O3Bvc2l0aW9uOmFic29sdXRlO3RvcDo1MCU7bWFyZ2luLXRvcDotMjQwcHg7bGVmdDo1MCU7bWFyZ2luLWxlZnQ6LTMyMHB4O2JhY2tncm91bmQ6I2VhZWFlYTtwYWRkaW5nOjQwcHg7Ym9yZGVyLXJhZGl1czowfUBtZWRpYSBwcmludHsuYmVzcG9rZS1zbGlkZXt6b29tOjEhaW1wb3J0YW50O2hlaWdodDo3NDNweDt3aWR0aDoxMDAlO3BhZ2UtYnJlYWstYmVmb3JlOmFsd2F5cztwb3NpdGlvbjpzdGF0aWM7bWFyZ2luOjA7LXdlYmtpdC10cmFuc2l0aW9uOm5vbmU7dHJhbnNpdGlvbjpub25lfX0uYmVzcG9rZS1iZWZvcmV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlWCgxMDBweCl0cmFuc2xhdGVYKC0zMjBweClyb3RhdGVZKC05MGRlZyl0cmFuc2xhdGVYKC0zMjBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoMTAwcHgpdHJhbnNsYXRlWCgtMzIwcHgpcm90YXRlWSgtOTBkZWcpdHJhbnNsYXRlWCgtMzIwcHgpfUBtZWRpYSBwcmludHsuYmVzcG9rZS1iZWZvcmV7LXdlYmtpdC10cmFuc2Zvcm06bm9uZTt0cmFuc2Zvcm06bm9uZX19LmJlc3Bva2UtYWZ0ZXJ7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTAwcHgpdHJhbnNsYXRlWCgzMjBweClyb3RhdGVZKDkwZGVnKXRyYW5zbGF0ZVgoMzIwcHgpO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC0xMDBweCl0cmFuc2xhdGVYKDMyMHB4KXJvdGF0ZVkoOTBkZWcpdHJhbnNsYXRlWCgzMjBweCl9QG1lZGlhIHByaW50ey5iZXNwb2tlLWFmdGVyey13ZWJraXQtdHJhbnNmb3JtOm5vbmU7dHJhbnNmb3JtOm5vbmV9fS5iZXNwb2tlLWluYWN0aXZle29wYWNpdHk6MDtwb2ludGVyLWV2ZW50czpub25lfUBtZWRpYSBwcmludHsuYmVzcG9rZS1pbmFjdGl2ZXtvcGFjaXR5OjF9fS5iZXNwb2tlLWFjdGl2ZXtvcGFjaXR5OjF9LmJlc3Bva2UtYnVsbGV0ey13ZWJraXQtdHJhbnNpdGlvbjphbGwgLjNzIGVhc2U7dHJhbnNpdGlvbjphbGwgLjNzIGVhc2V9QG1lZGlhIHByaW50ey5iZXNwb2tlLWJ1bGxldHstd2Via2l0LXRyYW5zaXRpb246bm9uZTt0cmFuc2l0aW9uOm5vbmV9fS5iZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZXtvcGFjaXR5OjB9bGkuYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlWCgxNnB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgxNnB4KX1AbWVkaWEgcHJpbnR7bGkuYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7LXdlYmtpdC10cmFuc2Zvcm06bm9uZTt0cmFuc2Zvcm06bm9uZX19QG1lZGlhIHByaW50ey5iZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZXtvcGFjaXR5OjF9fS5iZXNwb2tlLWJ1bGxldC1hY3RpdmV7b3BhY2l0eToxfS5iZXNwb2tlLXNjYWxlLXBhcmVudHstd2Via2l0LXBlcnNwZWN0aXZlOjYwMHB4O3BlcnNwZWN0aXZlOjYwMHB4O3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowO3BvaW50ZXItZXZlbnRzOm5vbmV9LmJlc3Bva2Utc2NhbGUtcGFyZW50IC5iZXNwb2tlLWFjdGl2ZXtwb2ludGVyLWV2ZW50czphdXRvfUBtZWRpYSBwcmludHsuYmVzcG9rZS1zY2FsZS1wYXJlbnR7LXdlYmtpdC10cmFuc2Zvcm06bm9uZSFpbXBvcnRhbnQ7dHJhbnNmb3JtOm5vbmUhaW1wb3J0YW50fX0uYmVzcG9rZS1wcm9ncmVzcy1wYXJlbnR7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3JpZ2h0OjA7aGVpZ2h0OjJweH1AbWVkaWEgb25seSBzY3JlZW4gYW5kIChtaW4td2lkdGg6MTM2NnB4KXsuYmVzcG9rZS1wcm9ncmVzcy1wYXJlbnR7aGVpZ2h0OjRweH19QG1lZGlhIHByaW50ey5iZXNwb2tlLXByb2dyZXNzLXBhcmVudHtkaXNwbGF5Om5vbmV9fS5iZXNwb2tlLXByb2dyZXNzLWJhcnstd2Via2l0LXRyYW5zaXRpb246d2lkdGggLjZzIGVhc2U7dHJhbnNpdGlvbjp3aWR0aCAuNnMgZWFzZTtwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6MTAwJTtiYWNrZ3JvdW5kOiMwMDg5ZjM7Ym9yZGVyLXJhZGl1czowIDRweCA0cHggMH0uZW1waGF0aWN7YmFja2dyb3VuZDojZWFlYWVhfS5iZXNwb2tlLWJhY2tkcm9we3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowOy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZVooMCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCk7LXdlYmtpdC10cmFuc2l0aW9uOm9wYWNpdHkgLjZzIGVhc2U7dHJhbnNpdGlvbjpvcGFjaXR5IC42cyBlYXNlO29wYWNpdHk6MDt6LWluZGV4Oi0xfS5iZXNwb2tlLWJhY2tkcm9wLWFjdGl2ZXtvcGFjaXR5OjF9cHJle3BhZGRpbmc6MjZweCFpbXBvcnRhbnQ7Ym9yZGVyLXJhZGl1czo4cHh9Ym9keXtmb250LWZhbWlseTpoZWx2ZXRpY2EsYXJpYWwsc2Fucy1zZXJpZjtmb250LXNpemU6MThweDtjb2xvcjojNDA0MDQwfWgxe2ZvbnQtc2l6ZTo3MnB4O2xpbmUtaGVpZ2h0OjgycHg7bGV0dGVyLXNwYWNpbmc6LTJweDttYXJnaW4tYm90dG9tOjE2cHh9aDJ7Zm9udC1zaXplOjQycHg7bGV0dGVyLXNwYWNpbmc6LTFweDttYXJnaW4tYm90dG9tOjhweH1oM3tmb250LXNpemU6MjRweDtmb250LXdlaWdodDo0MDA7bWFyZ2luLWJvdHRvbToyNHB4O2NvbG9yOiM2MDYwNjB9aHJ7dmlzaWJpbGl0eTpoaWRkZW47aGVpZ2h0OjIwcHh9dWx7bGlzdC1zdHlsZTpub25lfWxpe21hcmdpbi1ib3R0b206MTJweH1we21hcmdpbjowIDEwMHB4IDEycHg7bGluZS1oZWlnaHQ6MjJweH1he2NvbG9yOiMwMDg5ZjM7dGV4dC1kZWNvcmF0aW9uOm5vbmV9XCI7XHJcbiAgaW5zZXJ0Q3NzKGNzcywgeyBwcmVwZW5kOiB0cnVlIH0pO1xyXG5cclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgY2xhc3NlcygpKGRlY2spO1xyXG5cclxuICAgIHZhciB3cmFwID0gZnVuY3Rpb24oZWxlbWVudCkge1xyXG4gICAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9ICdiZXNwb2tlLXRoZW1lLWN1YmUtc2xpZGUtcGFyZW50JztcclxuICAgICAgZWxlbWVudC5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh3cmFwcGVyLCBlbGVtZW50KTtcclxuICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZChlbGVtZW50KTtcclxuICAgIH07XHJcblxyXG4gICAgZGVjay5zbGlkZXMuZm9yRWFjaCh3cmFwKTtcclxuICB9O1xyXG59O1xyXG5cclxufSx7XCJiZXNwb2tlLWNsYXNzZXNcIjoyLFwiaW5zZXJ0LWNzc1wiOjN9XSwyOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGFkZENsYXNzID0gZnVuY3Rpb24oZWwsIGNscykge1xyXG4gICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtJyArIGNscyk7XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICByZW1vdmVDbGFzcyA9IGZ1bmN0aW9uKGVsLCBjbHMpIHtcclxuICAgICAgICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWVcclxuICAgICAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoJ2Jlc3Bva2UtJyArIGNscyArJyhcXFxcc3wkKScsICdnJyksICcgJylcclxuICAgICAgICAgIC50cmltKCk7XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBkZWFjdGl2YXRlID0gZnVuY3Rpb24oZWwsIGluZGV4KSB7XHJcbiAgICAgICAgdmFyIGFjdGl2ZVNsaWRlID0gZGVjay5zbGlkZXNbZGVjay5zbGlkZSgpXSxcclxuICAgICAgICAgIG9mZnNldCA9IGluZGV4IC0gZGVjay5zbGlkZSgpLFxyXG4gICAgICAgICAgb2Zmc2V0Q2xhc3MgPSBvZmZzZXQgPiAwID8gJ2FmdGVyJyA6ICdiZWZvcmUnO1xyXG5cclxuICAgICAgICBbJ2JlZm9yZSgtXFxcXGQrKT8nLCAnYWZ0ZXIoLVxcXFxkKyk/JywgJ2FjdGl2ZScsICdpbmFjdGl2ZSddLm1hcChyZW1vdmVDbGFzcy5iaW5kKG51bGwsIGVsKSk7XHJcblxyXG4gICAgICAgIGlmIChlbCAhPT0gYWN0aXZlU2xpZGUpIHtcclxuICAgICAgICAgIFsnaW5hY3RpdmUnLCBvZmZzZXRDbGFzcywgb2Zmc2V0Q2xhc3MgKyAnLScgKyBNYXRoLmFicyhvZmZzZXQpXS5tYXAoYWRkQ2xhc3MuYmluZChudWxsLCBlbCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICBhZGRDbGFzcyhkZWNrLnBhcmVudCwgJ3BhcmVudCcpO1xyXG4gICAgZGVjay5zbGlkZXMubWFwKGZ1bmN0aW9uKGVsKSB7IGFkZENsYXNzKGVsLCAnc2xpZGUnKTsgfSk7XHJcblxyXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGRlY2suc2xpZGVzLm1hcChkZWFjdGl2YXRlKTtcclxuICAgICAgYWRkQ2xhc3MoZS5zbGlkZSwgJ2FjdGl2ZScpO1xyXG4gICAgICByZW1vdmVDbGFzcyhlLnNsaWRlLCAnaW5hY3RpdmUnKTtcclxuICAgIH0pO1xyXG4gIH07XHJcbn07XHJcblxyXG59LHt9XSwzOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcclxudmFyIGluc2VydGVkID0ge307XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjc3MsIG9wdGlvbnMpIHtcclxuICAgIGlmIChpbnNlcnRlZFtjc3NdKSByZXR1cm47XHJcbiAgICBpbnNlcnRlZFtjc3NdID0gdHJ1ZTtcclxuICAgIFxyXG4gICAgdmFyIGVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xyXG4gICAgZWxlbS5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAndGV4dC9jc3MnKTtcclxuXHJcbiAgICBpZiAoJ3RleHRDb250ZW50JyBpbiBlbGVtKSB7XHJcbiAgICAgIGVsZW0udGV4dENvbnRlbnQgPSBjc3M7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBlbGVtLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzcztcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xyXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5wcmVwZW5kKSB7XHJcbiAgICAgICAgaGVhZC5pbnNlcnRCZWZvcmUoZWxlbSwgaGVhZC5jaGlsZE5vZGVzWzBdKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChlbGVtKTtcclxuICAgIH1cclxufTtcclxuXHJcbn0se31dfSx7fSxbMV0pXHJcbigxKVxyXG59KTtcbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuLyohXHJcbiAqIGJlc3Bva2UtdGhlbWUtZ3JlZW55IHYwLjAuM1xyXG4gKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSwgY2VkY2VkMTlcclxuICogVGhpcyBjb250ZW50IGlzIHJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxyXG4gKiBodHRwOi8vY2VkY2VkMTkuZ2l0aHViLmlvL2xpY2Vuc2UvXHJcbiAqL1xyXG5cclxuIWZ1bmN0aW9uKGUpe2lmKFwib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzKW1vZHVsZS5leHBvcnRzPWUoKTtlbHNlIGlmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZClkZWZpbmUoZSk7ZWxzZXt2YXIgbztcInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P289d2luZG93OlwidW5kZWZpbmVkXCIhPXR5cGVvZiBnbG9iYWw/bz1nbG9iYWw6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHNlbGYmJihvPXNlbGYpO3ZhciBmPW87Zj1mLmJlc3Bva2V8fChmLmJlc3Bva2U9e30pLGY9Zi50aGVtZXN8fChmLnRoZW1lcz17fSksZi5ncmVlbnk9ZSgpfX0oZnVuY3Rpb24oKXt2YXIgZGVmaW5lLG1vZHVsZSxleHBvcnRzO3JldHVybiAoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSh7MTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XHJcblxyXG52YXIgY2xhc3NlcyA9IF9kZXJlcV8oJ2Jlc3Bva2UtY2xhc3NlcycpO1xyXG52YXIgaW5zZXJ0Q3NzID0gX2RlcmVxXygnaW5zZXJ0LWNzcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICB0aGVtZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgIHZhciBjc3MgPSBcIip7Ym94LXNpemluZzpib3JkZXItYm94O21hcmdpbjowO3BhZGRpbmc6MH1AbWVkaWEgcHJpbnR7Knstd2Via2l0LXByaW50LWNvbG9yLWFkanVzdDpleGFjdH19QHBhZ2V7c2l6ZTpsYW5kc2NhcGU7bWFyZ2luOjB9LmJlc3Bva2UtcGFyZW50ey13ZWJraXQtdHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC42MnMgZWFzZS1pbi1vdXQ7dHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC42MnMgZWFzZS1pbi1vdXQ7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7Ym90dG9tOjA7bGVmdDowO3JpZ2h0OjA7b3ZlcmZsb3c6aGlkZGVuOy13ZWJraXQtcGVyc3BlY3RpdmU6NjAwcHg7cGVyc3BlY3RpdmU6NjAwcHh9QG1lZGlhIHByaW50ey5iZXNwb2tlLXBhcmVudHtvdmVyZmxvdzp2aXNpYmxlO3Bvc2l0aW9uOnN0YXRpY319LmJlc3Bva2Utc2xpZGV7LXdlYmtpdC10cmFuc2l0aW9uOi13ZWJraXQtdHJhbnNmb3JtIC42MnMgZWFzZS1pbi1vdXQsb3BhY2l0eSAuNjJzIGVhc2UtaW4tb3V0LGJhY2tncm91bmQgLjYycyBlYXNlLWluLW91dDt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuNjJzIGVhc2UtaW4tb3V0LG9wYWNpdHkgLjYycyBlYXNlLWluLW91dCxiYWNrZ3JvdW5kIC42MnMgZWFzZS1pbi1vdXQ7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOjUwJSA1MCUgMDstbXMtdHJhbnNmb3JtLW9yaWdpbjo1MCUgNTAlIDA7dHJhbnNmb3JtLW9yaWdpbjo1MCUgNTAlIDA7LXdlYmtpdC1iYWNrZmFjZS12aXNpYmlsaXR5OmhpZGRlbjtiYWNrZmFjZS12aXNpYmlsaXR5OmhpZGRlbjtkaXNwbGF5Oi13ZWJraXQtYm94O2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtYm94LW9yaWVudDp2ZXJ0aWNhbDstd2Via2l0LWJveC1kaXJlY3Rpb246bm9ybWFsOy13ZWJraXQtZmxleC1kaXJlY3Rpb246Y29sdW1uOy1tcy1mbGV4LWRpcmVjdGlvbjpjb2x1bW47ZmxleC1kaXJlY3Rpb246Y29sdW1uOy13ZWJraXQtYm94LXBhY2s6Y2VudGVyOy13ZWJraXQtanVzdGlmeS1jb250ZW50OmNlbnRlcjstbXMtZmxleC1wYWNrOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOy13ZWJraXQtYm94LWFsaWduOmNlbnRlcjstd2Via2l0LWFsaWduLWl0ZW1zOmNlbnRlcjstbXMtZmxleC1hbGlnbjpjZW50ZXI7YWxpZ24taXRlbXM6Y2VudGVyO3RleHQtYWxpZ246Y2VudGVyO3dpZHRoOjY0MHB4O2hlaWdodDo0ODBweDtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6NTAlO21hcmdpbi10b3A6LTI0MHB4O2xlZnQ6NTAlO21hcmdpbi1sZWZ0Oi0zMjBweDtiYWNrZ3JvdW5kLWNvbG9yOiMyZWNjNzE7cGFkZGluZzo0MHB4O2JvcmRlci1yYWRpdXM6MH1AbWVkaWEgcHJpbnR7LmJlc3Bva2Utc2xpZGV7em9vbToxIWltcG9ydGFudDtoZWlnaHQ6NzQzcHg7d2lkdGg6MTAwJTtwYWdlLWJyZWFrLWJlZm9yZTphbHdheXM7cG9zaXRpb246c3RhdGljO21hcmdpbjowOy13ZWJraXQtdHJhbnNpdGlvbjpub25lO3RyYW5zaXRpb246bm9uZX19LmJlc3Bva2UtYmVmb3Jley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZVgoMTMwcHgpdHJhbnNsYXRlWCgtMzIwcHgpcm90YXRlWSgtMTIwZGVnKXRyYW5zbGF0ZVgoLTMyMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgxMzBweCl0cmFuc2xhdGVYKC0zMjBweClyb3RhdGVZKC0xMjBkZWcpdHJhbnNsYXRlWCgtMzIwcHgpfUBtZWRpYSBwcmludHsuYmVzcG9rZS1iZWZvcmV7LXdlYmtpdC10cmFuc2Zvcm06bm9uZTstbXMtdHJhbnNmb3JtOm5vbmU7dHJhbnNmb3JtOm5vbmV9fS5iZXNwb2tlLWFmdGVyey13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTEzMHB4KXRyYW5zbGF0ZVgoMzIwcHgpcm90YXRlWSgxMjBkZWcpdHJhbnNsYXRlWCgzMjBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTEzMHB4KXRyYW5zbGF0ZVgoMzIwcHgpcm90YXRlWSgxMjBkZWcpdHJhbnNsYXRlWCgzMjBweCl9QG1lZGlhIHByaW50ey5iZXNwb2tlLWFmdGVyey13ZWJraXQtdHJhbnNmb3JtOm5vbmU7LW1zLXRyYW5zZm9ybTpub25lO3RyYW5zZm9ybTpub25lfX0uYmVzcG9rZS1pbmFjdGl2ZXtvcGFjaXR5OjA7cG9pbnRlci1ldmVudHM6bm9uZX1AbWVkaWEgcHJpbnR7LmJlc3Bva2UtaW5hY3RpdmV7b3BhY2l0eToxfX0uYmVzcG9rZS1hY3RpdmV7b3BhY2l0eToxfS5iZXNwb2tlLWJ1bGxldHstd2Via2l0LXRyYW5zaXRpb246YWxsIC4zcyBlYXNlO3RyYW5zaXRpb246YWxsIC4zcyBlYXNlfUBtZWRpYSBwcmludHsuYmVzcG9rZS1idWxsZXR7LXdlYmtpdC10cmFuc2l0aW9uOm5vbmU7dHJhbnNpdGlvbjpub25lfX0uYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7b3BhY2l0eTowfWxpLmJlc3Bva2UtYnVsbGV0LWluYWN0aXZley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZVgoMTZweCk7LW1zLXRyYW5zZm9ybTp0cmFuc2xhdGVYKDE2cHgpO3RyYW5zZm9ybTp0cmFuc2xhdGVYKDE2cHgpfUBtZWRpYSBwcmludHtsaS5iZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZXstd2Via2l0LXRyYW5zZm9ybTpub25lOy1tcy10cmFuc2Zvcm06bm9uZTt0cmFuc2Zvcm06bm9uZX19QG1lZGlhIHByaW50ey5iZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZXtvcGFjaXR5OjF9fS5iZXNwb2tlLWJ1bGxldC1hY3RpdmV7b3BhY2l0eToxfS5iZXNwb2tlLXNjYWxlLXBhcmVudHstd2Via2l0LXBlcnNwZWN0aXZlOjYwMHB4O3BlcnNwZWN0aXZlOjYwMHB4O3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowO3BvaW50ZXItZXZlbnRzOm5vbmV9LmJlc3Bva2Utc2NhbGUtcGFyZW50IC5iZXNwb2tlLWFjdGl2ZXtwb2ludGVyLWV2ZW50czphdXRvfUBtZWRpYSBwcmludHsuYmVzcG9rZS1zY2FsZS1wYXJlbnR7LXdlYmtpdC10cmFuc2Zvcm06bm9uZSFpbXBvcnRhbnQ7LW1zLXRyYW5zZm9ybTpub25lIWltcG9ydGFudDt0cmFuc2Zvcm06bm9uZSFpbXBvcnRhbnR9fS5iZXNwb2tlLXByb2dyZXNzLXBhcmVudHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtoZWlnaHQ6MTZweH1AbWVkaWEgb25seSBzY3JlZW4gYW5kIChtYXgtd2lkdGg6NDAwcHgpey5iZXNwb2tlLXByb2dyZXNzLXBhcmVudHtoZWlnaHQ6OHB4fX1AbWVkaWEgcHJpbnR7LmJlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50e2Rpc3BsYXk6bm9uZX19LmJlc3Bva2UtcHJvZ3Jlc3MtYmFyey13ZWJraXQtdHJhbnNpdGlvbjp3aWR0aCAuNnMgZWFzZTt0cmFuc2l0aW9uOndpZHRoIC42cyBlYXNlO3Bvc2l0aW9uOmFic29sdXRlO2hlaWdodDoxMDAlO2JhY2tncm91bmQ6IzE2YTA4NX0uYmVzcG9rZS1iYWNrZHJvcHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGVaKDApO3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApOy13ZWJraXQtdHJhbnNpdGlvbjpvcGFjaXR5IC42MnMgZWFzZS1pbi1vdXQ7dHJhbnNpdGlvbjpvcGFjaXR5IC42MnMgZWFzZS1pbi1vdXQ7b3BhY2l0eTowO3otaW5kZXg6LTF9LmJlc3Bva2UtYmFja2Ryb3AtYWN0aXZle29wYWNpdHk6MX1wcmV7cGFkZGluZzoyNnB4IWltcG9ydGFudDtib3JkZXItcmFkaXVzOjhweH1ib2R5e2ZvbnQtZmFtaWx5OmhlbHZldGljYSxhcmlhbCxzYW5zLXNlcmlmO2ZvbnQtc2l6ZToxOHB4O2NvbG9yOiNlY2YwZjE7YmFja2dyb3VuZDojMmVjYzcxfWgxe2xpbmUtaGVpZ2h0OjgycHg7bGV0dGVyLXNwYWNpbmc6LTJweDttYXJnaW4tYm90dG9tOjE2cHg7Zm9udC1zaXplOjUwcHg7d2hpdGUtc3BhY2U6bm93YXJwfWgye2xldHRlci1zcGFjaW5nOi0xcHg7bWFyZ2luLWJvdHRvbTo4cHg7Zm9udC1zaXplOjQwcHh9aDN7bWFyZ2luLWJvdHRvbToyNHB4O2NvbG9yOiNlY2YwZjE7Zm9udC1zaXplOjMwcHg7Zm9udC13ZWlnaHQ6NzAwfWg0e21hcmdpbi1ib3R0b206NXB4fWhye3Zpc2liaWxpdHk6aGlkZGVuO2hlaWdodDoyMHB4fXVse2xpc3Qtc3R5bGU6bm9uZX1saXttYXJnaW4tYm90dG9tOjEycHg7ZGlzcGxheTpibG9ja31we21hcmdpbjowIDEwMHB4IDEycHg7bGluZS1oZWlnaHQ6MjJweH1he2NvbG9yOiMwMDg5ZjM7dGV4dC1kZWNvcmF0aW9uOm5vbmV9OjotbW96LXNlbGVjdGlvbntjb2xvcjojMmVjYzcxO2JhY2tncm91bmQtY29sb3I6I2VjZjBmMX06OnNlbGVjdGlvbntjb2xvcjojMmVjYzcxO2JhY2tncm91bmQtY29sb3I6I2VjZjBmMX0uaW52ZXJzZXtiYWNrZ3JvdW5kLWNvbG9yOiMyZWNjNzE7Y29sb3I6IzJjM2U1MH0uc3RpY2t7Ym9yZGVyLXdpZHRoOjNweCAwO2JvcmRlci1zdHlsZTpzb2xpZDtib3JkZXItY29sb3I6I2RkZH0uc2luZ2xlLXdvcmRze3dvcmQtc3BhY2luZzo5OTk5cHg7bGluZS1oZWlnaHQ6Mi45ZW07b3ZlcmZsb3c6aGlkZGVufS5zcmN7Zm9udC1zaXplOjhweDttYXJnaW4tYm90dG9tOjVweH0uc3JjOjpiZWZvcmV7Y29udGVudDonU291cmNlOiAnfVwiO1xyXG4gICAgICBpbnNlcnRDc3MoY3NzLCB7IHByZXBlbmQ6IHRydWUgfSk7XHJcblxyXG4gICAgICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgICAgIGNsYXNzZXMoKShkZWNrKTtcclxuICAgICAgfTtcclxuICAgIH0sXHJcbiAgICBzY2FsZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICAgICAgdmFyIHBhcmVudCA9IGRlY2sucGFyZW50LFxyXG4gICAgICAgICAgZmlyc3RTbGlkZSA9IGRlY2suc2xpZGVzWzBdLFxyXG4gICAgICAgICAgc2xpZGVIZWlnaHQgPSBmaXJzdFNsaWRlLm9mZnNldEhlaWdodCxcclxuICAgICAgICAgIHNsaWRlV2lkdGggPSBmaXJzdFNsaWRlLm9mZnNldFdpZHRoLFxyXG4gICAgICAgICAgdXNlWm9vbSA9ICdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUsXHJcblxyXG4gICAgICAgICAgd3JhcCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcclxuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSAnYmVzcG9rZS1zY2FsZS1wYXJlbnQnO1xyXG4gICAgICAgICAgICBlbGVtZW50LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHdyYXBwZXIsIGVsZW1lbnQpO1xyXG4gICAgICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGVsZW1lbnQpO1xyXG4gICAgICAgICAgICByZXR1cm4gd3JhcHBlcjtcclxuICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgZWxlbWVudHMgPSB1c2Vab29tID8gZGVjay5zbGlkZXMgOiBkZWNrLnNsaWRlcy5tYXAod3JhcCksXHJcblxyXG4gICAgICAgICAgdHJhbnNmb3JtUHJvcGVydHkgPSAoZnVuY3Rpb24ocHJvcGVydHkpIHtcclxuICAgICAgICAgICAgdmFyIHByZWZpeGVzID0gJ01veiBXZWJraXQgTyBtcycuc3BsaXQoJyAnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHByZWZpeGVzLnJlZHVjZShmdW5jdGlvbihjdXJyZW50UHJvcGVydHksIHByZWZpeCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWZpeCArIHByb3BlcnR5IGluIHBhcmVudC5zdHlsZSA/IHByZWZpeCArIHByb3BlcnR5IDogY3VycmVudFByb3BlcnR5O1xyXG4gICAgICAgICAgICAgIH0sIHByb3BlcnR5LnRvTG93ZXJDYXNlKCkpO1xyXG4gICAgICAgICAgfSgnVHJhbnNmb3JtJykpLFxyXG5cclxuICAgICAgICAgIHNjYWxlID0gdXNlWm9vbSA/XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uKHJhdGlvLCBlbGVtZW50KSB7XHJcbiAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS56b29tID0gcmF0aW87XHJcbiAgICAgICAgICAgIH0gOlxyXG4gICAgICAgICAgICBmdW5jdGlvbihyYXRpbywgZWxlbWVudCkge1xyXG4gICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGVbdHJhbnNmb3JtUHJvcGVydHldID0gJ3NjYWxlKCcgKyByYXRpbyArICcpJztcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICBzY2FsZUFsbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB2YXIgeFNjYWxlID0gcGFyZW50Lm9mZnNldFdpZHRoIC8gc2xpZGVXaWR0aCxcclxuICAgICAgICAgICAgICB5U2NhbGUgPSBwYXJlbnQub2Zmc2V0SGVpZ2h0IC8gc2xpZGVIZWlnaHQ7XHJcblxyXG4gICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKHNjYWxlLmJpbmQobnVsbCwgTWF0aC5taW4oeFNjYWxlLCB5U2NhbGUpKSk7XHJcbiAgICAgICAgICB9O1xyXG5cclxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgc2NhbGVBbGwpO1xyXG4gICAgICAgIHNjYWxlQWxsKCk7XHJcbiAgICAgIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbn0se1wiYmVzcG9rZS1jbGFzc2VzXCI6MixcImluc2VydC1jc3NcIjozfV0sMjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcclxuICAgIHZhciBhZGRDbGFzcyA9IGZ1bmN0aW9uKGVsLCBjbHMpIHtcclxuICAgICAgICBlbC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLScgKyBjbHMpO1xyXG4gICAgICB9LFxyXG5cclxuICAgICAgcmVtb3ZlQ2xhc3MgPSBmdW5jdGlvbihlbCwgY2xzKSB7XHJcbiAgICAgICAgZWwuY2xhc3NOYW1lID0gZWwuY2xhc3NOYW1lXHJcbiAgICAgICAgICAucmVwbGFjZShuZXcgUmVnRXhwKCdiZXNwb2tlLScgKyBjbHMgKycoXFxcXHN8JCknLCAnZycpLCAnICcpXHJcbiAgICAgICAgICAudHJpbSgpO1xyXG4gICAgICB9LFxyXG5cclxuICAgICAgZGVhY3RpdmF0ZSA9IGZ1bmN0aW9uKGVsLCBpbmRleCkge1xyXG4gICAgICAgIHZhciBhY3RpdmVTbGlkZSA9IGRlY2suc2xpZGVzW2RlY2suc2xpZGUoKV0sXHJcbiAgICAgICAgICBvZmZzZXQgPSBpbmRleCAtIGRlY2suc2xpZGUoKSxcclxuICAgICAgICAgIG9mZnNldENsYXNzID0gb2Zmc2V0ID4gMCA/ICdhZnRlcicgOiAnYmVmb3JlJztcclxuXHJcbiAgICAgICAgWydiZWZvcmUoLVxcXFxkKyk/JywgJ2FmdGVyKC1cXFxcZCspPycsICdhY3RpdmUnLCAnaW5hY3RpdmUnXS5tYXAocmVtb3ZlQ2xhc3MuYmluZChudWxsLCBlbCkpO1xyXG5cclxuICAgICAgICBpZiAoZWwgIT09IGFjdGl2ZVNsaWRlKSB7XHJcbiAgICAgICAgICBbJ2luYWN0aXZlJywgb2Zmc2V0Q2xhc3MsIG9mZnNldENsYXNzICsgJy0nICsgTWF0aC5hYnMob2Zmc2V0KV0ubWFwKGFkZENsYXNzLmJpbmQobnVsbCwgZWwpKTtcclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcblxyXG4gICAgYWRkQ2xhc3MoZGVjay5wYXJlbnQsICdwYXJlbnQnKTtcclxuICAgIGRlY2suc2xpZGVzLm1hcChmdW5jdGlvbihlbCkgeyBhZGRDbGFzcyhlbCwgJ3NsaWRlJyk7IH0pO1xyXG5cclxuICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBkZWNrLnNsaWRlcy5tYXAoZGVhY3RpdmF0ZSk7XHJcbiAgICAgIGFkZENsYXNzKGUuc2xpZGUsICdhY3RpdmUnKTtcclxuICAgICAgcmVtb3ZlQ2xhc3MoZS5zbGlkZSwgJ2luYWN0aXZlJyk7XHJcbiAgICB9KTtcclxuICB9O1xyXG59O1xyXG5cclxufSx7fV0sMzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XHJcbnZhciBpbnNlcnRlZCA9IHt9O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY3NzLCBvcHRpb25zKSB7XHJcbiAgICBpZiAoaW5zZXJ0ZWRbY3NzXSkgcmV0dXJuO1xyXG4gICAgaW5zZXJ0ZWRbY3NzXSA9IHRydWU7XHJcbiAgICBcclxuICAgIHZhciBlbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcclxuICAgIGVsZW0uc2V0QXR0cmlidXRlKCd0eXBlJywgJ3RleHQvY3NzJyk7XHJcblxyXG4gICAgaWYgKCd0ZXh0Q29udGVudCcgaW4gZWxlbSkge1xyXG4gICAgICBlbGVtLnRleHRDb250ZW50ID0gY3NzO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgZWxlbS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucHJlcGVuZCkge1xyXG4gICAgICAgIGhlYWQuaW5zZXJ0QmVmb3JlKGVsZW0sIGhlYWQuY2hpbGROb2Rlc1swXSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoZWxlbSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG59LHt9XX0se30sWzFdKVxyXG4oMSlcclxufSk7XG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbi8qIVxyXG4gKiBiZXNwb2tlLXRoZW1lLXNlYSB2MC4zLjFcclxuICpcclxuICogQ29weXJpZ2h0IDIwMTYsIFxyXG4gKiBUaGlzIGNvbnRlbnQgaXMgcmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlXHJcbiAqIFxyXG4gKi9cclxuXHJcbiFmdW5jdGlvbihlKXtpZihcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyltb2R1bGUuZXhwb3J0cz1lKCk7ZWxzZSBpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQpZGVmaW5lKGUpO2Vsc2V7dmFyIG87XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz9vPXdpbmRvdzpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP289Z2xvYmFsOlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmJiYobz1zZWxmKTt2YXIgZj1vO2Y9Zi5iZXNwb2tlfHwoZi5iZXNwb2tlPXt9KSxmPWYudGhlbWVzfHwoZi50aGVtZXM9e30pLGYuc2VhPWUoKX19KGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkoezE6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xyXG5cclxudmFyIGNsYXNzZXMgPSBfZGVyZXFfKCdiZXNwb2tlLWNsYXNzZXMnKTtcclxudmFyIGluc2VydENzcyA9IF9kZXJlcV8oJ2luc2VydC1jc3MnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGNzcyA9IFwiLyohIG5vcm1hbGl6ZS5jc3MgdjMuMC4wIHwgTUlUIExpY2Vuc2UgfCBnaXQuaW8vbm9ybWFsaXplICovaHRtbHtmb250LWZhbWlseTpzYW5zLXNlcmlmOy1tcy10ZXh0LXNpemUtYWRqdXN0OjEwMCU7LXdlYmtpdC10ZXh0LXNpemUtYWRqdXN0OjEwMCV9Ym9keXttYXJnaW46MH1hcnRpY2xlLGFzaWRlLGRldGFpbHMsZmlnY2FwdGlvbixmaWd1cmUsZm9vdGVyLGhlYWRlcixoZ3JvdXAsbWFpbixuYXYsc2VjdGlvbixzdW1tYXJ5e2Rpc3BsYXk6YmxvY2t9YXVkaW8sY2FudmFzLHByb2dyZXNzLHZpZGVve2Rpc3BsYXk6aW5saW5lLWJsb2NrO3ZlcnRpY2FsLWFsaWduOmJhc2VsaW5lfWF1ZGlvOm5vdChbY29udHJvbHNdKXtkaXNwbGF5Om5vbmU7aGVpZ2h0OjB9W2hpZGRlbl0sdGVtcGxhdGV7ZGlzcGxheTpub25lfWF7YmFja2dyb3VuZDowIDB9YTphY3RpdmUsYTpob3ZlcntvdXRsaW5lOjB9YWJiclt0aXRsZV17Ym9yZGVyLWJvdHRvbToxcHggZG90dGVkfWIsc3Ryb25ne2ZvbnQtd2VpZ2h0OjcwMH1kZm57Zm9udC1zdHlsZTppdGFsaWN9aDF7Zm9udC1zaXplOjJlbTttYXJnaW46LjY3ZW0gMH1tYXJre2JhY2tncm91bmQ6I2ZmMDtjb2xvcjojMDAwfXNtYWxse2ZvbnQtc2l6ZTo4MCV9c3ViLHN1cHtmb250LXNpemU6NzUlO2xpbmUtaGVpZ2h0OjA7cG9zaXRpb246cmVsYXRpdmU7dmVydGljYWwtYWxpZ246YmFzZWxpbmV9c3Vwe3RvcDotLjVlbX1zdWJ7Ym90dG9tOi0uMjVlbX1pbWd7Ym9yZGVyOjB9c3ZnOm5vdCg6cm9vdCl7b3ZlcmZsb3c6aGlkZGVufWZpZ3VyZXttYXJnaW46MWVtIDQwcHh9aHJ7Ym94LXNpemluZzpjb250ZW50LWJveDtoZWlnaHQ6MH1wcmV7b3ZlcmZsb3c6YXV0b31jb2RlLGtiZCxwcmUsc2FtcHtmb250LWZhbWlseTptb25vc3BhY2UsbW9ub3NwYWNlO2ZvbnQtc2l6ZToxZW19YnV0dG9uLGlucHV0LG9wdGdyb3VwLHNlbGVjdCx0ZXh0YXJlYXtjb2xvcjppbmhlcml0O2ZvbnQ6aW5oZXJpdDttYXJnaW46MH1idXR0b257b3ZlcmZsb3c6dmlzaWJsZX1idXR0b24sc2VsZWN0e3RleHQtdHJhbnNmb3JtOm5vbmV9YnV0dG9uLGh0bWwgaW5wdXRbdHlwZT1cXFwiYnV0dG9uXFxcIl0saW5wdXRbdHlwZT1cXFwicmVzZXRcXFwiXSxpbnB1dFt0eXBlPVxcXCJzdWJtaXRcXFwiXXstd2Via2l0LWFwcGVhcmFuY2U6YnV0dG9uO2N1cnNvcjpwb2ludGVyfWJ1dHRvbltkaXNhYmxlZF0saHRtbCBpbnB1dFtkaXNhYmxlZF17Y3Vyc29yOmRlZmF1bHR9YnV0dG9uOjotbW96LWZvY3VzLWlubmVyLGlucHV0OjotbW96LWZvY3VzLWlubmVye2JvcmRlcjowO3BhZGRpbmc6MH1pbnB1dHtsaW5lLWhlaWdodDpub3JtYWx9aW5wdXRbdHlwZT1cXFwiY2hlY2tib3hcXFwiXSxpbnB1dFt0eXBlPVxcXCJyYWRpb1xcXCJde2JveC1zaXppbmc6Ym9yZGVyLWJveDtwYWRkaW5nOjB9aW5wdXRbdHlwZT1cXFwibnVtYmVyXFxcIl06Oi13ZWJraXQtaW5uZXItc3Bpbi1idXR0b24saW5wdXRbdHlwZT1cXFwibnVtYmVyXFxcIl06Oi13ZWJraXQtb3V0ZXItc3Bpbi1idXR0b257aGVpZ2h0OmF1dG99aW5wdXRbdHlwZT1cXFwic2VhcmNoXFxcIl17LXdlYmtpdC1hcHBlYXJhbmNlOnRleHRmaWVsZDtib3gtc2l6aW5nOmNvbnRlbnQtYm94fWlucHV0W3R5cGU9XFxcInNlYXJjaFxcXCJdOjotd2Via2l0LXNlYXJjaC1jYW5jZWwtYnV0dG9uLGlucHV0W3R5cGU9XFxcInNlYXJjaFxcXCJdOjotd2Via2l0LXNlYXJjaC1kZWNvcmF0aW9uey13ZWJraXQtYXBwZWFyYW5jZTpub25lfWZpZWxkc2V0e2JvcmRlcjoxcHggc29saWQgc2lsdmVyO21hcmdpbjowIDJweDtwYWRkaW5nOi4zNWVtIC42MjVlbSAuNzVlbX1sZWdlbmR7Ym9yZGVyOjA7cGFkZGluZzowfXRleHRhcmVhe292ZXJmbG93OmF1dG99b3B0Z3JvdXB7Zm9udC13ZWlnaHQ6NzAwfXRhYmxle2JvcmRlci1jb2xsYXBzZTpjb2xsYXBzZTtib3JkZXItc3BhY2luZzowfXRkLHRoe3BhZGRpbmc6MH1ib2R5e2ZvbnQtZmFtaWx5OlxcXCJIZWx2ZXRpY2EgTmV1ZVxcXCIsSGVsdmV0aWNhLHNhbnMtc2VyaWZ9aDN7b3BhY2l0eTouNzV9YXtjb2xvcjojZGRkO3RyYW5zaXRpb246Y29sb3IgLjJzIGVhc2V9YTpob3Zlcntjb2xvcjojZmZmfWxpe21hcmdpbjouMjVlbX0uYmVzcG9rZS1wYXJlbnR7LXdlYmtpdC10ZXh0LXNpemUtYWRqdXN0OmF1dG87LW1zLXRleHQtc2l6ZS1hZGp1c3Q6YXV0bzt0ZXh0LXNpemUtYWRqdXN0OmF1dG87b3ZlcmZsb3c6aGlkZGVuO2JhY2tncm91bmQ6IzM0NDk1ZX0uYmVzcG9rZS1wYXJlbnQsLmJlc3Bva2Utc2NhbGUtcGFyZW50e3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowfS5iZXNwb2tlLXNjYWxlLXBhcmVudHtwb2ludGVyLWV2ZW50czpub25lfS5iZXNwb2tlLXNjYWxlLXBhcmVudCAuYmVzcG9rZS1hY3RpdmV7cG9pbnRlci1ldmVudHM6YXV0b30uYmVzcG9rZS1zbGlkZXt3aWR0aDo2NDBweDtoZWlnaHQ6NDgwcHg7cG9zaXRpb246YWJzb2x1dGU7dG9wOjUwJTtsZWZ0OjUwJTttYXJnaW4tbGVmdDotMzIwcHg7bWFyZ2luLXRvcDotMjQwcHg7ZGlzcGxheTotbXMtZmxleGJveDtkaXNwbGF5OmZsZXg7LW1zLWZsZXgtZGlyZWN0aW9uOmNvbHVtbjtmbGV4LWRpcmVjdGlvbjpjb2x1bW47LW1zLWZsZXgtcGFjazpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjstbXMtZmxleC1hbGlnbjpjZW50ZXI7YWxpZ24taXRlbXM6Y2VudGVyO2JhY2tncm91bmQ6IzAwNjU5YTtjb2xvcjojZmZmO3RyYW5zaXRpb246LXdlYmtpdC10cmFuc2Zvcm0gLjdzIGVhc2UgMHMsb3BhY2l0eSAuN3MgZWFzZSAwcyxiYWNrZ3JvdW5kLWNvbG9yIC43cyBlYXNlIDBzO3RyYW5zaXRpb246dHJhbnNmb3JtIC43cyBlYXNlIDBzLG9wYWNpdHkgLjdzIGVhc2UgMHMsYmFja2dyb3VuZC1jb2xvciAuN3MgZWFzZSAwc30uYmVzcG9rZS1hY3RpdmV7b3BhY2l0eToxO3otaW5kZXg6MTB9LmJlc3Bva2UtaW5hY3RpdmV7b3BhY2l0eTouMztwb2ludGVyLWV2ZW50czpub25lfS5iZXNwb2tlLWJlZm9yZXtvcGFjaXR5OjB9LmJlc3Bva2UtYmVmb3JlLTF7b3BhY2l0eTouMzstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGVYKC02NDBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTY0MHB4KTt6LWluZGV4Ojl9LmJlc3Bva2UtYWZ0ZXJ7b3BhY2l0eTowfS5iZXNwb2tlLWFmdGVyLTF7b3BhY2l0eTouMzstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGVYKDY0MHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlWCg2NDBweCk7ei1pbmRleDo5fS5iZXNwb2tlLWJ1bGxldHt0cmFuc2l0aW9uOmFsbCAuM3MgZWFzZX0uYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlWSgtMjBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTIwcHgpO29wYWNpdHk6MDtwb2ludGVyLWV2ZW50czpub25lfS5iZXNwb2tlLWJhY2tkcm9we3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowO3otaW5kZXg6LTE7b3BhY2l0eTowfS5iZXNwb2tlLWJhY2tkcm9wLWFjdGl2ZXtvcGFjaXR5OjF9LmJlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50e3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2hlaWdodDouM3Z3O3otaW5kZXg6MTF9LmJlc3Bva2UtcHJvZ3Jlc3MtYmFye3Bvc2l0aW9uOmFic29sdXRlO2hlaWdodDoxMDAlO2JhY2tncm91bmQ6I2ZmZjt0cmFuc2l0aW9uOndpZHRoIC42cyBlYXNlfS5lbXBoYXRpY3tiYWNrZ3JvdW5kOiMwYWR9LmVtcGhhdGljLXRleHR7Y29sb3I6I2ZmZjtmb250LXNpemU6bGFyZ2VyfVwiO1xyXG4gIGluc2VydENzcyhjc3MsIHsgcHJlcGVuZDogdHJ1ZSB9KTtcclxuXHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcclxuICAgIGNsYXNzZXMoKShkZWNrKTtcclxuICB9O1xyXG59O1xyXG5cclxufSx7XCJiZXNwb2tlLWNsYXNzZXNcIjoyLFwiaW5zZXJ0LWNzc1wiOjN9XSwyOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGFkZENsYXNzID0gZnVuY3Rpb24oZWwsIGNscykge1xyXG4gICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtJyArIGNscyk7XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICByZW1vdmVDbGFzcyA9IGZ1bmN0aW9uKGVsLCBjbHMpIHtcclxuICAgICAgICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWVcclxuICAgICAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoJ2Jlc3Bva2UtJyArIGNscyArJyhcXFxcc3wkKScsICdnJyksICcgJylcclxuICAgICAgICAgIC50cmltKCk7XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBkZWFjdGl2YXRlID0gZnVuY3Rpb24oZWwsIGluZGV4KSB7XHJcbiAgICAgICAgdmFyIGFjdGl2ZVNsaWRlID0gZGVjay5zbGlkZXNbZGVjay5zbGlkZSgpXSxcclxuICAgICAgICAgIG9mZnNldCA9IGluZGV4IC0gZGVjay5zbGlkZSgpLFxyXG4gICAgICAgICAgb2Zmc2V0Q2xhc3MgPSBvZmZzZXQgPiAwID8gJ2FmdGVyJyA6ICdiZWZvcmUnO1xyXG5cclxuICAgICAgICBbJ2JlZm9yZSgtXFxcXGQrKT8nLCAnYWZ0ZXIoLVxcXFxkKyk/JywgJ2FjdGl2ZScsICdpbmFjdGl2ZSddLm1hcChyZW1vdmVDbGFzcy5iaW5kKG51bGwsIGVsKSk7XHJcblxyXG4gICAgICAgIGlmIChlbCAhPT0gYWN0aXZlU2xpZGUpIHtcclxuICAgICAgICAgIFsnaW5hY3RpdmUnLCBvZmZzZXRDbGFzcywgb2Zmc2V0Q2xhc3MgKyAnLScgKyBNYXRoLmFicyhvZmZzZXQpXS5tYXAoYWRkQ2xhc3MuYmluZChudWxsLCBlbCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICBhZGRDbGFzcyhkZWNrLnBhcmVudCwgJ3BhcmVudCcpO1xyXG4gICAgZGVjay5zbGlkZXMubWFwKGZ1bmN0aW9uKGVsKSB7IGFkZENsYXNzKGVsLCAnc2xpZGUnKTsgfSk7XHJcblxyXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGRlY2suc2xpZGVzLm1hcChkZWFjdGl2YXRlKTtcclxuICAgICAgYWRkQ2xhc3MoZS5zbGlkZSwgJ2FjdGl2ZScpO1xyXG4gICAgICByZW1vdmVDbGFzcyhlLnNsaWRlLCAnaW5hY3RpdmUnKTtcclxuICAgIH0pO1xyXG4gIH07XHJcbn07XHJcblxyXG59LHt9XSwzOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcclxudmFyIGluc2VydGVkID0ge307XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjc3MsIG9wdGlvbnMpIHtcclxuICAgIGlmIChpbnNlcnRlZFtjc3NdKSByZXR1cm47XHJcbiAgICBpbnNlcnRlZFtjc3NdID0gdHJ1ZTtcclxuICAgIFxyXG4gICAgdmFyIGVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xyXG4gICAgZWxlbS5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAndGV4dC9jc3MnKTtcclxuXHJcbiAgICBpZiAoJ3RleHRDb250ZW50JyBpbiBlbGVtKSB7XHJcbiAgICAgIGVsZW0udGV4dENvbnRlbnQgPSBjc3M7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBlbGVtLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzcztcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xyXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5wcmVwZW5kKSB7XHJcbiAgICAgICAgaGVhZC5pbnNlcnRCZWZvcmUoZWxlbSwgaGVhZC5jaGlsZE5vZGVzWzBdKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChlbGVtKTtcclxuICAgIH1cclxufTtcclxuXHJcbn0se31dfSx7fSxbMV0pXHJcbigxKVxyXG59KTtcbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcclxuICAgIHZhciBheGlzID0gb3B0aW9ucyA9PSAndmVydGljYWwnID8gJ1knIDogJ1gnLFxyXG4gICAgICBzdGFydFBvc2l0aW9uLFxyXG4gICAgICBkZWx0YTtcclxuXHJcbiAgICBkZWNrLnBhcmVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PSAxKSB7XHJcbiAgICAgICAgc3RhcnRQb3NpdGlvbiA9IGUudG91Y2hlc1swXVsncGFnZScgKyBheGlzXTtcclxuICAgICAgICBkZWx0YSA9IDA7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGRlY2sucGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgaWYgKGUudG91Y2hlcy5sZW5ndGggPT0gMSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBkZWx0YSA9IGUudG91Y2hlc1swXVsncGFnZScgKyBheGlzXSAtIHN0YXJ0UG9zaXRpb247XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGRlY2sucGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgIGlmIChNYXRoLmFicyhkZWx0YSkgPiA1MCkge1xyXG4gICAgICAgIGRlY2tbZGVsdGEgPiAwID8gJ3ByZXYnIDogJ25leHQnXSgpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9O1xyXG59O1xyXG4iLCJ2YXIgZnJvbSA9IGZ1bmN0aW9uKG9wdHMsIHBsdWdpbnMpIHtcclxuICB2YXIgcGFyZW50ID0gKG9wdHMucGFyZW50IHx8IG9wdHMpLm5vZGVUeXBlID09PSAxID8gKG9wdHMucGFyZW50IHx8IG9wdHMpIDogZG9jdW1lbnQucXVlcnlTZWxlY3RvcihvcHRzLnBhcmVudCB8fCBvcHRzKSxcclxuICAgIHNsaWRlcyA9IFtdLmZpbHRlci5jYWxsKHR5cGVvZiBvcHRzLnNsaWRlcyA9PT0gJ3N0cmluZycgPyBwYXJlbnQucXVlcnlTZWxlY3RvckFsbChvcHRzLnNsaWRlcykgOiAob3B0cy5zbGlkZXMgfHwgcGFyZW50LmNoaWxkcmVuKSwgZnVuY3Rpb24oZWwpIHsgcmV0dXJuIGVsLm5vZGVOYW1lICE9PSAnU0NSSVBUJzsgfSksXHJcbiAgICBhY3RpdmVTbGlkZSA9IHNsaWRlc1swXSxcclxuICAgIGxpc3RlbmVycyA9IHt9LFxyXG5cclxuICAgIGFjdGl2YXRlID0gZnVuY3Rpb24oaW5kZXgsIGN1c3RvbURhdGEpIHtcclxuICAgICAgaWYgKCFzbGlkZXNbaW5kZXhdKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBmaXJlKCdkZWFjdGl2YXRlJywgY3JlYXRlRXZlbnREYXRhKGFjdGl2ZVNsaWRlLCBjdXN0b21EYXRhKSk7XHJcbiAgICAgIGFjdGl2ZVNsaWRlID0gc2xpZGVzW2luZGV4XTtcclxuICAgICAgZmlyZSgnYWN0aXZhdGUnLCBjcmVhdGVFdmVudERhdGEoYWN0aXZlU2xpZGUsIGN1c3RvbURhdGEpKTtcclxuICAgIH0sXHJcblxyXG4gICAgc2xpZGUgPSBmdW5jdGlvbihpbmRleCwgY3VzdG9tRGF0YSkge1xyXG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xyXG4gICAgICAgIGZpcmUoJ3NsaWRlJywgY3JlYXRlRXZlbnREYXRhKHNsaWRlc1tpbmRleF0sIGN1c3RvbURhdGEpKSAmJiBhY3RpdmF0ZShpbmRleCwgY3VzdG9tRGF0YSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIHNsaWRlcy5pbmRleE9mKGFjdGl2ZVNsaWRlKTtcclxuICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBzdGVwID0gZnVuY3Rpb24ob2Zmc2V0LCBjdXN0b21EYXRhKSB7XHJcbiAgICAgIHZhciBzbGlkZUluZGV4ID0gc2xpZGVzLmluZGV4T2YoYWN0aXZlU2xpZGUpICsgb2Zmc2V0O1xyXG5cclxuICAgICAgZmlyZShvZmZzZXQgPiAwID8gJ25leHQnIDogJ3ByZXYnLCBjcmVhdGVFdmVudERhdGEoYWN0aXZlU2xpZGUsIGN1c3RvbURhdGEpKSAmJiBhY3RpdmF0ZShzbGlkZUluZGV4LCBjdXN0b21EYXRhKTtcclxuICAgIH0sXHJcblxyXG4gICAgb24gPSBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XHJcbiAgICAgIChsaXN0ZW5lcnNbZXZlbnROYW1lXSB8fCAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXSkpLnB1c2goY2FsbGJhY2spO1xyXG4gICAgICByZXR1cm4gb2ZmLmJpbmQobnVsbCwgZXZlbnROYW1lLCBjYWxsYmFjayk7XHJcbiAgICB9LFxyXG5cclxuICAgIG9mZiA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcclxuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSAobGlzdGVuZXJzW2V2ZW50TmFtZV0gfHwgW10pLmZpbHRlcihmdW5jdGlvbihsaXN0ZW5lcikgeyByZXR1cm4gbGlzdGVuZXIgIT09IGNhbGxiYWNrOyB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgZmlyZSA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgZXZlbnREYXRhKSB7XHJcbiAgICAgIHJldHVybiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gfHwgW10pXHJcbiAgICAgICAgLnJlZHVjZShmdW5jdGlvbihub3RDYW5jZWxsZWQsIGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICByZXR1cm4gbm90Q2FuY2VsbGVkICYmIGNhbGxiYWNrKGV2ZW50RGF0YSkgIT09IGZhbHNlO1xyXG4gICAgICAgIH0sIHRydWUpO1xyXG4gICAgfSxcclxuXHJcbiAgICBjcmVhdGVFdmVudERhdGEgPSBmdW5jdGlvbihlbCwgZXZlbnREYXRhKSB7XHJcbiAgICAgIGV2ZW50RGF0YSA9IGV2ZW50RGF0YSB8fCB7fTtcclxuICAgICAgZXZlbnREYXRhLmluZGV4ID0gc2xpZGVzLmluZGV4T2YoZWwpO1xyXG4gICAgICBldmVudERhdGEuc2xpZGUgPSBlbDtcclxuICAgICAgcmV0dXJuIGV2ZW50RGF0YTtcclxuICAgIH0sXHJcblxyXG4gICAgZGVjayA9IHtcclxuICAgICAgb246IG9uLFxyXG4gICAgICBvZmY6IG9mZixcclxuICAgICAgZmlyZTogZmlyZSxcclxuICAgICAgc2xpZGU6IHNsaWRlLFxyXG4gICAgICBuZXh0OiBzdGVwLmJpbmQobnVsbCwgMSksXHJcbiAgICAgIHByZXY6IHN0ZXAuYmluZChudWxsLCAtMSksXHJcbiAgICAgIHBhcmVudDogcGFyZW50LFxyXG4gICAgICBzbGlkZXM6IHNsaWRlc1xyXG4gICAgfTtcclxuXHJcbiAgKHBsdWdpbnMgfHwgW10pLmZvckVhY2goZnVuY3Rpb24ocGx1Z2luKSB7XHJcbiAgICBwbHVnaW4oZGVjayk7XHJcbiAgfSk7XHJcblxyXG4gIGFjdGl2YXRlKDApO1xyXG5cclxuICByZXR1cm4gZGVjaztcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gIGZyb206IGZyb21cclxufTtcclxuIiwiLy8gUmVxdWlyZSBOb2RlIG1vZHVsZXMgaW4gdGhlIGJyb3dzZXIgdGhhbmtzIHRvIEJyb3dzZXJpZnk6IGh0dHA6Ly9icm93c2VyaWZ5Lm9yZ1xyXG52YXIgYmVzcG9rZSA9IHJlcXVpcmUoJ2Jlc3Bva2UnKSxcclxuICBmeCA9IHJlcXVpcmUoJ2Jlc3Bva2UtZngnKSxcclxuICBncmVlbnkgPSByZXF1aXJlKCdiZXNwb2tlLXRoZW1lLWdyZWVueScpLFxyXG4gIGN1YmUgPSByZXF1aXJlKCdiZXNwb2tlLXRoZW1lLWN1YmUnKSxcclxuICAvL2Nhcm91c2VsID0gcmVxdWlyZSgnYmVzcG9rZS10aGVtZS1jYXJvdXNlbCcpLFxyXG4gIHNlYSA9IHJlcXVpcmUoJ2Jlc3Bva2UtdGhlbWUtc2VhJyksXHJcbiAga2V5cyA9IHJlcXVpcmUoJ2Jlc3Bva2Uta2V5cycpLFxyXG4gIHRvdWNoID0gcmVxdWlyZSgnYmVzcG9rZS10b3VjaCcpLFxyXG4gIGJ1bGxldHMgPSByZXF1aXJlKCdiZXNwb2tlLWJ1bGxldHMnKSxcclxuICBiYWNrZHJvcCA9IHJlcXVpcmUoJ2Jlc3Bva2UtYmFja2Ryb3AnKSxcclxuICBzY2FsZSA9IHJlcXVpcmUoJ2Jlc3Bva2Utc2NhbGUnKSxcclxuICBoYXNoID0gcmVxdWlyZSgnYmVzcG9rZS1oYXNoJyksXHJcbiAgcHJvZ3Jlc3MgPSByZXF1aXJlKCdiZXNwb2tlLXByb2dyZXNzJyksXHJcbiAgZm9ybXMgPSByZXF1aXJlKCdiZXNwb2tlLWZvcm1zJyk7XHJcblxyXG4vLyBCZXNwb2tlLmpzXHJcbmJlc3Bva2UuZnJvbSgnYXJ0aWNsZScsIFtcclxuICBjdWJlKCksXHJcbiAgLy9jYXJvdXNlbCgpLFxyXG4gIC8vc2VhKCksXHJcbiAga2V5cygpLFxyXG4gIHRvdWNoKCksXHJcbiAgYnVsbGV0cygnbGksIC5idWxsZXQnKSxcclxuICBiYWNrZHJvcCgpLFxyXG4gIHNjYWxlKCksXHJcbiAgaGFzaCgpLFxyXG4gIHByb2dyZXNzKCksXHJcbiAgZm9ybXMoKVxyXG5dKTtcclxuYmVzcG9rZS5mcm9tKCdhcnRpY2xlJywge1xyXG4gIGZ1bGxzY3JlZW5iYWNrZ3JvdW5kOiB0cnVlXHJcbn0pO1xyXG4vLyBQcmlzbSBzeW50YXggaGlnaGxpZ2h0aW5nXHJcbi8vIFRoaXMgaXMgYWN0dWFsbHkgbG9hZGVkIGZyb20gXCJib3dlcl9jb21wb25lbnRzXCIgdGhhbmtzIHRvXHJcbi8vIGRlYm93ZXJpZnk6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldWdlbmV3YXJlL2RlYm93ZXJpZnlcclxucmVxdWlyZShcIi4vLi5cXFxcLi5cXFxcYm93ZXJfY29tcG9uZW50c1xcXFxwcmlzbVxcXFxwcmlzbS5qc1wiKTtcclxuXHJcbiJdfQ==

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
  fx()
]);
bespoke.from('article', [
  bespoke.plugins.fx()
]);
bespoke.horizontal.from('article', {
  fx: true
})
bespoke.vertical.from('article', {
  fx: {
      direction: "vertical",
      transition: "cube",
      reverese: true
    }
});
// Prism syntax highlighting
// This is actually loaded from "bower_components" thanks to
// debowerify: https://github.com/eugeneware/debowerify
require("./../../bower_components/prism/prism.js");


},{"./../../bower_components/prism/prism.js":1,"bespoke":12,"bespoke-backdrop":2,"bespoke-bullets":3,"bespoke-forms":4,"bespoke-fx":5,"bespoke-hash":6,"bespoke-keys":7,"bespoke-progress":8,"bespoke-scale":9,"bespoke-theme-cube":10,"bespoke-touch":11}]},{},[13])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvb3Jpb24zNDIyL0Rlc2t0b3AvTXlSZXBvL2Jvd2VyX2NvbXBvbmVudHMvcHJpc20vcHJpc20uanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYmFja2Ryb3AvbGliL2Jlc3Bva2UtYmFja2Ryb3AuanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYnVsbGV0cy9saWIvYmVzcG9rZS1idWxsZXRzLmpzIiwiL2hvbWUvb3Jpb24zNDIyL0Rlc2t0b3AvTXlSZXBvL25vZGVfbW9kdWxlcy9iZXNwb2tlLWZvcm1zL2xpYi9iZXNwb2tlLWZvcm1zLmpzIiwiL2hvbWUvb3Jpb24zNDIyL0Rlc2t0b3AvTXlSZXBvL25vZGVfbW9kdWxlcy9iZXNwb2tlLWZ4L2xpYi9iZXNwb2tlLWZ4LmpzIiwiL2hvbWUvb3Jpb24zNDIyL0Rlc2t0b3AvTXlSZXBvL25vZGVfbW9kdWxlcy9iZXNwb2tlLWhhc2gvbGliL2Jlc3Bva2UtaGFzaC5qcyIsIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9ub2RlX21vZHVsZXMvYmVzcG9rZS1rZXlzL2xpYi9iZXNwb2tlLWtleXMuanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2UtcHJvZ3Jlc3MvbGliL2Jlc3Bva2UtcHJvZ3Jlc3MuanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2Utc2NhbGUvbGliL2Jlc3Bva2Utc2NhbGUuanMiLCIvaG9tZS9vcmlvbjM0MjIvRGVza3RvcC9NeVJlcG8vbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdGhlbWUtY3ViZS9kaXN0L2Jlc3Bva2UtdGhlbWUtY3ViZS5qcyIsIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9ub2RlX21vZHVsZXMvYmVzcG9rZS10b3VjaC9saWIvYmVzcG9rZS10b3VjaC5qcyIsIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9ub2RlX21vZHVsZXMvYmVzcG9rZS9saWIvYmVzcG9rZS5qcyIsIi9ob21lL29yaW9uMzQyMi9EZXNrdG9wL015UmVwby9zcmMvc2NyaXB0cy9mYWtlX2IwMWMzNjQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3B6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNvcmUuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxudmFyIF9zZWxmID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKVxuXHQ/IHdpbmRvdyAgIC8vIGlmIGluIGJyb3dzZXJcblx0OiAoXG5cdFx0KHR5cGVvZiBXb3JrZXJHbG9iYWxTY29wZSAhPT0gJ3VuZGVmaW5lZCcgJiYgc2VsZiBpbnN0YW5jZW9mIFdvcmtlckdsb2JhbFNjb3BlKVxuXHRcdD8gc2VsZiAvLyBpZiBpbiB3b3JrZXJcblx0XHQ6IHt9ICAgLy8gaWYgaW4gbm9kZSBqc1xuXHQpO1xuXG4vKipcbiAqIFByaXNtOiBMaWdodHdlaWdodCwgcm9idXN0LCBlbGVnYW50IHN5bnRheCBoaWdobGlnaHRpbmdcbiAqIE1JVCBsaWNlbnNlIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwL1xuICogQGF1dGhvciBMZWEgVmVyb3UgaHR0cDovL2xlYS52ZXJvdS5tZVxuICovXG5cbnZhciBQcmlzbSA9IChmdW5jdGlvbigpe1xuXG4vLyBQcml2YXRlIGhlbHBlciB2YXJzXG52YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LShcXHcrKVxcYi9pO1xudmFyIHVuaXF1ZUlkID0gMDtcblxudmFyIF8gPSBfc2VsZi5QcmlzbSA9IHtcblx0bWFudWFsOiBfc2VsZi5QcmlzbSAmJiBfc2VsZi5QcmlzbS5tYW51YWwsXG5cdHV0aWw6IHtcblx0XHRlbmNvZGU6IGZ1bmN0aW9uICh0b2tlbnMpIHtcblx0XHRcdGlmICh0b2tlbnMgaW5zdGFuY2VvZiBUb2tlbikge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFRva2VuKHRva2Vucy50eXBlLCBfLnV0aWwuZW5jb2RlKHRva2Vucy5jb250ZW50KSwgdG9rZW5zLmFsaWFzKTtcblx0XHRcdH0gZWxzZSBpZiAoXy51dGlsLnR5cGUodG9rZW5zKSA9PT0gJ0FycmF5Jykge1xuXHRcdFx0XHRyZXR1cm4gdG9rZW5zLm1hcChfLnV0aWwuZW5jb2RlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbnMucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHR0eXBlOiBmdW5jdGlvbiAobykge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKS5tYXRjaCgvXFxbb2JqZWN0IChcXHcrKVxcXS8pWzFdO1xuXHRcdH0sXG5cblx0XHRvYmpJZDogZnVuY3Rpb24gKG9iaikge1xuXHRcdFx0aWYgKCFvYmpbJ19faWQnXSkge1xuXHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCAnX19pZCcsIHsgdmFsdWU6ICsrdW5pcXVlSWQgfSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gb2JqWydfX2lkJ107XG5cdFx0fSxcblxuXHRcdC8vIERlZXAgY2xvbmUgYSBsYW5ndWFnZSBkZWZpbml0aW9uIChlLmcuIHRvIGV4dGVuZCBpdClcblx0XHRjbG9uZTogZnVuY3Rpb24gKG8pIHtcblx0XHRcdHZhciB0eXBlID0gXy51dGlsLnR5cGUobyk7XG5cblx0XHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0XHRjYXNlICdPYmplY3QnOlxuXHRcdFx0XHRcdHZhciBjbG9uZSA9IHt9O1xuXG5cdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIG8pIHtcblx0XHRcdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRcdFx0Y2xvbmVba2V5XSA9IF8udXRpbC5jbG9uZShvW2tleV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBjbG9uZTtcblxuXHRcdFx0XHRjYXNlICdBcnJheSc6XG5cdFx0XHRcdFx0Ly8gQ2hlY2sgZm9yIGV4aXN0ZW5jZSBmb3IgSUU4XG5cdFx0XHRcdFx0cmV0dXJuIG8ubWFwICYmIG8ubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIF8udXRpbC5jbG9uZSh2KTsgfSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBvO1xuXHRcdH1cblx0fSxcblxuXHRsYW5ndWFnZXM6IHtcblx0XHRleHRlbmQ6IGZ1bmN0aW9uIChpZCwgcmVkZWYpIHtcblx0XHRcdHZhciBsYW5nID0gXy51dGlsLmNsb25lKF8ubGFuZ3VhZ2VzW2lkXSk7XG5cblx0XHRcdGZvciAodmFyIGtleSBpbiByZWRlZikge1xuXHRcdFx0XHRsYW5nW2tleV0gPSByZWRlZltrZXldO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbGFuZztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0ICogSW5zZXJ0IGEgdG9rZW4gYmVmb3JlIGFub3RoZXIgdG9rZW4gaW4gYSBsYW5ndWFnZSBsaXRlcmFsXG5cdFx0ICogQXMgdGhpcyBuZWVkcyB0byByZWNyZWF0ZSB0aGUgb2JqZWN0ICh3ZSBjYW5ub3QgYWN0dWFsbHkgaW5zZXJ0IGJlZm9yZSBrZXlzIGluIG9iamVjdCBsaXRlcmFscyksXG5cdFx0ICogd2UgY2Fubm90IGp1c3QgcHJvdmlkZSBhbiBvYmplY3QsIHdlIG5lZWQgYW5vYmplY3QgYW5kIGEga2V5LlxuXHRcdCAqIEBwYXJhbSBpbnNpZGUgVGhlIGtleSAob3IgbGFuZ3VhZ2UgaWQpIG9mIHRoZSBwYXJlbnRcblx0XHQgKiBAcGFyYW0gYmVmb3JlIFRoZSBrZXkgdG8gaW5zZXJ0IGJlZm9yZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgZnVuY3Rpb24gYXBwZW5kcyBpbnN0ZWFkLlxuXHRcdCAqIEBwYXJhbSBpbnNlcnQgT2JqZWN0IHdpdGggdGhlIGtleS92YWx1ZSBwYWlycyB0byBpbnNlcnRcblx0XHQgKiBAcGFyYW0gcm9vdCBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgYGluc2lkZWAuIElmIGVxdWFsIHRvIFByaXNtLmxhbmd1YWdlcywgaXQgY2FuIGJlIG9taXR0ZWQuXG5cdFx0ICovXG5cdFx0aW5zZXJ0QmVmb3JlOiBmdW5jdGlvbiAoaW5zaWRlLCBiZWZvcmUsIGluc2VydCwgcm9vdCkge1xuXHRcdFx0cm9vdCA9IHJvb3QgfHwgXy5sYW5ndWFnZXM7XG5cdFx0XHR2YXIgZ3JhbW1hciA9IHJvb3RbaW5zaWRlXTtcblxuXHRcdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMikge1xuXHRcdFx0XHRpbnNlcnQgPSBhcmd1bWVudHNbMV07XG5cblx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XG5cdFx0XHRcdFx0aWYgKGluc2VydC5oYXNPd25Qcm9wZXJ0eShuZXdUb2tlbikpIHtcblx0XHRcdFx0XHRcdGdyYW1tYXJbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZ3JhbW1hcjtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHJldCA9IHt9O1xuXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XG5cblx0XHRcdFx0aWYgKGdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pKSB7XG5cblx0XHRcdFx0XHRpZiAodG9rZW4gPT0gYmVmb3JlKSB7XG5cblx0XHRcdFx0XHRcdGZvciAodmFyIG5ld1Rva2VuIGluIGluc2VydCkge1xuXG5cdFx0XHRcdFx0XHRcdGlmIChpbnNlcnQuaGFzT3duUHJvcGVydHkobmV3VG9rZW4pKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0W25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXRbdG9rZW5dID0gZ3JhbW1hclt0b2tlbl07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gVXBkYXRlIHJlZmVyZW5jZXMgaW4gb3RoZXIgbGFuZ3VhZ2UgZGVmaW5pdGlvbnNcblx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhfLmxhbmd1YWdlcywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRcdFx0XHRpZiAodmFsdWUgPT09IHJvb3RbaW5zaWRlXSAmJiBrZXkgIT0gaW5zaWRlKSB7XG5cdFx0XHRcdFx0dGhpc1trZXldID0gcmV0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIHJvb3RbaW5zaWRlXSA9IHJldDtcblx0XHR9LFxuXG5cdFx0Ly8gVHJhdmVyc2UgYSBsYW5ndWFnZSBkZWZpbml0aW9uIHdpdGggRGVwdGggRmlyc3QgU2VhcmNoXG5cdFx0REZTOiBmdW5jdGlvbihvLCBjYWxsYmFjaywgdHlwZSwgdmlzaXRlZCkge1xuXHRcdFx0dmlzaXRlZCA9IHZpc2l0ZWQgfHwge307XG5cdFx0XHRmb3IgKHZhciBpIGluIG8pIHtcblx0XHRcdFx0aWYgKG8uaGFzT3duUHJvcGVydHkoaSkpIHtcblx0XHRcdFx0XHRjYWxsYmFjay5jYWxsKG8sIGksIG9baV0sIHR5cGUgfHwgaSk7XG5cblx0XHRcdFx0XHRpZiAoXy51dGlsLnR5cGUob1tpXSkgPT09ICdPYmplY3QnICYmICF2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0pIHtcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2ssIG51bGwsIHZpc2l0ZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ0FycmF5JyAmJiAhdmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldKSB7XG5cdFx0XHRcdFx0XHR2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0Xy5sYW5ndWFnZXMuREZTKG9baV0sIGNhbGxiYWNrLCBpLCB2aXNpdGVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdHBsdWdpbnM6IHt9LFxuXG5cdGhpZ2hsaWdodEFsbDogZnVuY3Rpb24oYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0dmFyIGVudiA9IHtcblx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcblx0XHRcdHNlbGVjdG9yOiAnY29kZVtjbGFzcyo9XCJsYW5ndWFnZS1cIl0sIFtjbGFzcyo9XCJsYW5ndWFnZS1cIl0gY29kZSwgY29kZVtjbGFzcyo9XCJsYW5nLVwiXSwgW2NsYXNzKj1cImxhbmctXCJdIGNvZGUnXG5cdFx0fTtcblxuXHRcdF8uaG9va3MucnVuKFwiYmVmb3JlLWhpZ2hsaWdodGFsbFwiLCBlbnYpO1xuXG5cdFx0dmFyIGVsZW1lbnRzID0gZW52LmVsZW1lbnRzIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoZW52LnNlbGVjdG9yKTtcblxuXHRcdGZvciAodmFyIGk9MCwgZWxlbWVudDsgZWxlbWVudCA9IGVsZW1lbnRzW2krK107KSB7XG5cdFx0XHRfLmhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgPT09IHRydWUsIGVudi5jYWxsYmFjayk7XG5cdFx0fVxuXHR9LFxuXG5cdGhpZ2hsaWdodEVsZW1lbnQ6IGZ1bmN0aW9uKGVsZW1lbnQsIGFzeW5jLCBjYWxsYmFjaykge1xuXHRcdC8vIEZpbmQgbGFuZ3VhZ2Vcblx0XHR2YXIgbGFuZ3VhZ2UsIGdyYW1tYXIsIHBhcmVudCA9IGVsZW1lbnQ7XG5cblx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuXHRcdH1cblxuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdGxhbmd1YWdlID0gKHBhcmVudC5jbGFzc05hbWUubWF0Y2gobGFuZykgfHwgWywnJ10pWzFdLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRncmFtbWFyID0gXy5sYW5ndWFnZXNbbGFuZ3VhZ2VdO1xuXHRcdH1cblxuXHRcdC8vIFNldCBsYW5ndWFnZSBvbiB0aGUgZWxlbWVudCwgaWYgbm90IHByZXNlbnRcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXG5cdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBwYXJlbnQsIGZvciBzdHlsaW5nXG5cdFx0cGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xuXG5cdFx0aWYgKC9wcmUvaS50ZXN0KHBhcmVudC5ub2RlTmFtZSkpIHtcblx0XHRcdHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXHRcdH1cblxuXHRcdHZhciBjb2RlID0gZWxlbWVudC50ZXh0Q29udGVudDtcblxuXHRcdHZhciBlbnYgPSB7XG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LFxuXHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdFx0Z3JhbW1hcjogZ3JhbW1hcixcblx0XHRcdGNvZGU6IGNvZGVcblx0XHR9O1xuXG5cdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1zYW5pdHktY2hlY2snLCBlbnYpO1xuXG5cdFx0aWYgKCFlbnYuY29kZSB8fCAhZW52LmdyYW1tYXIpIHtcblx0XHRcdGlmIChlbnYuY29kZSkge1xuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHRcdGVudi5lbGVtZW50LnRleHRDb250ZW50ID0gZW52LmNvZGU7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0fVxuXHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XG5cblx0XHRpZiAoYXN5bmMgJiYgX3NlbGYuV29ya2VyKSB7XG5cdFx0XHR2YXIgd29ya2VyID0gbmV3IFdvcmtlcihfLmZpbGVuYW1lKTtcblxuXHRcdFx0d29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gZXZ0LmRhdGE7XG5cblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1pbnNlcnQnLCBlbnYpO1xuXG5cdFx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XG5cblx0XHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbnYuZWxlbWVudCk7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xuXHRcdFx0fTtcblxuXHRcdFx0d29ya2VyLnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0bGFuZ3VhZ2U6IGVudi5sYW5ndWFnZSxcblx0XHRcdFx0Y29kZTogZW52LmNvZGUsXG5cdFx0XHRcdGltbWVkaWF0ZUNsb3NlOiB0cnVlXG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IF8uaGlnaGxpZ2h0KGVudi5jb2RlLCBlbnYuZ3JhbW1hciwgZW52Lmxhbmd1YWdlKTtcblxuXHRcdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1pbnNlcnQnLCBlbnYpO1xuXG5cdFx0XHRlbnYuZWxlbWVudC5pbm5lckhUTUwgPSBlbnYuaGlnaGxpZ2h0ZWRDb2RlO1xuXG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVsZW1lbnQpO1xuXG5cdFx0XHRfLmhvb2tzLnJ1bignYWZ0ZXItaGlnaGxpZ2h0JywgZW52KTtcblx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XG5cdFx0fVxuXHR9LFxuXG5cdGhpZ2hsaWdodDogZnVuY3Rpb24gKHRleHQsIGdyYW1tYXIsIGxhbmd1YWdlKSB7XG5cdFx0dmFyIHRva2VucyA9IF8udG9rZW5pemUodGV4dCwgZ3JhbW1hcik7XG5cdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShfLnV0aWwuZW5jb2RlKHRva2VucyksIGxhbmd1YWdlKTtcblx0fSxcblxuXHRtYXRjaEdyYW1tYXI6IGZ1bmN0aW9uICh0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIGluZGV4LCBzdGFydFBvcywgb25lc2hvdCwgdGFyZ2V0KSB7XG5cdFx0dmFyIFRva2VuID0gXy5Ub2tlbjtcblxuXHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblx0XHRcdGlmKCFncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSB8fCAhZ3JhbW1hclt0b2tlbl0pIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0b2tlbiA9PSB0YXJnZXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcGF0dGVybnMgPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdHBhdHRlcm5zID0gKF8udXRpbC50eXBlKHBhdHRlcm5zKSA9PT0gXCJBcnJheVwiKSA/IHBhdHRlcm5zIDogW3BhdHRlcm5zXTtcblxuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwYXR0ZXJucy5sZW5ndGg7ICsraikge1xuXHRcdFx0XHR2YXIgcGF0dGVybiA9IHBhdHRlcm5zW2pdLFxuXHRcdFx0XHRcdGluc2lkZSA9IHBhdHRlcm4uaW5zaWRlLFxuXHRcdFx0XHRcdGxvb2tiZWhpbmQgPSAhIXBhdHRlcm4ubG9va2JlaGluZCxcblx0XHRcdFx0XHRncmVlZHkgPSAhIXBhdHRlcm4uZ3JlZWR5LFxuXHRcdFx0XHRcdGxvb2tiZWhpbmRMZW5ndGggPSAwLFxuXHRcdFx0XHRcdGFsaWFzID0gcGF0dGVybi5hbGlhcztcblxuXHRcdFx0XHRpZiAoZ3JlZWR5ICYmICFwYXR0ZXJuLnBhdHRlcm4uZ2xvYmFsKSB7XG5cdFx0XHRcdFx0Ly8gV2l0aG91dCB0aGUgZ2xvYmFsIGZsYWcsIGxhc3RJbmRleCB3b24ndCB3b3JrXG5cdFx0XHRcdFx0dmFyIGZsYWdzID0gcGF0dGVybi5wYXR0ZXJuLnRvU3RyaW5nKCkubWF0Y2goL1tpbXV5XSokLylbMF07XG5cdFx0XHRcdFx0cGF0dGVybi5wYXR0ZXJuID0gUmVnRXhwKHBhdHRlcm4ucGF0dGVybi5zb3VyY2UsIGZsYWdzICsgXCJnXCIpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGF0dGVybiA9IHBhdHRlcm4ucGF0dGVybiB8fCBwYXR0ZXJuO1xuXG5cdFx0XHRcdC8vIERvbuKAmXQgY2FjaGUgbGVuZ3RoIGFzIGl0IGNoYW5nZXMgZHVyaW5nIHRoZSBsb29wXG5cdFx0XHRcdGZvciAodmFyIGkgPSBpbmRleCwgcG9zID0gc3RhcnRQb3M7IGkgPCBzdHJhcnIubGVuZ3RoOyBwb3MgKz0gc3RyYXJyW2ldLmxlbmd0aCwgKytpKSB7XG5cblx0XHRcdFx0XHR2YXIgc3RyID0gc3RyYXJyW2ldO1xuXG5cdFx0XHRcdFx0aWYgKHN0cmFyci5sZW5ndGggPiB0ZXh0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Ly8gU29tZXRoaW5nIHdlbnQgdGVycmlibHkgd3JvbmcsIEFCT1JULCBBQk9SVCFcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoc3RyIGluc3RhbmNlb2YgVG9rZW4pIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gMDtcblxuXHRcdFx0XHRcdHZhciBtYXRjaCA9IHBhdHRlcm4uZXhlYyhzdHIpLFxuXHRcdFx0XHRcdCAgICBkZWxOdW0gPSAxO1xuXG5cdFx0XHRcdFx0Ly8gR3JlZWR5IHBhdHRlcm5zIGNhbiBvdmVycmlkZS9yZW1vdmUgdXAgdG8gdHdvIHByZXZpb3VzbHkgbWF0Y2hlZCB0b2tlbnNcblx0XHRcdFx0XHRpZiAoIW1hdGNoICYmIGdyZWVkeSAmJiBpICE9IHN0cmFyci5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuLmxhc3RJbmRleCA9IHBvcztcblx0XHRcdFx0XHRcdG1hdGNoID0gcGF0dGVybi5leGVjKHRleHQpO1xuXHRcdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dmFyIGZyb20gPSBtYXRjaC5pbmRleCArIChsb29rYmVoaW5kID8gbWF0Y2hbMV0ubGVuZ3RoIDogMCksXG5cdFx0XHRcdFx0XHQgICAgdG8gPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCxcblx0XHRcdFx0XHRcdCAgICBrID0gaSxcblx0XHRcdFx0XHRcdCAgICBwID0gcG9zO1xuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBsZW4gPSBzdHJhcnIubGVuZ3RoOyBrIDwgbGVuICYmIChwIDwgdG8gfHwgKCFzdHJhcnJba10udHlwZSAmJiAhc3RyYXJyW2sgLSAxXS5ncmVlZHkpKTsgKytrKSB7XG5cdFx0XHRcdFx0XHRcdHAgKz0gc3RyYXJyW2tdLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0Ly8gTW92ZSB0aGUgaW5kZXggaSB0byB0aGUgZWxlbWVudCBpbiBzdHJhcnIgdGhhdCBpcyBjbG9zZXN0IHRvIGZyb21cblx0XHRcdFx0XHRcdFx0aWYgKGZyb20gPj0gcCkge1xuXHRcdFx0XHRcdFx0XHRcdCsraTtcblx0XHRcdFx0XHRcdFx0XHRwb3MgPSBwO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8qXG5cdFx0XHRcdFx0XHQgKiBJZiBzdHJhcnJbaV0gaXMgYSBUb2tlbiwgdGhlbiB0aGUgbWF0Y2ggc3RhcnRzIGluc2lkZSBhbm90aGVyIFRva2VuLCB3aGljaCBpcyBpbnZhbGlkXG5cdFx0XHRcdFx0XHQgKiBJZiBzdHJhcnJbayAtIDFdIGlzIGdyZWVkeSB3ZSBhcmUgaW4gY29uZmxpY3Qgd2l0aCBhbm90aGVyIGdyZWVkeSBwYXR0ZXJuXG5cdFx0XHRcdFx0XHQgKi9cblx0XHRcdFx0XHRcdGlmIChzdHJhcnJbaV0gaW5zdGFuY2VvZiBUb2tlbiB8fCBzdHJhcnJbayAtIDFdLmdyZWVkeSkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gTnVtYmVyIG9mIHRva2VucyB0byBkZWxldGUgYW5kIHJlcGxhY2Ugd2l0aCB0aGUgbmV3IG1hdGNoXG5cdFx0XHRcdFx0XHRkZWxOdW0gPSBrIC0gaTtcblx0XHRcdFx0XHRcdHN0ciA9IHRleHQuc2xpY2UocG9zLCBwKTtcblx0XHRcdFx0XHRcdG1hdGNoLmluZGV4IC09IHBvcztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRcdFx0XHRpZiAob25lc2hvdCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYobG9va2JlaGluZCkge1xuXHRcdFx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IG1hdGNoWzFdLmxlbmd0aDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgbG9va2JlaGluZExlbmd0aCxcblx0XHRcdFx0XHQgICAgbWF0Y2ggPSBtYXRjaFswXS5zbGljZShsb29rYmVoaW5kTGVuZ3RoKSxcblx0XHRcdFx0XHQgICAgdG8gPSBmcm9tICsgbWF0Y2gubGVuZ3RoLFxuXHRcdFx0XHRcdCAgICBiZWZvcmUgPSBzdHIuc2xpY2UoMCwgZnJvbSksXG5cdFx0XHRcdFx0ICAgIGFmdGVyID0gc3RyLnNsaWNlKHRvKTtcblxuXHRcdFx0XHRcdHZhciBhcmdzID0gW2ksIGRlbE51bV07XG5cblx0XHRcdFx0XHRpZiAoYmVmb3JlKSB7XG5cdFx0XHRcdFx0XHQrK2k7XG5cdFx0XHRcdFx0XHRwb3MgKz0gYmVmb3JlLmxlbmd0aDtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChiZWZvcmUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciB3cmFwcGVkID0gbmV3IFRva2VuKHRva2VuLCBpbnNpZGU/IF8udG9rZW5pemUobWF0Y2gsIGluc2lkZSkgOiBtYXRjaCwgYWxpYXMsIG1hdGNoLCBncmVlZHkpO1xuXG5cdFx0XHRcdFx0YXJncy5wdXNoKHdyYXBwZWQpO1xuXG5cdFx0XHRcdFx0aWYgKGFmdGVyKSB7XG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYWZ0ZXIpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkoc3RyYXJyLCBhcmdzKTtcblxuXHRcdFx0XHRcdGlmIChkZWxOdW0gIT0gMSlcblx0XHRcdFx0XHRcdF8ubWF0Y2hHcmFtbWFyKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgaSwgcG9zLCB0cnVlLCB0b2tlbik7XG5cblx0XHRcdFx0XHRpZiAob25lc2hvdClcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdHRva2VuaXplOiBmdW5jdGlvbih0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xuXHRcdHZhciBzdHJhcnIgPSBbdGV4dF07XG5cblx0XHR2YXIgcmVzdCA9IGdyYW1tYXIucmVzdDtcblxuXHRcdGlmIChyZXN0KSB7XG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiByZXN0KSB7XG5cdFx0XHRcdGdyYW1tYXJbdG9rZW5dID0gcmVzdFt0b2tlbl07XG5cdFx0XHR9XG5cblx0XHRcdGRlbGV0ZSBncmFtbWFyLnJlc3Q7XG5cdFx0fVxuXG5cdFx0Xy5tYXRjaEdyYW1tYXIodGV4dCwgc3RyYXJyLCBncmFtbWFyLCAwLCAwLCBmYWxzZSk7XG5cblx0XHRyZXR1cm4gc3RyYXJyO1xuXHR9LFxuXG5cdGhvb2tzOiB7XG5cdFx0YWxsOiB7fSxcblxuXHRcdGFkZDogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgaG9va3MgPSBfLmhvb2tzLmFsbDtcblxuXHRcdFx0aG9va3NbbmFtZV0gPSBob29rc1tuYW1lXSB8fCBbXTtcblxuXHRcdFx0aG9va3NbbmFtZV0ucHVzaChjYWxsYmFjayk7XG5cdFx0fSxcblxuXHRcdHJ1bjogZnVuY3Rpb24gKG5hbWUsIGVudikge1xuXHRcdFx0dmFyIGNhbGxiYWNrcyA9IF8uaG9va3MuYWxsW25hbWVdO1xuXG5cdFx0XHRpZiAoIWNhbGxiYWNrcyB8fCAhY2FsbGJhY2tzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGZvciAodmFyIGk9MCwgY2FsbGJhY2s7IGNhbGxiYWNrID0gY2FsbGJhY2tzW2krK107KSB7XG5cdFx0XHRcdGNhbGxiYWNrKGVudik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG52YXIgVG9rZW4gPSBfLlRva2VuID0gZnVuY3Rpb24odHlwZSwgY29udGVudCwgYWxpYXMsIG1hdGNoZWRTdHIsIGdyZWVkeSkge1xuXHR0aGlzLnR5cGUgPSB0eXBlO1xuXHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xuXHR0aGlzLmFsaWFzID0gYWxpYXM7XG5cdC8vIENvcHkgb2YgdGhlIGZ1bGwgc3RyaW5nIHRoaXMgdG9rZW4gd2FzIGNyZWF0ZWQgZnJvbVxuXHR0aGlzLmxlbmd0aCA9IChtYXRjaGVkU3RyIHx8IFwiXCIpLmxlbmd0aHwwO1xuXHR0aGlzLmdyZWVkeSA9ICEhZ3JlZWR5O1xufTtcblxuVG9rZW4uc3RyaW5naWZ5ID0gZnVuY3Rpb24obywgbGFuZ3VhZ2UsIHBhcmVudCkge1xuXHRpZiAodHlwZW9mIG8gPT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gbztcblx0fVxuXG5cdGlmIChfLnV0aWwudHlwZShvKSA9PT0gJ0FycmF5Jykge1xuXHRcdHJldHVybiBvLm1hcChmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KGVsZW1lbnQsIGxhbmd1YWdlLCBvKTtcblx0XHR9KS5qb2luKCcnKTtcblx0fVxuXG5cdHZhciBlbnYgPSB7XG5cdFx0dHlwZTogby50eXBlLFxuXHRcdGNvbnRlbnQ6IFRva2VuLnN0cmluZ2lmeShvLmNvbnRlbnQsIGxhbmd1YWdlLCBwYXJlbnQpLFxuXHRcdHRhZzogJ3NwYW4nLFxuXHRcdGNsYXNzZXM6IFsndG9rZW4nLCBvLnR5cGVdLFxuXHRcdGF0dHJpYnV0ZXM6IHt9LFxuXHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRwYXJlbnQ6IHBhcmVudFxuXHR9O1xuXG5cdGlmIChlbnYudHlwZSA9PSAnY29tbWVudCcpIHtcblx0XHRlbnYuYXR0cmlidXRlc1snc3BlbGxjaGVjayddID0gJ3RydWUnO1xuXHR9XG5cblx0aWYgKG8uYWxpYXMpIHtcblx0XHR2YXIgYWxpYXNlcyA9IF8udXRpbC50eXBlKG8uYWxpYXMpID09PSAnQXJyYXknID8gby5hbGlhcyA6IFtvLmFsaWFzXTtcblx0XHRBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShlbnYuY2xhc3NlcywgYWxpYXNlcyk7XG5cdH1cblxuXHRfLmhvb2tzLnJ1bignd3JhcCcsIGVudik7XG5cblx0dmFyIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhlbnYuYXR0cmlidXRlcykubWFwKGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gbmFtZSArICc9XCInICsgKGVudi5hdHRyaWJ1dGVzW25hbWVdIHx8ICcnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JykgKyAnXCInO1xuXHR9KS5qb2luKCcgJyk7XG5cblx0cmV0dXJuICc8JyArIGVudi50YWcgKyAnIGNsYXNzPVwiJyArIGVudi5jbGFzc2VzLmpvaW4oJyAnKSArICdcIicgKyAoYXR0cmlidXRlcyA/ICcgJyArIGF0dHJpYnV0ZXMgOiAnJykgKyAnPicgKyBlbnYuY29udGVudCArICc8LycgKyBlbnYudGFnICsgJz4nO1xuXG59O1xuXG5pZiAoIV9zZWxmLmRvY3VtZW50KSB7XG5cdGlmICghX3NlbGYuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHRcdC8vIGluIE5vZGUuanNcblx0XHRyZXR1cm4gX3NlbGYuUHJpc207XG5cdH1cbiBcdC8vIEluIHdvcmtlclxuXHRfc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0dmFyIG1lc3NhZ2UgPSBKU09OLnBhcnNlKGV2dC5kYXRhKSxcblx0XHQgICAgbGFuZyA9IG1lc3NhZ2UubGFuZ3VhZ2UsXG5cdFx0ICAgIGNvZGUgPSBtZXNzYWdlLmNvZGUsXG5cdFx0ICAgIGltbWVkaWF0ZUNsb3NlID0gbWVzc2FnZS5pbW1lZGlhdGVDbG9zZTtcblxuXHRcdF9zZWxmLnBvc3RNZXNzYWdlKF8uaGlnaGxpZ2h0KGNvZGUsIF8ubGFuZ3VhZ2VzW2xhbmddLCBsYW5nKSk7XG5cdFx0aWYgKGltbWVkaWF0ZUNsb3NlKSB7XG5cdFx0XHRfc2VsZi5jbG9zZSgpO1xuXHRcdH1cblx0fSwgZmFsc2UpO1xuXG5cdHJldHVybiBfc2VsZi5QcmlzbTtcbn1cblxuLy9HZXQgY3VycmVudCBzY3JpcHQgYW5kIGhpZ2hsaWdodFxudmFyIHNjcmlwdCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQgfHwgW10uc2xpY2UuY2FsbChkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKSkucG9wKCk7XG5cbmlmIChzY3JpcHQpIHtcblx0Xy5maWxlbmFtZSA9IHNjcmlwdC5zcmM7XG5cblx0aWYgKGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIgJiYgIV8ubWFudWFsICYmICFzY3JpcHQuaGFzQXR0cmlidXRlKCdkYXRhLW1hbnVhbCcpKSB7XG5cdFx0aWYoZG9jdW1lbnQucmVhZHlTdGF0ZSAhPT0gXCJsb2FkaW5nXCIpIHtcblx0XHRcdGlmICh3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoXy5oaWdobGlnaHRBbGwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoXy5oaWdobGlnaHRBbGwsIDE2KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgXy5oaWdobGlnaHRBbGwpO1xuXHRcdH1cblx0fVxufVxuXG5yZXR1cm4gX3NlbGYuUHJpc207XG5cbn0pKCk7XG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuXHRtb2R1bGUuZXhwb3J0cyA9IFByaXNtO1xufVxuXG4vLyBoYWNrIGZvciBjb21wb25lbnRzIHRvIHdvcmsgY29ycmVjdGx5IGluIG5vZGUuanNcbmlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuXHRnbG9iYWwuUHJpc20gPSBQcmlzbTtcbn1cblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLW1hcmt1cC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMubWFya3VwID0ge1xuXHQnY29tbWVudCc6IC88IS0tW1xcc1xcU10qPy0tPi8sXG5cdCdwcm9sb2cnOiAvPFxcP1tcXHNcXFNdKz9cXD8+Lyxcblx0J2RvY3R5cGUnOiAvPCFET0NUWVBFW1xcc1xcU10rPz4vaSxcblx0J2NkYXRhJzogLzwhXFxbQ0RBVEFcXFtbXFxzXFxTXSo/XV0+L2ksXG5cdCd0YWcnOiB7XG5cdFx0cGF0dGVybjogLzxcXC8/KD8hXFxkKVteXFxzPlxcLz0kPF0rKD86XFxzK1teXFxzPlxcLz1dKyg/Oj0oPzooXCJ8JykoPzpcXFxcXFwxfFxcXFw/KD8hXFwxKVtcXHNcXFNdKSpcXDF8W15cXHMnXCI+PV0rKSk/KSpcXHMqXFwvPz4vaSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCd0YWcnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9ePFxcLz9bXlxccz5cXC9dKy9pLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQncHVuY3R1YXRpb24nOiAvXjxcXC8/Lyxcblx0XHRcdFx0XHQnbmFtZXNwYWNlJzogL15bXlxccz5cXC86XSs6L1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J2F0dHItdmFsdWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC89KD86KCd8XCIpW1xcc1xcU10qPyhcXDEpfFteXFxzPl0rKS9pLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQncHVuY3R1YXRpb24nOiAvWz0+XCInXS9cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdwdW5jdHVhdGlvbic6IC9cXC8/Pi8sXG5cdFx0XHQnYXR0ci1uYW1lJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvW15cXHM+XFwvXSsvLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQnbmFtZXNwYWNlJzogL15bXlxccz5cXC86XSs6L1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9XG5cdH0sXG5cdCdlbnRpdHknOiAvJiM/W1xcZGEtel17MSw4fTsvaVxufTtcblxuLy8gUGx1Z2luIHRvIG1ha2UgZW50aXR5IHRpdGxlIHNob3cgdGhlIHJlYWwgZW50aXR5LCBpZGVhIGJ5IFJvbWFuIEtvbWFyb3ZcblByaXNtLmhvb2tzLmFkZCgnd3JhcCcsIGZ1bmN0aW9uKGVudikge1xuXG5cdGlmIChlbnYudHlwZSA9PT0gJ2VudGl0eScpIHtcblx0XHRlbnYuYXR0cmlidXRlc1sndGl0bGUnXSA9IGVudi5jb250ZW50LnJlcGxhY2UoLyZhbXA7LywgJyYnKTtcblx0fVxufSk7XG5cblByaXNtLmxhbmd1YWdlcy54bWwgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xuUHJpc20ubGFuZ3VhZ2VzLmh0bWwgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xuUHJpc20ubGFuZ3VhZ2VzLm1hdGhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMuc3ZnID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNzcy5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuY3NzID0ge1xuXHQnY29tbWVudCc6IC9cXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcblx0J2F0cnVsZSc6IHtcblx0XHRwYXR0ZXJuOiAvQFtcXHctXSs/Lio/KDt8KD89XFxzKlxceykpL2ksXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQncnVsZSc6IC9AW1xcdy1dKy9cblx0XHRcdC8vIFNlZSByZXN0IGJlbG93XG5cdFx0fVxuXHR9LFxuXHQndXJsJzogL3VybFxcKCg/OihbXCInXSkoXFxcXCg/OlxcclxcbnxbXFxzXFxTXSl8KD8hXFwxKVteXFxcXFxcclxcbl0pKlxcMXwuKj8pXFwpL2ksXG5cdCdzZWxlY3Rvcic6IC9bXlxce1xcfVxcc11bXlxce1xcfTtdKj8oPz1cXHMqXFx7KS8sXG5cdCdzdHJpbmcnOiB7XG5cdFx0cGF0dGVybjogLyhcInwnKShcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxLyxcblx0XHRncmVlZHk6IHRydWVcblx0fSxcblx0J3Byb3BlcnR5JzogLyhcXGJ8XFxCKVtcXHctXSsoPz1cXHMqOikvaSxcblx0J2ltcG9ydGFudCc6IC9cXEIhaW1wb3J0YW50XFxiL2ksXG5cdCdmdW5jdGlvbic6IC9bLWEtejAtOV0rKD89XFwoKS9pLFxuXHQncHVuY3R1YXRpb24nOiAvWygpe307Ol0vXG59O1xuXG5QcmlzbS5sYW5ndWFnZXMuY3NzWydhdHJ1bGUnXS5pbnNpZGUucmVzdCA9IFByaXNtLnV0aWwuY2xvbmUoUHJpc20ubGFuZ3VhZ2VzLmNzcyk7XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ21hcmt1cCcsICd0YWcnLCB7XG5cdFx0J3N0eWxlJzoge1xuXHRcdFx0cGF0dGVybjogLyg8c3R5bGVbXFxzXFxTXSo/PilbXFxzXFxTXSo/KD89PFxcL3N0eWxlPikvaSxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5jc3MsXG5cdFx0XHRhbGlhczogJ2xhbmd1YWdlLWNzcydcblx0XHR9XG5cdH0pO1xuXHRcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnaW5zaWRlJywgJ2F0dHItdmFsdWUnLCB7XG5cdFx0J3N0eWxlLWF0dHInOiB7XG5cdFx0XHRwYXR0ZXJuOiAvXFxzKnN0eWxlPShcInwnKS4qP1xcMS9pLFxuXHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdFx0cGF0dGVybjogL15cXHMqc3R5bGUvaSxcblx0XHRcdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5tYXJrdXAudGFnLmluc2lkZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQncHVuY3R1YXRpb24nOiAvXlxccyo9XFxzKlsnXCJdfFsnXCJdXFxzKiQvLFxuXHRcdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAvLisvaSxcblx0XHRcdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5jc3Ncblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xuXHRcdH1cblx0fSwgUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcpO1xufVxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNsaWtlLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jbGlrZSA9IHtcblx0J2NvbW1lbnQnOiBbXG5cdFx0e1xuXHRcdFx0cGF0dGVybjogLyhefFteXFxcXF0pXFwvXFwqW1xcc1xcU10qP1xcKlxcLy8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcOl0pXFwvXFwvLiovLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxuXHRcdH1cblx0XSxcblx0J3N0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvKFtcIiddKShcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxLyxcblx0XHRncmVlZHk6IHRydWVcblx0fSxcblx0J2NsYXNzLW5hbWUnOiB7XG5cdFx0cGF0dGVybjogLygoPzpcXGIoPzpjbGFzc3xpbnRlcmZhY2V8ZXh0ZW5kc3xpbXBsZW1lbnRzfHRyYWl0fGluc3RhbmNlb2Z8bmV3KVxccyspfCg/OmNhdGNoXFxzK1xcKCkpW2EtejAtOV9cXC5cXFxcXSsvaSxcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdGluc2lkZToge1xuXHRcdFx0cHVuY3R1YXRpb246IC8oXFwufFxcXFwpL1xuXHRcdH1cblx0fSxcblx0J2tleXdvcmQnOiAvXFxiKGlmfGVsc2V8d2hpbGV8ZG98Zm9yfHJldHVybnxpbnxpbnN0YW5jZW9mfGZ1bmN0aW9ufG5ld3x0cnl8dGhyb3d8Y2F0Y2h8ZmluYWxseXxudWxsfGJyZWFrfGNvbnRpbnVlKVxcYi8sXG5cdCdib29sZWFuJzogL1xcYih0cnVlfGZhbHNlKVxcYi8sXG5cdCdmdW5jdGlvbic6IC9bYS16MC05X10rKD89XFwoKS9pLFxuXHQnbnVtYmVyJzogL1xcYi0/KD86MHhbXFxkYS1mXSt8XFxkKlxcLj9cXGQrKD86ZVsrLV0/XFxkKyk/KVxcYi9pLFxuXHQnb3BlcmF0b3InOiAvLS0/fFxcK1xcKz98IT0/PT98PD0/fD49P3w9PT89P3wmJj98XFx8XFx8P3xcXD98XFwqfFxcL3x+fFxcXnwlLyxcblx0J3B1bmN0dWF0aW9uJzogL1t7fVtcXF07KCksLjpdL1xufTtcblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWphdmFzY3JpcHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQgPSBQcmlzbS5sYW5ndWFnZXMuZXh0ZW5kKCdjbGlrZScsIHtcblx0J2tleXdvcmQnOiAvXFxiKGFzfGFzeW5jfGF3YWl0fGJyZWFrfGNhc2V8Y2F0Y2h8Y2xhc3N8Y29uc3R8Y29udGludWV8ZGVidWdnZXJ8ZGVmYXVsdHxkZWxldGV8ZG98ZWxzZXxlbnVtfGV4cG9ydHxleHRlbmRzfGZpbmFsbHl8Zm9yfGZyb218ZnVuY3Rpb258Z2V0fGlmfGltcGxlbWVudHN8aW1wb3J0fGlufGluc3RhbmNlb2Z8aW50ZXJmYWNlfGxldHxuZXd8bnVsbHxvZnxwYWNrYWdlfHByaXZhdGV8cHJvdGVjdGVkfHB1YmxpY3xyZXR1cm58c2V0fHN0YXRpY3xzdXBlcnxzd2l0Y2h8dGhpc3x0aHJvd3x0cnl8dHlwZW9mfHZhcnx2b2lkfHdoaWxlfHdpdGh8eWllbGQpXFxiLyxcblx0J251bWJlcic6IC9cXGItPygweFtcXGRBLUZhLWZdK3wwYlswMV0rfDBvWzAtN10rfFxcZCpcXC4/XFxkKyhbRWVdWystXT9cXGQrKT98TmFOfEluZmluaXR5KVxcYi8sXG5cdC8vIEFsbG93IGZvciBhbGwgbm9uLUFTQ0lJIGNoYXJhY3RlcnMgKFNlZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMDA4NDQ0KVxuXHQnZnVuY3Rpb24nOiAvW18kYS16QS1aXFx4QTAtXFx1RkZGRl1bXyRhLXpBLVowLTlcXHhBMC1cXHVGRkZGXSooPz1cXCgpL2ksXG5cdCdvcGVyYXRvcic6IC8tWy09XT98XFwrWys9XT98IT0/PT98PDw/PT98Pj4/Pj89P3w9KD86PT0/fD4pP3wmWyY9XT98XFx8W3w9XT98XFwqXFwqPz0/fFxcLz0/fH58XFxePT98JT0/fFxcP3xcXC57M30vXG59KTtcblxuUHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnamF2YXNjcmlwdCcsICdrZXl3b3JkJywge1xuXHQncmVnZXgnOiB7XG5cdFx0cGF0dGVybjogLyhefFteL10pXFwvKD8hXFwvKShcXFsuKz9dfFxcXFwufFteL1xcXFxcXHJcXG5dKStcXC9bZ2lteXVdezAsNX0oPz1cXHMqKCR8W1xcclxcbiwuO30pXSkpLyxcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9XG59KTtcblxuUHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnamF2YXNjcmlwdCcsICdzdHJpbmcnLCB7XG5cdCd0ZW1wbGF0ZS1zdHJpbmcnOiB7XG5cdFx0cGF0dGVybjogL2AoPzpcXFxcXFxcXHxcXFxcP1teXFxcXF0pKj9gLyxcblx0XHRncmVlZHk6IHRydWUsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQnaW50ZXJwb2xhdGlvbic6IHtcblx0XHRcdFx0cGF0dGVybjogL1xcJFxce1tefV0rXFx9Lyxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J2ludGVycG9sYXRpb24tcHVuY3R1YXRpb24nOiB7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxcJFxce3xcXH0kLyxcblx0XHRcdFx0XHRcdGFsaWFzOiAncHVuY3R1YXRpb24nXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRyZXN0OiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3N0cmluZyc6IC9bXFxzXFxTXSsvXG5cdFx0fVxuXHR9XG59KTtcblxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcblx0XHQnc2NyaXB0Jzoge1xuXHRcdFx0cGF0dGVybjogLyg8c2NyaXB0W1xcc1xcU10qPz4pW1xcc1xcU10qPyg/PTxcXC9zY3JpcHQ+KS9pLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQsXG5cdFx0XHRhbGlhczogJ2xhbmd1YWdlLWphdmFzY3JpcHQnXG5cdFx0fVxuXHR9KTtcbn1cblxuUHJpc20ubGFuZ3VhZ2VzLmpzID0gUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQ7XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tZmlsZS1oaWdobGlnaHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuKGZ1bmN0aW9uICgpIHtcblx0aWYgKHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyB8fCAhc2VsZi5QcmlzbSB8fCAhc2VsZi5kb2N1bWVudCB8fCAhZG9jdW1lbnQucXVlcnlTZWxlY3Rvcikge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHNlbGYuUHJpc20uZmlsZUhpZ2hsaWdodCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIEV4dGVuc2lvbnMgPSB7XG5cdFx0XHQnanMnOiAnamF2YXNjcmlwdCcsXG5cdFx0XHQncHknOiAncHl0aG9uJyxcblx0XHRcdCdyYic6ICdydWJ5Jyxcblx0XHRcdCdwczEnOiAncG93ZXJzaGVsbCcsXG5cdFx0XHQncHNtMSc6ICdwb3dlcnNoZWxsJyxcblx0XHRcdCdzaCc6ICdiYXNoJyxcblx0XHRcdCdiYXQnOiAnYmF0Y2gnLFxuXHRcdFx0J2gnOiAnYycsXG5cdFx0XHQndGV4JzogJ2xhdGV4J1xuXHRcdH07XG5cblx0XHRpZihBcnJheS5wcm90b3R5cGUuZm9yRWFjaCkgeyAvLyBDaGVjayB0byBwcmV2ZW50IGVycm9yIGluIElFOFxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgncHJlW2RhdGEtc3JjXScpKS5mb3JFYWNoKGZ1bmN0aW9uIChwcmUpIHtcblx0XHRcdFx0dmFyIHNyYyA9IHByZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJyk7XG5cblx0XHRcdFx0dmFyIGxhbmd1YWdlLCBwYXJlbnQgPSBwcmU7XG5cdFx0XHRcdHZhciBsYW5nID0gL1xcYmxhbmcoPzp1YWdlKT8tKD8hXFwqKShcXHcrKVxcYi9pO1xuXHRcdFx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcblx0XHRcdFx0XHRwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdFx0XHRsYW5ndWFnZSA9IChwcmUuY2xhc3NOYW1lLm1hdGNoKGxhbmcpIHx8IFssICcnXSlbMV07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWxhbmd1YWdlKSB7XG5cdFx0XHRcdFx0dmFyIGV4dGVuc2lvbiA9IChzcmMubWF0Y2goL1xcLihcXHcrKSQvKSB8fCBbLCAnJ10pWzFdO1xuXHRcdFx0XHRcdGxhbmd1YWdlID0gRXh0ZW5zaW9uc1tleHRlbnNpb25dIHx8IGV4dGVuc2lvbjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciBjb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY29kZScpO1xuXHRcdFx0XHRjb2RlLmNsYXNzTmFtZSA9ICdsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cblx0XHRcdFx0cHJlLnRleHRDb250ZW50ID0gJyc7XG5cblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICdMb2FkaW5n4oCmJztcblxuXHRcdFx0XHRwcmUuYXBwZW5kQ2hpbGQoY29kZSk7XG5cblx0XHRcdFx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG5cdFx0XHRcdHhoci5vcGVuKCdHRVQnLCBzcmMsIHRydWUpO1xuXG5cdFx0XHRcdHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlID09IDQpIHtcblxuXHRcdFx0XHRcdFx0aWYgKHhoci5zdGF0dXMgPCA0MDAgJiYgeGhyLnJlc3BvbnNlVGV4dCkge1xuXHRcdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0geGhyLnJlc3BvbnNlVGV4dDtcblxuXHRcdFx0XHRcdFx0XHRQcmlzbS5oaWdobGlnaHRFbGVtZW50KGNvZGUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoeGhyLnN0YXR1cyA+PSA0MDApIHtcblx0XHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3IgJyArIHhoci5zdGF0dXMgKyAnIHdoaWxlIGZldGNoaW5nIGZpbGU6ICcgKyB4aHIuc3RhdHVzVGV4dDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ+KcliBFcnJvcjogRmlsZSBkb2VzIG5vdCBleGlzdCBvciBpcyBlbXB0eSc7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdHhoci5zZW5kKG51bGwpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdH07XG5cblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIHNlbGYuUHJpc20uZmlsZUhpZ2hsaWdodCk7XG5cbn0pKCk7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgYmFja2Ryb3BzO1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlQmFja2Ryb3BGb3JTbGlkZShzbGlkZSkge1xuICAgICAgdmFyIGJhY2tkcm9wQXR0cmlidXRlID0gc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtYmFja2Ryb3AnKTtcblxuICAgICAgaWYgKGJhY2tkcm9wQXR0cmlidXRlKSB7XG4gICAgICAgIHZhciBiYWNrZHJvcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBiYWNrZHJvcC5jbGFzc05hbWUgPSBiYWNrZHJvcEF0dHJpYnV0ZTtcbiAgICAgICAgYmFja2Ryb3AuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1iYWNrZHJvcCcpO1xuICAgICAgICBkZWNrLnBhcmVudC5hcHBlbmRDaGlsZChiYWNrZHJvcCk7XG4gICAgICAgIHJldHVybiBiYWNrZHJvcDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVDbGFzc2VzKGVsKSB7XG4gICAgICBpZiAoZWwpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gYmFja2Ryb3BzLmluZGV4T2YoZWwpLFxuICAgICAgICAgIGN1cnJlbnRJbmRleCA9IGRlY2suc2xpZGUoKTtcblxuICAgICAgICByZW1vdmVDbGFzcyhlbCwgJ2FjdGl2ZScpO1xuICAgICAgICByZW1vdmVDbGFzcyhlbCwgJ2luYWN0aXZlJyk7XG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYmVmb3JlJyk7XG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYWZ0ZXInKTtcblxuICAgICAgICBpZiAoaW5kZXggIT09IGN1cnJlbnRJbmRleCkge1xuICAgICAgICAgIGFkZENsYXNzKGVsLCAnaW5hY3RpdmUnKTtcbiAgICAgICAgICBhZGRDbGFzcyhlbCwgaW5kZXggPCBjdXJyZW50SW5kZXggPyAnYmVmb3JlJyA6ICdhZnRlcicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFkZENsYXNzKGVsLCAnYWN0aXZlJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZW1vdmVDbGFzcyhlbCwgY2xhc3NOYW1lKSB7XG4gICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJhY2tkcm9wLScgKyBjbGFzc05hbWUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZENsYXNzKGVsLCBjbGFzc05hbWUpIHtcbiAgICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYmFja2Ryb3AtJyArIGNsYXNzTmFtZSk7XG4gICAgfVxuXG4gICAgYmFja2Ryb3BzID0gZGVjay5zbGlkZXNcbiAgICAgIC5tYXAoY3JlYXRlQmFja2Ryb3BGb3JTbGlkZSk7XG5cbiAgICBkZWNrLm9uKCdhY3RpdmF0ZScsIGZ1bmN0aW9uKCkge1xuICAgICAgYmFja2Ryb3BzLmZvckVhY2godXBkYXRlQ2xhc3Nlcyk7XG4gICAgfSk7XG4gIH07XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XG4gICAgdmFyIGFjdGl2ZVNsaWRlSW5kZXgsXG4gICAgICBhY3RpdmVCdWxsZXRJbmRleCxcblxuICAgICAgYnVsbGV0cyA9IGRlY2suc2xpZGVzLm1hcChmdW5jdGlvbihzbGlkZSkge1xuICAgICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChzbGlkZS5xdWVyeVNlbGVjdG9yQWxsKCh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogJ1tkYXRhLWJlc3Bva2UtYnVsbGV0XScpKSwgMCk7XG4gICAgICB9KSxcblxuICAgICAgbmV4dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmV4dFNsaWRlSW5kZXggPSBhY3RpdmVTbGlkZUluZGV4ICsgMTtcblxuICAgICAgICBpZiAoYWN0aXZlU2xpZGVIYXNCdWxsZXRCeU9mZnNldCgxKSkge1xuICAgICAgICAgIGFjdGl2YXRlQnVsbGV0KGFjdGl2ZVNsaWRlSW5kZXgsIGFjdGl2ZUJ1bGxldEluZGV4ICsgMSk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGVsc2UgaWYgKGJ1bGxldHNbbmV4dFNsaWRlSW5kZXhdKSB7XG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQobmV4dFNsaWRlSW5kZXgsIDApO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICBwcmV2ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBwcmV2U2xpZGVJbmRleCA9IGFjdGl2ZVNsaWRlSW5kZXggLSAxO1xuXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KC0xKSkge1xuICAgICAgICAgIGFjdGl2YXRlQnVsbGV0KGFjdGl2ZVNsaWRlSW5kZXgsIGFjdGl2ZUJ1bGxldEluZGV4IC0gMSk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGVsc2UgaWYgKGJ1bGxldHNbcHJldlNsaWRlSW5kZXhdKSB7XG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQocHJldlNsaWRlSW5kZXgsIGJ1bGxldHNbcHJldlNsaWRlSW5kZXhdLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICBhY3RpdmF0ZUJ1bGxldCA9IGZ1bmN0aW9uKHNsaWRlSW5kZXgsIGJ1bGxldEluZGV4KSB7XG4gICAgICAgIGFjdGl2ZVNsaWRlSW5kZXggPSBzbGlkZUluZGV4O1xuICAgICAgICBhY3RpdmVCdWxsZXRJbmRleCA9IGJ1bGxldEluZGV4O1xuXG4gICAgICAgIGJ1bGxldHMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSwgcykge1xuICAgICAgICAgIHNsaWRlLmZvckVhY2goZnVuY3Rpb24oYnVsbGV0LCBiKSB7XG4gICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQnKTtcblxuICAgICAgICAgICAgaWYgKHMgPCBzbGlkZUluZGV4IHx8IHMgPT09IHNsaWRlSW5kZXggJiYgYiA8PSBidWxsZXRJbmRleCkge1xuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtYWN0aXZlJyk7XG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0LWluYWN0aXZlJyk7XG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1hY3RpdmUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHMgPT09IHNsaWRlSW5kZXggJiYgYiA9PT0gYnVsbGV0SW5kZXgpIHtcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0LWN1cnJlbnQnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1jdXJyZW50Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcblxuICAgICAgYWN0aXZlU2xpZGVIYXNCdWxsZXRCeU9mZnNldCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgICAgICByZXR1cm4gYnVsbGV0c1thY3RpdmVTbGlkZUluZGV4XVthY3RpdmVCdWxsZXRJbmRleCArIG9mZnNldF0gIT09IHVuZGVmaW5lZDtcbiAgICAgIH07XG5cbiAgICBkZWNrLm9uKCduZXh0JywgbmV4dCk7XG4gICAgZGVjay5vbigncHJldicsIHByZXYpO1xuXG4gICAgZGVjay5vbignc2xpZGUnLCBmdW5jdGlvbihlKSB7XG4gICAgICBhY3RpdmF0ZUJ1bGxldChlLmluZGV4LCAwKTtcbiAgICB9KTtcblxuICAgIGFjdGl2YXRlQnVsbGV0KDAsIDApO1xuICB9O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XG4gICAgZGVjay5zbGlkZXMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSkge1xuICAgICAgc2xpZGUuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKC9JTlBVVHxURVhUQVJFQXxTRUxFQ1QvLnRlc3QoZS50YXJnZXQubm9kZU5hbWUpIHx8IGUudGFyZ2V0LmNvbnRlbnRFZGl0YWJsZSA9PT0gJ3RydWUnKSB7XG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24gKGRlY2spIHtcbiAgICB2YXIgb3B0aW9ucyA9IG9wdGlvbnMgPT09IHVuZGVmaW5lZCA/IHt9IDogb3B0aW9ucztcblxuICAgIHZhciBkaXJlY3Rpb24gPSBvcHRpb25zLmRpcmVjdGlvbiA9PT0gdW5kZWZpbmVkIHx8IG9wdGlvbnMuZGlyZWN0aW9uID09PSBudWxsID8gJ2hvcml6b250YWwnIDogb3B0aW9ucy5kaXJlY3Rpb247XG4gICAgdmFyIGRlZmF1bHRfYXhpcyA9IGRpcmVjdGlvbiA9PT0gJ3ZlcnRpY2FsJyA/ICdZJyA6ICdYJztcbiAgICB2YXIgdHJhbnNpdGlvbiA9IG9wdGlvbnMudHJhbnNpdGlvbiA/IG9wdGlvbnMudHJhbnNpdGlvbiA6ICdtb3ZlJztcbiAgICB2YXIgcmV2ZXJzZSA9IG9wdGlvbnMucmV2ZXJzZSA/IG9wdGlvbnMucmV2ZXJzZSA6IGZhbHNlO1xuICAgIHZhciBwbHVnaW4gPSB7XG4gICAgICBmeDoge1xuICAgICAgICAnbW92ZSc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ21vdmUtdG8tbGVmdC1mcm9tLXJpZ2h0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ21vdmUtdG8tcmlnaHQtZnJvbS1sZWZ0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdtb3ZlLXRvLXRvcC1mcm9tLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdtb3ZlLXRvLWJvdHRvbS1mcm9tLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLWZhZGUnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdmYWRlLWZyb20tcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZmFkZS1mcm9tLWxlZnQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2ZhZGUtZnJvbS1ib3R0b20nLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZmFkZS1mcm9tLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLWJvdGgtZmFkZSc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2ZhZGUtbGVmdC1mYWRlLXJpZ2h0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ2ZhZGUtcmlnaHQtZmFkZS1sZWZ0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdmYWRlLXRvcC1mYWRlLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdmYWRlLWJvdHRvbS1mYWRlLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLWRpZmZlcmVudC1lYXNpbmcnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZGlmZmVyZW50LWVhc2luZy1mcm9tLWxlZnQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1ib3R0b20nLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZGlmZmVyZW50LWVhc2luZy1mcm9tLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdzY2FsZS1kb3duLW91dC1tb3ZlLWluJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnc2NhbGUtZG93bi1mcm9tLXJpZ2h0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ21vdmUtdG8tcmlnaHQtc2NhbGUtdXAnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3NjYWxlLWRvd24tZnJvbS1ib3R0b20nLFxuICAgICAgICAgICAgJ3ByZXYnOiAnbW92ZS10by1ib3R0b20tc2NhbGUtdXAnXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnbW92ZS1vdXQtc2NhbGUtdXAnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdtb3ZlLXRvLWxlZnQtc2NhbGUtdXAnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnc2NhbGUtZG93bi1mcm9tLWxlZnQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ21vdmUtdG8tdG9wLXNjYWxlLXVwJyxcbiAgICAgICAgICAgICdwcmV2JzogJ3NjYWxlLWRvd24tZnJvbS10b3AnXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnc2NhbGUtdXAtdXAnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdzY2FsZS11cC1zY2FsZS11cCcsXG4gICAgICAgICAgICAncHJldic6ICdzY2FsZS1kb3duLXNjYWxlLWRvd24nXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3NjYWxlLXVwLXNjYWxlLXVwJyxcbiAgICAgICAgICAgICdwcmV2JzogJ3NjYWxlLWRvd24tc2NhbGUtZG93bidcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdzY2FsZS1kb3duLXVwJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnc2NhbGUtZG93bi1zY2FsZS11cCcsXG4gICAgICAgICAgICAncHJldic6ICdzY2FsZS1kb3duLXNjYWxlLXVwJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdzY2FsZS1kb3duLXNjYWxlLXVwJyxcbiAgICAgICAgICAgICdwcmV2JzogJ3NjYWxlLWRvd24tc2NhbGUtdXAnXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnZ2x1ZSc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2dsdWUtbGVmdC1mcm9tLXJpZ2h0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ2dsdWUtcmlnaHQtZnJvbS1sZWZ0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdnbHVlLXRvcC1mcm9tLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdnbHVlLWJvdHRvbS1mcm9tLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdmbGlwJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZmxpcC1sZWZ0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ2ZsaXAtcmlnaHQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2ZsaXAtdG9wJyxcbiAgICAgICAgICAgICdwcmV2JzogJ2ZsaXAtYm90dG9tJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ2ZhbGwnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdmYWxsJyxcbiAgICAgICAgICAgICdwcmV2JzogJ2ZhbGwnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2ZhbGwnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnZmFsbCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICduZXdzcGFwZXInOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICduZXdzcGFwZXInLFxuICAgICAgICAgICAgJ3ByZXYnOiAnbmV3c3BhcGVyJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICduZXdzcGFwZXInLFxuICAgICAgICAgICAgJ3ByZXYnOiAnbmV3c3BhcGVyJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ3B1c2gnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdwdXNoLWxlZnQtZnJvbS1yaWdodCcsXG4gICAgICAgICAgICAncHJldic6ICdwdXNoLXJpZ2h0LWZyb20tbGVmdCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAncHVzaC10b3AtZnJvbS1ib3R0b20nLFxuICAgICAgICAgICAgJ3ByZXYnOiAncHVzaC1ib3R0b20tZnJvbS10b3AnXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAncHVsbCc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ3B1c2gtbGVmdC1wdWxsLXJpZ2h0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ3B1c2gtcmlnaHQtcHVsbC1sZWZ0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdwdXNoLWJvdHRvbS1wdWxsLXRvcCcsXG4gICAgICAgICAgICAncHJldic6ICdwdXNoLXRvcC1wdWxsLWJvdHRvbSdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdmb2xkJzoge1xuICAgICAgICAgICdYJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZm9sZC1sZWZ0LWZyb20tcmlnaHQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnbW92ZS10by1yaWdodC11bmZvbGQtbGVmdCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnZm9sZC1ib3R0b20tZnJvbS10b3AnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnbW92ZS10by10b3AtdW5mb2xkLWJvdHRvbSdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICd1bmZvbGQnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdtb3ZlLXRvLWxlZnQtdW5mb2xkLXJpZ2h0JyxcbiAgICAgICAgICAgICdwcmV2JzogJ2ZvbGQtcmlnaHQtZnJvbS1sZWZ0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdtb3ZlLXRvLWJvdHRvbS11bmZvbGQtdG9wJyxcbiAgICAgICAgICAgICdwcmV2JzogJ2ZvbGQtdG9wLWZyb20tYm90dG9tJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ3Jvb20nOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdyb29tLXRvLWxlZnQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAncm9vbS10by1yaWdodCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAncm9vbS10by1ib3R0b20nLFxuICAgICAgICAgICAgJ3ByZXYnOiAncm9vbS10by10b3AnXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnY3ViZSc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2N1YmUtdG8tbGVmdCcsXG4gICAgICAgICAgICAncHJldic6ICdjdWJlLXRvLXJpZ2h0J1xuICAgICAgICAgIH0sXG4gICAgICAgICAgJ1knOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdjdWJlLXRvLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdjdWJlLXRvLXRvcCdcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdjYXJvdXNlbCc6IHtcbiAgICAgICAgICAnWCc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2Nhcm91c2VsLXRvLWxlZnQnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnY2Fyb3VzZWwtdG8tcmlnaHQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnWSc6IHtcbiAgICAgICAgICAgICduZXh0JzogJ2Nhcm91c2VsLXRvLWJvdHRvbScsXG4gICAgICAgICAgICAncHJldic6ICdjYXJvdXNlbC10by10b3AnXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnc2lkZXMnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdzaWRlcycsXG4gICAgICAgICAgICAncHJldic6ICdzaWRlcydcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnc2lkZXMnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnc2lkZXMnXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnc2xpZGUnOiB7XG4gICAgICAgICAgJ1gnOiB7XG4gICAgICAgICAgICAnbmV4dCc6ICdzbGlkZScsXG4gICAgICAgICAgICAncHJldic6ICdzbGlkZSdcbiAgICAgICAgICB9LFxuICAgICAgICAgICdZJzoge1xuICAgICAgICAgICAgJ25leHQnOiAnc2xpZGUnLFxuICAgICAgICAgICAgJ3ByZXYnOiAnc2xpZGUnXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYW5pbWF0aW9uczoge1xuICAgICAgICAvLyBNb3ZlXG4gICAgICAgICdtb3ZlLXRvLWxlZnQtZnJvbS1yaWdodCc6IHtcbiAgICAgICAgICBpZDogMSxcbiAgICAgICAgICBncm91cDogJ21vdmUnLFxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byBsZWZ0IC8gZnJvbSByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9MZWZ0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21SaWdodCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tcmlnaHQtZnJvbS1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by1yaWdodC1mcm9tLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDIsXG4gICAgICAgICAgZ3JvdXA6ICdtb3ZlJyxcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gcmlnaHQgLyBmcm9tIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvUmlnaHQnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUxlZnQnLFxuICAgICAgICAgIHJldmVyc2U6ICdtb3ZlLXRvLWxlZnQtZnJvbS1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtdG8tdG9wLWZyb20tYm90dG9tJzoge1xuICAgICAgICAgIGlkOiAzLFxuICAgICAgICAgIGdyb3VwOiAnbW92ZScsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIHRvcCAvIGZyb20gYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1RvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tQm90dG9tJyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1ib3R0b20tZnJvbS10b3AnXG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLXRvLWJvdHRvbS1mcm9tLXRvcCc6IHtcbiAgICAgICAgICBpZDogNCxcbiAgICAgICAgICBncm91cDogJ21vdmUnLFxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byBib3R0b20gLyBmcm9tIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Cb3R0b20nLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tdG9wLWZyb20tYm90dG9tJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIEZhZGVcbiAgICAgICAgJ2ZhZGUtZnJvbS1yaWdodCc6IHtcbiAgICAgICAgICBpZDogNSxcbiAgICAgICAgICBncm91cDogJ2ZhZGUnLFxuICAgICAgICAgIGxhYmVsOiAnRmFkZSAvIGZyb20gcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtZmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tUmlnaHQgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWZyb20tbGVmdCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZhZGUtZnJvbS1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiA2LFxuICAgICAgICAgIGdyb3VwOiAnZmFkZScsXG4gICAgICAgICAgbGFiZWw6ICdGYWRlIC8gZnJvbSBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZhZGUnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUxlZnQgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWZyb20tcmlnaHQnXG4gICAgICAgIH0sXG4gICAgICAgICdmYWRlLWZyb20tYm90dG9tJzoge1xuICAgICAgICAgIGlkOiA3LFxuICAgICAgICAgIGdyb3VwOiAnZmFkZScsXG4gICAgICAgICAgbGFiZWw6ICdGYWRlIC8gZnJvbSBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtZmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tQm90dG9tIGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICByZXZlcnNlOiAnZmFkZS1mcm9tLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZhZGUtZnJvbS10b3AnOiB7XG4gICAgICAgICAgaWQ6IDgsXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgLyBmcm9tIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1mYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Ub3AgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWZyb20tYm90dG9tJ1xuICAgICAgICB9LFxuICAgICAgICAnZmFkZS1sZWZ0LWZhZGUtcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDksXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgbGVmdCAvIEZhZGUgcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvTGVmdEZhZGUnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0RmFkZScsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhZGUtcmlnaHQtZmFkZS1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAnZmFkZS1yaWdodC1mYWRlLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDEwLFxuICAgICAgICAgIGdyb3VwOiAnZmFkZScsXG4gICAgICAgICAgbGFiZWw6ICdGYWRlIHJpZ2h0IC8gRmFkZSBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1JpZ2h0RmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdEZhZGUnLFxuICAgICAgICAgIHJldmVyc2U6ICdmYWRlLWxlZnQtZmFkZS1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZhZGUtdG9wLWZhZGUtYm90dG9tJzoge1xuICAgICAgICAgIGlkOiAxMSxcbiAgICAgICAgICBncm91cDogJ2ZhZGUnLFxuICAgICAgICAgIGxhYmVsOiAnRmFkZSB0b3AgLyBGYWRlIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Ub3BGYWRlJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b21GYWRlJyxcbiAgICAgICAgICByZXZlcnNlOiAnZmFkZS1ib3R0b20tZmFkZS10b3AnXG4gICAgICAgIH0sXG4gICAgICAgICdmYWRlLWJvdHRvbS1mYWRlLXRvcCc6IHtcbiAgICAgICAgICBpZDogMTIsXG4gICAgICAgICAgZ3JvdXA6ICdmYWRlJyxcbiAgICAgICAgICBsYWJlbDogJ0ZhZGUgYm90dG9tIC8gRmFkZSB0b3AnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvQm90dG9tRmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tVG9wRmFkZScsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZhZGUtdG9wLWZhZGUtYm90dG9tJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIERpZmZlcmVudCBlYXNpbmdcbiAgICAgICAgJ2RpZmZlcmVudC1lYXNpbmctZnJvbS1yaWdodCc6IHtcbiAgICAgICAgICBpZDogMTMsXG4gICAgICAgICAgZ3JvdXA6ICdkaWZmZXJlbnQtZWFzaW5nJyxcbiAgICAgICAgICBsYWJlbDogJ0RpZmZlcmVudCBlYXNpbmcgLyBmcm9tIHJpZ2h0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb0xlZnRFYXNpbmcgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0JyxcbiAgICAgICAgICByZXZlcnNlOiAnZGlmZmVyZW50LWVhc2luZy1mcm9tLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tbGVmdCc6IHtcbiAgICAgICAgICBpZDogMTQsXG4gICAgICAgICAgZ3JvdXA6ICdkaWZmZXJlbnQtZWFzaW5nJyxcbiAgICAgICAgICBsYWJlbDogJ0RpZmZlcmVudCBlYXNpbmcgLyBmcm9tIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvUmlnaHRFYXNpbmcgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUxlZnQnLFxuICAgICAgICAgIHJldmVyc2U6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tcmlnaHQnXG4gICAgICAgIH0sXG4gICAgICAgICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tYm90dG9tJzoge1xuICAgICAgICAgIGlkOiAxNSxcbiAgICAgICAgICBncm91cDogJ2RpZmZlcmVudC1lYXNpbmcnLFxuICAgICAgICAgIGxhYmVsOiAnRGlmZmVyZW50IGVhc2luZyAvIGZyb20gYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1RvcEVhc2luZyBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tQm90dG9tJyxcbiAgICAgICAgICByZXZlcnNlOiAnZGlmZmVyZW50LWVhc2luZy1mcm9tLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2RpZmZlcmVudC1lYXNpbmctZnJvbS10b3AnOiB7XG4gICAgICAgICAgaWQ6IDE2LFxuICAgICAgICAgIGdyb3VwOiAnZGlmZmVyZW50LWVhc2luZycsXG4gICAgICAgICAgbGFiZWw6ICdEaWZmZXJlbnQgZWFzaW5nIC8gZnJvbSB0b3AnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvQm90dG9tRWFzaW5nIGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Ub3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdkaWZmZXJlbnQtZWFzaW5nLWZyb20tYm90dG9tJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFNjYWxlXG4gICAgICAgICdzY2FsZS1kb3duLWZyb20tcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDE3LFxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxuICAgICAgICAgIGxhYmVsOiAnU2NhbGUgZG93biAvIGZyb20gcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtc2NhbGVEb3duJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21SaWdodCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tcmlnaHQtc2NhbGUtdXAnXG4gICAgICAgIH0sXG4gICAgICAgICdzY2FsZS1kb3duLWZyb20tbGVmdCc6IHtcbiAgICAgICAgICBpZDogMTgsXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXG4gICAgICAgICAgbGFiZWw6ICdTY2FsZSBkb3duIC8gZnJvbSBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93bicsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tTGVmdCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tbGVmdC1zY2FsZS11cCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3NjYWxlLWRvd24tZnJvbS1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDE5LFxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxuICAgICAgICAgIGxhYmVsOiAnU2NhbGUgZG93biAvIGZyb20gYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93bicsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tQm90dG9tIGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1ib3R0b20tc2NhbGUtdXAnXG4gICAgICAgIH0sXG4gICAgICAgICdzY2FsZS1kb3duLWZyb20tdG9wJzoge1xuICAgICAgICAgIGlkOiAyMCxcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcbiAgICAgICAgICBsYWJlbDogJ1NjYWxlIGRvd24gLyBmcm9tIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1zY2FsZURvd24nLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tdG9wLXNjYWxlLXVwJ1xuICAgICAgICB9LFxuICAgICAgICAnc2NhbGUtZG93bi1zY2FsZS1kb3duJzoge1xuICAgICAgICAgIGlkOiAyMSxcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcbiAgICAgICAgICBsYWJlbDogJ1NjYWxlIGRvd24gLyBzY2FsZSBkb3duJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93bicsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXNjYWxlVXBEb3duIGZ4LXNsaWRlLWRlbGF5MzAwJyxcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtdXAtc2NhbGUtdXAnXG4gICAgICAgIH0sXG4gICAgICAgICdzY2FsZS11cC1zY2FsZS11cCc6IHtcbiAgICAgICAgICBpZDogMjIsXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXG4gICAgICAgICAgbGFiZWw6ICdTY2FsZSB1cCAvIHNjYWxlIHVwJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXNjYWxlRG93blVwJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcCBmeC1zbGlkZS1kZWxheTMwMCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3NjYWxlLWRvd24tc2NhbGUtZG93bidcbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtdG8tbGVmdC1zY2FsZS11cCc6IHtcbiAgICAgICAgICBpZDogMjMsXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIGxlZnQgLyBzY2FsZSB1cCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9MZWZ0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3NjYWxlLWRvd24tZnJvbS1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by1yaWdodC1zY2FsZS11cCc6IHtcbiAgICAgICAgICBpZDogMjQsXG4gICAgICAgICAgZ3JvdXA6ICdzY2FsZScsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIHJpZ2h0IC8gc2NhbGUgdXAnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvUmlnaHQgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1zY2FsZVVwJyxcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1mcm9tLXJpZ2h0J1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by10b3Atc2NhbGUtdXAnOiB7XG4gICAgICAgICAgaWQ6IDI1LFxuICAgICAgICAgIGdyb3VwOiAnc2NhbGUnLFxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byB0b3AgLyBzY2FsZSB1cCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9Ub3AgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1zY2FsZVVwJyxcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1mcm9tLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtdG8tYm90dG9tLXNjYWxlLXVwJzoge1xuICAgICAgICAgIGlkOiAyNixcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gYm90dG9tIC8gc2NhbGUgdXAnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvQm90dG9tIGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtc2NhbGVVcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3NjYWxlLWRvd24tZnJvbS1ib3R0b20nXG4gICAgICAgIH0sXG4gICAgICAgICdzY2FsZS1kb3duLXNjYWxlLXVwJzoge1xuICAgICAgICAgIGlkOiAyNyxcbiAgICAgICAgICBncm91cDogJ3NjYWxlJyxcbiAgICAgICAgICBsYWJlbDogJ1NjYWxlIGRvd24gLyBzY2FsZSB1cCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1zY2FsZURvd25DZW50ZXInLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1zY2FsZVVwQ2VudGVyIGZ4LXNsaWRlLWRlbGF5NDAwJyxcbiAgICAgICAgICByZXZlcnNlOiAnc2NhbGUtZG93bi1zY2FsZS11cCdcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBSb3RhdGU6IEdsdWVcbiAgICAgICAgJ2dsdWUtbGVmdC1mcm9tLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiAyOCxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpnbHVlJyxcbiAgICAgICAgICBsYWJlbDogJ0dsdWUgbGVmdCAvIGZyb20gcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlUmlnaHRTaWRlRmlyc3QnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVJpZ2h0IGZ4LXNsaWRlLWRlbGF5MjAwIGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICByZXZlcnNlOiAnZ2x1ZS1yaWdodC1mcm9tLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdnbHVlLXJpZ2h0LWZyb20tbGVmdCc6IHtcbiAgICAgICAgICBpZDogMjksXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Z2x1ZScsXG4gICAgICAgICAgbGFiZWw6ICdHbHVlIHJpZ2h0IC8gZnJvbSBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUxlZnRTaWRlRmlyc3QnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUxlZnQgZngtc2xpZGUtZGVsYXkyMDAgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdnbHVlLWxlZnQtZnJvbS1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2dsdWUtYm90dG9tLWZyb20tdG9wJzoge1xuICAgICAgICAgIGlkOiAzMCxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpnbHVlJyxcbiAgICAgICAgICBsYWJlbDogJ0dsdWUgYm90dG9tIC8gZnJvbSB0b3AnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlVG9wU2lkZUZpcnN0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Ub3AgZngtc2xpZGUtZGVsYXkyMDAgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdnbHVlLXRvcC1mcm9tLWJvdHRvbSdcbiAgICAgICAgfSxcbiAgICAgICAgJ2dsdWUtdG9wLWZyb20tYm90dG9tJzoge1xuICAgICAgICAgIGlkOiAzMSxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpnbHVlJyxcbiAgICAgICAgICBsYWJlbDogJ0dsdWUgdG9wIC8gZnJvbSBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlQm90dG9tU2lkZUZpcnN0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b20gZngtc2xpZGUtZGVsYXkyMDAgZngtc2xpZGUtb250b3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdnbHVlLWJvdHRvbS1mcm9tLXRvcCdcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBSb3RhdGU6IEZsaXBcbiAgICAgICAgJ2ZsaXAtcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDMyLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZsaXAnLFxuICAgICAgICAgIGxhYmVsOiAnRmxpcCByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1mbGlwT3V0UmlnaHQnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1mbGlwSW5MZWZ0IGZ4LXNsaWRlLWRlbGF5NTAwJyxcbiAgICAgICAgICByZXZlcnNlOiAnZmxpcC1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAnZmxpcC1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiAzMyxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmbGlwJyxcbiAgICAgICAgICBsYWJlbDogJ0ZsaXAgbGVmdCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1mbGlwT3V0TGVmdCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLWZsaXBJblJpZ2h0IGZ4LXNsaWRlLWRlbGF5NTAwJyxcbiAgICAgICAgICByZXZlcnNlOiAnZmxpcC1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZsaXAtdG9wJzoge1xuICAgICAgICAgIGlkOiAzNCxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmbGlwJyxcbiAgICAgICAgICBsYWJlbDogJ0ZsaXAgdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZsaXBPdXRUb3AnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1mbGlwSW5Cb3R0b20gZngtc2xpZGUtZGVsYXk1MDAnLFxuICAgICAgICAgIHJldmVyc2U6ICdmbGlwLWJvdHRvbSdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZsaXAtYm90dG9tJzoge1xuICAgICAgICAgIGlkOiAzNSxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmbGlwJyxcbiAgICAgICAgICBsYWJlbDogJ0ZsaXAgYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLWZsaXBPdXRCb3R0b20nLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1mbGlwSW5Ub3AgZngtc2xpZGUtZGVsYXk1MDAnLFxuICAgICAgICAgIHJldmVyc2U6ICdmbGlwLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZhbGwnOiB7XG4gICAgICAgICAgaWQ6IDM2LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlJyxcbiAgICAgICAgICBsYWJlbDogJ0ZhbGwnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlRmFsbCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXNjYWxlVXAnLFxuICAgICAgICAgIHJldmVyc2U6ICdmYWxsJ1xuICAgICAgICB9LFxuICAgICAgICAnbmV3c3BhcGVyJzoge1xuICAgICAgICAgIGlkOiAzNyxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZScsXG4gICAgICAgICAgbGFiZWw6ICdOZXdzcGFwZXInLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlT3V0TmV3c3BhcGVyJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlSW5OZXdzcGFwZXIgZngtc2xpZGUtZGVsYXk1MDAnLFxuICAgICAgICAgIHJldmVyc2U6ICduZXdzcGFwZXInXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gUHVzaCAvIFB1bGxcbiAgICAgICAgJ3B1c2gtbGVmdC1mcm9tLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiAzOCxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxuICAgICAgICAgIGxhYmVsOiAnUHVzaCBsZWZ0IC8gZnJvbSByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdXNoTGVmdCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLW1vdmVGcm9tUmlnaHQnLFxuICAgICAgICAgIHJldmVyc2U6ICdwdXNoLXJpZ2h0LWZyb20tbGVmdCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3B1c2gtcmlnaHQtZnJvbS1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiAzOSxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxuICAgICAgICAgIGxhYmVsOiAnUHVzaCByaWdodCAvIGZyb20gbGVmdCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdXNoUmlnaHQnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbUxlZnQnLFxuICAgICAgICAgIHJldmVyc2U6ICdwdXNoLWxlZnQtZnJvbS1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3B1c2gtdG9wLWZyb20tYm90dG9tJzoge1xuICAgICAgICAgIGlkOiA0MCxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxuICAgICAgICAgIGxhYmVsOiAnUHVzaCB0b3AgLyBmcm9tIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdXNoVG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b20nLFxuICAgICAgICAgIHJldmVyc2U6ICdwdXNoLWJvdHRvbS1mcm9tLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3B1c2gtYm90dG9tLWZyb20tdG9wJzoge1xuICAgICAgICAgIGlkOiA0MSxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxuICAgICAgICAgIGxhYmVsOiAnUHVzaCBib3R0b20gLyBmcm9tIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdXNoQm90dG9tJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Ub3AnLFxuICAgICAgICAgIHJldmVyc2U6ICdwdXNoLXRvcC1mcm9tLWJvdHRvbSdcbiAgICAgICAgfSxcbiAgICAgICAgJ3B1c2gtbGVmdC1wdWxsLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiA0MixcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxuICAgICAgICAgIGxhYmVsOiAnUHVzaCBsZWZ0IC8gcHVsbCByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdXNoTGVmdCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1bGxSaWdodCBmeC1zbGlkZS1kZWxheTE4MCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtcmlnaHQtcHVsbC1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAncHVzaC1yaWdodC1wdWxsLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDQzLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnB1c2gtcHVsbCcsXG4gICAgICAgICAgbGFiZWw6ICdQdXNoIHJpZ2h0IC8gcHVsbCBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1c2hSaWdodCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1bGxMZWZ0IGZ4LXNsaWRlLWRlbGF5MTgwJyxcbiAgICAgICAgICByZXZlcnNlOiAncHVzaC1sZWZ0LXB1bGwtcmlnaHQnXG4gICAgICAgIH0sXG4gICAgICAgICdwdXNoLXRvcC1wdWxsLWJvdHRvbSc6IHtcbiAgICAgICAgICBpZDogNDQsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cHVzaC1wdWxsJyxcbiAgICAgICAgICBsYWJlbDogJ1B1c2ggdG9wIC8gcHVsbCBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVzaFRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVB1bGxCb3R0b20gZngtc2xpZGUtZGVsYXkxODAnLFxuICAgICAgICAgIHJldmVyc2U6ICdwdXNoLWJvdHRvbS1wdWxsLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ3B1c2gtYm90dG9tLXB1bGwtdG9wJzoge1xuICAgICAgICAgIGlkOiA0NSxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpwdXNoLXB1bGwnLFxuICAgICAgICAgIGxhYmVsOiAnUHVzaCBib3R0b20gLyBwdWxsIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVQdXNoQm90dG9tJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUHVsbFRvcCBmeC1zbGlkZS1kZWxheTE4MCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ3B1c2gtdG9wLXB1bGwtYm90dG9tJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIEZvbGQgLyBVbmZvbGRcbiAgICAgICAgJ2ZvbGQtbGVmdC1mcm9tLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiA0NixcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXG4gICAgICAgICAgbGFiZWw6ICdGb2xkIGxlZnQgLyBmcm9tIHJpZ2h0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUZvbGRMZWZ0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21SaWdodEZhZGUnLFxuICAgICAgICAgIHJldmVyc2U6ICdtb3ZlLXRvLXJpZ2h0LXVuZm9sZC1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAnZm9sZC1yaWdodC1mcm9tLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDQ3LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZvbGQtdW5mb2xkJyxcbiAgICAgICAgICBsYWJlbDogJ0ZvbGQgcmlnaHQgLyBmcm9tIGxlZnQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlRm9sZFJpZ2h0JyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21MZWZ0RmFkZScsXG4gICAgICAgICAgcmV2ZXJzZTogJ21vdmUtdG8tbGVmdC11bmZvbGQtcmlnaHQnXG4gICAgICAgIH0sXG4gICAgICAgICdmb2xkLXRvcC1mcm9tLWJvdHRvbSc6IHtcbiAgICAgICAgICBpZDogNDgsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Zm9sZC11bmZvbGQnLFxuICAgICAgICAgIGxhYmVsOiAnRm9sZCB0b3AgLyBmcm9tIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVGb2xkVG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtbW92ZUZyb21Cb3R0b21GYWRlJyxcbiAgICAgICAgICByZXZlcnNlOiAnbW92ZS10by1ib3R0b20tdW5mb2xkLXRvcCdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ZvbGQtYm90dG9tLWZyb20tdG9wJzoge1xuICAgICAgICAgIGlkOiA0OSxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXG4gICAgICAgICAgbGFiZWw6ICdGb2xkIGJvdHRvbSAvIGZyb20gdG9wJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUZvbGRCb3R0b20nLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1tb3ZlRnJvbVRvcEZhZGUnLFxuICAgICAgICAgIHJldmVyc2U6ICdtb3ZlLXRvLXRvcC11bmZvbGQtYm90dG9tJ1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by1yaWdodC11bmZvbGQtbGVmdCc6IHtcbiAgICAgICAgICBpZDogNTAsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Zm9sZC11bmZvbGQnLFxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byByaWdodCAvIHVuZm9sZCBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1JpZ2h0RmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVVuZm9sZExlZnQnLFxuICAgICAgICAgIHJldmVyc2U6ICdmb2xkLWxlZnQtZnJvbS1yaWdodCdcbiAgICAgICAgfSxcbiAgICAgICAgJ21vdmUtdG8tbGVmdC11bmZvbGQtcmlnaHQnOiB7XG4gICAgICAgICAgaWQ6IDUxLFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmZvbGQtdW5mb2xkJyxcbiAgICAgICAgICBsYWJlbDogJ01vdmUgdG8gbGVmdCAvIHVuZm9sZCByaWdodCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1tb3ZlVG9MZWZ0RmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVVuZm9sZFJpZ2h0JyxcbiAgICAgICAgICByZXZlcnNlOiAnZm9sZC1yaWdodC1mcm9tLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdtb3ZlLXRvLWJvdHRvbS11bmZvbGQtdG9wJzoge1xuICAgICAgICAgIGlkOiA1MixcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpmb2xkLXVuZm9sZCcsXG4gICAgICAgICAgbGFiZWw6ICdNb3ZlIHRvIGJvdHRvbSAvIHVuZm9sZCB0b3AnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtbW92ZVRvQm90dG9tRmFkZScsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVVuZm9sZFRvcCcsXG4gICAgICAgICAgcmV2ZXJzZTogJ2ZvbGQtdG9wLWZyb20tYm90dG9tJ1xuICAgICAgICB9LFxuICAgICAgICAnbW92ZS10by10b3AtdW5mb2xkLWJvdHRvbSc6IHtcbiAgICAgICAgICBpZDogNTMsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Zm9sZC11bmZvbGQnLFxuICAgICAgICAgIGxhYmVsOiAnTW92ZSB0byB0b3AgLyB1bmZvbGQgYm90dG9tJyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLW1vdmVUb1RvcEZhZGUnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVVbmZvbGRCb3R0b20nLFxuICAgICAgICAgIHJldmVyc2U6ICdmb2xkLWJvdHRvbS1mcm9tLXRvcCdcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBSb29tXG4gICAgICAgICdyb29tLXRvLWxlZnQnOiB7XG4gICAgICAgICAgaWQ6IDU0LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOnJvb20nLFxuICAgICAgICAgIGxhYmVsOiAnUm9vbSB0byBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVJvb21MZWZ0T3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbUxlZnRJbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ3Jvb20tdG8tcmlnaHQnXG4gICAgICAgIH0sXG4gICAgICAgICdyb29tLXRvLXJpZ2h0Jzoge1xuICAgICAgICAgIGlkOiA1NSxcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpyb29tJyxcbiAgICAgICAgICBsYWJlbDogJ1Jvb20gdG8gcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbVJpZ2h0T3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbVJpZ2h0SW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdyb29tLXRvLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdyb29tLXRvLXRvcCc6IHtcbiAgICAgICAgICBpZDogNTYsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cm9vbScsXG4gICAgICAgICAgbGFiZWw6ICdSb29tIHRvIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tVG9wT3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbVRvcEluJyxcbiAgICAgICAgICByZXZlcnNlOiAncm9vbS10by1ib3R0b20nXG4gICAgICAgIH0sXG4gICAgICAgICdyb29tLXRvLWJvdHRvbSc6IHtcbiAgICAgICAgICBpZDogNTcsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6cm9vbScsXG4gICAgICAgICAgbGFiZWw6ICdSb29tIHRvIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVSb29tQm90dG9tT3V0IGZ4LXNsaWRlLW9udG9wJyxcbiAgICAgICAgICBpbkNsYXNzOiAnZngtc2xpZGUtcm90YXRlUm9vbUJvdHRvbUluJyxcbiAgICAgICAgICByZXZlcnNlOiAncm9vbS10by10b3AnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gQ3ViZVxuICAgICAgICAnY3ViZS10by1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiA1OCxcbiAgICAgICAgICBsYWJlbDogJ0N1YmUgdG8gbGVmdCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDdWJlTGVmdE91dCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVMZWZ0SW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdjdWJlLXRvLXJpZ2h0J1xuICAgICAgICB9LFxuICAgICAgICAnY3ViZS10by1yaWdodCc6IHtcbiAgICAgICAgICBpZDogNTksXG4gICAgICAgICAgbGFiZWw6ICdDdWJlIHRvIHJpZ2h0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVSaWdodE91dCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVSaWdodEluJyxcbiAgICAgICAgICByZXZlcnNlOiAnY3ViZS10by1sZWZ0J1xuICAgICAgICB9LFxuICAgICAgICAnY3ViZS10by10b3AnOiB7XG4gICAgICAgICAgaWQ6IDYwLFxuICAgICAgICAgIGxhYmVsOiAnQ3ViZSB0byB0b3AnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZVRvcE91dCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVUb3BJbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ2N1YmUtdG8tYm90dG9tJ1xuICAgICAgICB9LFxuICAgICAgICAnY3ViZS10by1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDYxLFxuICAgICAgICAgIGxhYmVsOiAnQ3ViZSB0byBib3R0b20nLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlQ3ViZUJvdHRvbU91dCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUN1YmVCb3R0b21JbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ2N1YmUtdG8tdG9wJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIENhcm91c2VsXG4gICAgICAgICdjYXJvdXNlbC10by1sZWZ0Jzoge1xuICAgICAgICAgIGlkOiA2MixcbiAgICAgICAgICBncm91cDogJ3JvdGF0ZTpjYXJvdXNlbCcsXG4gICAgICAgICAgbGFiZWw6ICdDYXJvdXNlbCB0byBsZWZ0JyxcbiAgICAgICAgICBvdXRDbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsTGVmdE91dCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsTGVmdEluJyxcbiAgICAgICAgICByZXZlcnNlOiAnY2Fyb3VzZWwtdG8tcmlnaHQnXG4gICAgICAgIH0sXG4gICAgICAgICdjYXJvdXNlbC10by1yaWdodCc6IHtcbiAgICAgICAgICBpZDogNjMsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGU6Y2Fyb3VzZWwnLFxuICAgICAgICAgIGxhYmVsOiAnQ2Fyb3VzZWwgdG8gcmlnaHQnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlQ2Fyb3VzZWxSaWdodE91dCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsUmlnaHRJbicsXG4gICAgICAgICAgcmV2ZXJzZTogJ2Nhcm91c2VsLXRvLWxlZnQnXG4gICAgICAgIH0sXG4gICAgICAgICdjYXJvdXNlbC10by10b3AnOiB7XG4gICAgICAgICAgaWQ6IDY0LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmNhcm91c2VsJyxcbiAgICAgICAgICBsYWJlbDogJ0Nhcm91c2VsIHRvIHRvcCcsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDYXJvdXNlbFRvcE91dCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsVG9wSW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdjYXJvdXNlbC10by1ib3R0b20nXG4gICAgICAgIH0sXG4gICAgICAgICdjYXJvdXNlbC10by1ib3R0b20nOiB7XG4gICAgICAgICAgaWQ6IDY1LFxuICAgICAgICAgIGdyb3VwOiAncm90YXRlOmNhcm91c2VsJyxcbiAgICAgICAgICBsYWJlbDogJ0Nhcm91c2VsIHRvIGJvdHRvbScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVDYXJvdXNlbEJvdHRvbU91dCBmeC1zbGlkZS1vbnRvcCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZUNhcm91c2VsQm90dG9tSW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdjYXJvdXNlbC10by10b3AnXG4gICAgICAgIH0sXG4gICAgICAgICdzaWRlcyc6IHtcbiAgICAgICAgICBpZDogNjYsXG4gICAgICAgICAgZ3JvdXA6ICdyb3RhdGUnLFxuICAgICAgICAgIGxhYmVsOiAnU2lkZXMnLFxuICAgICAgICAgIG91dENsYXNzOiAnZngtc2xpZGUtcm90YXRlU2lkZXNPdXQnLFxuICAgICAgICAgIGluQ2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVTaWRlc0luIGZ4LXNsaWRlLWRlbGF5MjAwJyxcbiAgICAgICAgICByZXZlcnNlOiAnc2lkZXMnXG4gICAgICAgIH0sXG4gICAgICAgICdzbGlkZSc6IHtcbiAgICAgICAgICBpZDogNjcsXG4gICAgICAgICAgbGFiZWw6ICdTbGlkZScsXG4gICAgICAgICAgb3V0Q2xhc3M6ICdmeC1zbGlkZS1yb3RhdGVTbGlkZU91dCcsXG4gICAgICAgICAgaW5DbGFzczogJ2Z4LXNsaWRlLXJvdGF0ZVNsaWRlSW4nLFxuICAgICAgICAgIHJldmVyc2U6ICdzbGlkZSdcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGdldEF4aXNGcm9tRGlyZWN0aW9uOiBmdW5jdGlvbiAoZGlyZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiBkaXJlY3Rpb24gPT09ICd2ZXJ0aWNhbCcgPyAnWScgOiAnWCc7XG4gICAgICB9LFxuICAgICAgYWRkQ2xhc3NOYW1lczogZnVuY3Rpb24gKGVsZW1lbnQsIGNsYXNzTmFtZXMpIHtcbiAgICAgICAgdmFyIG5hbWVzID0gY2xhc3NOYW1lcy5zcGxpdCgnICcpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZWxlbWVudC5jbGFzc0xpc3QuYWRkKG5hbWVzW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHJlbW92ZUNsYXNzTmFtZXM6IGZ1bmN0aW9uIChlbGVtZW50LCBjbGFzc05hbWVzKSB7XG4gICAgICAgIHZhciBuYW1lcyA9IGNsYXNzTmFtZXMuc3BsaXQoJyAnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShuYW1lc1tpXSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBwcmV2OiBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50LmluZGV4ID4gMCAmJiAhZXZlbnQudHJhbnNpdGlvbl9jb21wbGV0ZSkge1xuICAgICAgICAgIHZhciBvdXRTbGlkZSA9IGV2ZW50LnNsaWRlO1xuICAgICAgICAgIHZhciBpblNsaWRlID0gZGVjay5zbGlkZXNbZXZlbnQuaW5kZXggLSAxXTtcblxuICAgICAgICAgIHRoaXMuZG9UcmFuc2l0aW9uKG91dFNsaWRlLCBpblNsaWRlLCAncHJldicpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgbmV4dDogZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGV2ZW50KTtcbiAgICAgICAgaWYgKGV2ZW50LmluZGV4IDwgZGVjay5zbGlkZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHZhciBvdXRTbGlkZSA9IGV2ZW50LnNsaWRlO1xuICAgICAgICAgIHZhciBpblNsaWRlID0gZGVjay5zbGlkZXNbZXZlbnQuaW5kZXggKyAxXTtcblxuICAgICAgICAgIHRoaXMuZG9UcmFuc2l0aW9uKG91dFNsaWRlLCBpblNsaWRlLCAnbmV4dCcpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgc2xpZGU6IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBpZiAoZXZlbnQuc2xpZGUpIHtcbiAgICAgICAgICB2YXIgb3V0U2xpZGVJbmRleCA9IGRlY2suc2xpZGUoKTtcbiAgICAgICAgICB2YXIgb3V0U2xpZGUgPSBkZWNrLnNsaWRlc1tvdXRTbGlkZUluZGV4XTtcbiAgICAgICAgICB2YXIgaW5TbGlkZUluZGV4ID0gZXZlbnQuaW5kZXg7XG4gICAgICAgICAgdmFyIGluU2xpZGUgPSBldmVudC5zbGlkZTtcbiAgICAgICAgICB2YXIgZGlyZWN0aW9uID0gKGluU2xpZGVJbmRleCA+IG91dFNsaWRlSW5kZXgpID8gJ25leHQnIDogJ3ByZXYnO1xuICAgICAgICAgIHRoaXMuZG9UcmFuc2l0aW9uKG91dFNsaWRlLCBpblNsaWRlLCBkaXJlY3Rpb24pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZG9UcmFuc2l0aW9uOiBmdW5jdGlvbiAob3V0U2xpZGUsIGluU2xpZGUsIGRpcmVjdGl2ZSkge1xuICAgICAgICB2YXIgYXhpcyA9IGluU2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtZngtZGlyZWN0aW9uJykgPyB0aGlzLmdldEF4aXNGcm9tRGlyZWN0aW9uKGluU2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtZngtZGlyZWN0aW9uJykpIDogZGVmYXVsdF9heGlzO1xuICAgICAgICBpZiAocmV2ZXJzZSB8fCBpblNsaWRlLmdldEF0dHJpYnV0ZSgnZGF0YS1iZXNwb2tlLWZ4LXJldmVyc2UnKSA9PT0gJ3RydWUnKSB7XG4gICAgICAgICAgZGlyZWN0aXZlID0gZGlyZWN0aXZlID09PSAnbmV4dCcgPyAncHJldicgOiAnbmV4dCc7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHNsaWRlX3RyYW5zaXRpb25fbmFtZSA9IGluU2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtZngtdHJhbnNpdGlvbicpO1xuICAgICAgICB2YXIgc2xpZGVfdHJhbnNpdGlvbiA9IHRoaXMuZnhbc2xpZGVfdHJhbnNpdGlvbl9uYW1lXVtheGlzXSA/IHRoaXMuZnhbc2xpZGVfdHJhbnNpdGlvbl9uYW1lXVtheGlzXSA6IHRoaXMuZnhbdHJhbnNpdGlvbl1bYXhpc107XG4gICAgICAgIHZhciB0cmFuc2l0aW9uX25hbWUgPSBzbGlkZV90cmFuc2l0aW9uW2RpcmVjdGl2ZV07XG4gICAgICAgIHZhciBvdXRDbGFzcyA9IHRoaXMuYW5pbWF0aW9uc1t0cmFuc2l0aW9uX25hbWVdLm91dENsYXNzO1xuICAgICAgICB2YXIgaW5DbGFzcyA9IHRoaXMuYW5pbWF0aW9uc1t0cmFuc2l0aW9uX25hbWVdLmluQ2xhc3M7XG4gICAgICAgIHZhciBiZXNwb2tlRnggPSB0aGlzO1xuICAgICAgICBvdXRTbGlkZS5hZGRFdmVudExpc3RlbmVyKCd3ZWJraXRBbmltYXRpb25FbmQnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICBiZXNwb2tlRngucmVtb3ZlQ2xhc3NOYW1lcyhldmVudC50YXJnZXQsIG91dENsYXNzICsgJyBmeC10cmFuc2l0aW9uaW5nLW91dCcpO1xuICAgICAgICB9KTtcbiAgICAgICAgaW5TbGlkZS5hZGRFdmVudExpc3RlbmVyKCd3ZWJraXRBbmltYXRpb25FbmQnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICBiZXNwb2tlRngucmVtb3ZlQ2xhc3NOYW1lcyhldmVudC50YXJnZXQsIGluQ2xhc3MgKyAnIGZ4LXRyYW5zaXRpb25pbmctaW4nKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuYWRkQ2xhc3NOYW1lcyhvdXRTbGlkZSwgb3V0Q2xhc3MgKyAnIGZ4LXRyYW5zaXRpb25pbmctb3V0Jyk7XG4gICAgICAgIHRoaXMuYWRkQ2xhc3NOYW1lcyhpblNsaWRlLCBpbkNsYXNzICsgJyBmeC10cmFuc2l0aW9uaW5nLWluJyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGRlY2sub24oJ25leHQnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHBsdWdpbi5uZXh0KGV2ZW50KVxuICAgIH0pO1xuICAgIGRlY2sub24oJ3ByZXYnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHBsdWdpbi5wcmV2KGV2ZW50KVxuICAgIH0pO1xuICAgIGRlY2sub24oJ3NsaWRlJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICBwbHVnaW4uc2xpZGUoZXZlbnQpXG4gICAgfSk7XG4gIH07XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XG4gICAgdmFyIGFjdGl2YXRlU2xpZGUgPSBmdW5jdGlvbihpbmRleCkge1xuICAgICAgdmFyIGluZGV4VG9BY3RpdmF0ZSA9IC0xIDwgaW5kZXggJiYgaW5kZXggPCBkZWNrLnNsaWRlcy5sZW5ndGggPyBpbmRleCA6IDA7XG4gICAgICBpZiAoaW5kZXhUb0FjdGl2YXRlICE9PSBkZWNrLnNsaWRlKCkpIHtcbiAgICAgICAgZGVjay5zbGlkZShpbmRleFRvQWN0aXZhdGUpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgcGFyc2VIYXNoID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaGFzaCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnNsaWNlKDEpLFxuICAgICAgICBzbGlkZU51bWJlck9yTmFtZSA9IHBhcnNlSW50KGhhc2gsIDEwKTtcblxuICAgICAgaWYgKGhhc2gpIHtcbiAgICAgICAgaWYgKHNsaWRlTnVtYmVyT3JOYW1lKSB7XG4gICAgICAgICAgYWN0aXZhdGVTbGlkZShzbGlkZU51bWJlck9yTmFtZSAtIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlY2suc2xpZGVzLmZvckVhY2goZnVuY3Rpb24oc2xpZGUsIGkpIHtcbiAgICAgICAgICAgIGlmIChzbGlkZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYmVzcG9rZS1oYXNoJykgPT09IGhhc2ggfHwgc2xpZGUuaWQgPT09IGhhc2gpIHtcbiAgICAgICAgICAgICAgYWN0aXZhdGVTbGlkZShpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgcGFyc2VIYXNoKCk7XG5cbiAgICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICB2YXIgc2xpZGVOYW1lID0gZS5zbGlkZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYmVzcG9rZS1oYXNoJykgfHwgZS5zbGlkZS5pZDtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmhhc2ggPSBzbGlkZU5hbWUgfHwgZS5pbmRleCArIDE7XG4gICAgICB9KTtcblxuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2hhc2hjaGFuZ2UnLCBwYXJzZUhhc2gpO1xuICAgIH0sIDApO1xuICB9O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xuICAgIHZhciBpc0hvcml6b250YWwgPSBvcHRpb25zICE9PSAndmVydGljYWwnO1xuXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChlLndoaWNoID09IDM0IHx8IC8vIFBBR0UgRE9XTlxuICAgICAgICAoZS53aGljaCA9PSAzMiAmJiAhZS5zaGlmdEtleSkgfHwgLy8gU1BBQ0UgV0lUSE9VVCBTSElGVFxuICAgICAgICAoaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gMzkpIHx8IC8vIFJJR0hUXG4gICAgICAgICghaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gNDApIC8vIERPV05cbiAgICAgICkgeyBkZWNrLm5leHQoKTsgfVxuXG4gICAgICBpZiAoZS53aGljaCA9PSAzMyB8fCAvLyBQQUdFIFVQXG4gICAgICAgIChlLndoaWNoID09IDMyICYmIGUuc2hpZnRLZXkpIHx8IC8vIFNQQUNFICsgU0hJRlRcbiAgICAgICAgKGlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDM3KSB8fCAvLyBMRUZUXG4gICAgICAgICghaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gMzgpIC8vIFVQXG4gICAgICApIHsgZGVjay5wcmV2KCk7IH1cbiAgICB9KTtcbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChkZWNrKSB7XG4gICAgdmFyIHByb2dyZXNzUGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXG4gICAgICBwcm9ncmVzc0JhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuICAgICAgcHJvcCA9IG9wdGlvbnMgPT09ICd2ZXJ0aWNhbCcgPyAnaGVpZ2h0JyA6ICd3aWR0aCc7XG5cbiAgICBwcm9ncmVzc1BhcmVudC5jbGFzc05hbWUgPSAnYmVzcG9rZS1wcm9ncmVzcy1wYXJlbnQnO1xuICAgIHByb2dyZXNzQmFyLmNsYXNzTmFtZSA9ICdiZXNwb2tlLXByb2dyZXNzLWJhcic7XG4gICAgcHJvZ3Jlc3NQYXJlbnQuYXBwZW5kQ2hpbGQocHJvZ3Jlc3NCYXIpO1xuICAgIGRlY2sucGFyZW50LmFwcGVuZENoaWxkKHByb2dyZXNzUGFyZW50KTtcblxuICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oZSkge1xuICAgICAgcHJvZ3Jlc3NCYXIuc3R5bGVbcHJvcF0gPSAoZS5pbmRleCAqIDEwMCAvIChkZWNrLnNsaWRlcy5sZW5ndGggLSAxKSkgKyAnJSc7XG4gICAgfSk7XG4gIH07XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XG4gICAgdmFyIHBhcmVudCA9IGRlY2sucGFyZW50LFxuICAgICAgZmlyc3RTbGlkZSA9IGRlY2suc2xpZGVzWzBdLFxuICAgICAgc2xpZGVIZWlnaHQgPSBmaXJzdFNsaWRlLm9mZnNldEhlaWdodCxcbiAgICAgIHNsaWRlV2lkdGggPSBmaXJzdFNsaWRlLm9mZnNldFdpZHRoLFxuICAgICAgdXNlWm9vbSA9IG9wdGlvbnMgPT09ICd6b29tJyB8fCAoJ3pvb20nIGluIHBhcmVudC5zdHlsZSAmJiBvcHRpb25zICE9PSAndHJhbnNmb3JtJyksXG5cbiAgICAgIHdyYXAgPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2Jlc3Bva2Utc2NhbGUtcGFyZW50JztcbiAgICAgICAgZWxlbWVudC5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh3cmFwcGVyLCBlbGVtZW50KTtcbiAgICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZChlbGVtZW50KTtcbiAgICAgICAgcmV0dXJuIHdyYXBwZXI7XG4gICAgICB9LFxuXG4gICAgICBlbGVtZW50cyA9IHVzZVpvb20gPyBkZWNrLnNsaWRlcyA6IGRlY2suc2xpZGVzLm1hcCh3cmFwKSxcblxuICAgICAgdHJhbnNmb3JtUHJvcGVydHkgPSAoZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgdmFyIHByZWZpeGVzID0gJ01veiBXZWJraXQgTyBtcycuc3BsaXQoJyAnKTtcbiAgICAgICAgcmV0dXJuIHByZWZpeGVzLnJlZHVjZShmdW5jdGlvbihjdXJyZW50UHJvcGVydHksIHByZWZpeCkge1xuICAgICAgICAgICAgcmV0dXJuIHByZWZpeCArIHByb3BlcnR5IGluIHBhcmVudC5zdHlsZSA/IHByZWZpeCArIHByb3BlcnR5IDogY3VycmVudFByb3BlcnR5O1xuICAgICAgICAgIH0sIHByb3BlcnR5LnRvTG93ZXJDYXNlKCkpO1xuICAgICAgfSgnVHJhbnNmb3JtJykpLFxuXG4gICAgICBzY2FsZSA9IHVzZVpvb20gP1xuICAgICAgICBmdW5jdGlvbihyYXRpbywgZWxlbWVudCkge1xuICAgICAgICAgIGVsZW1lbnQuc3R5bGUuem9vbSA9IHJhdGlvO1xuICAgICAgICB9IDpcbiAgICAgICAgZnVuY3Rpb24ocmF0aW8sIGVsZW1lbnQpIHtcbiAgICAgICAgICBlbGVtZW50LnN0eWxlW3RyYW5zZm9ybVByb3BlcnR5XSA9ICdzY2FsZSgnICsgcmF0aW8gKyAnKSc7XG4gICAgICAgIH0sXG5cbiAgICAgIHNjYWxlQWxsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB4U2NhbGUgPSBwYXJlbnQub2Zmc2V0V2lkdGggLyBzbGlkZVdpZHRoLFxuICAgICAgICAgIHlTY2FsZSA9IHBhcmVudC5vZmZzZXRIZWlnaHQgLyBzbGlkZUhlaWdodDtcblxuICAgICAgICBlbGVtZW50cy5mb3JFYWNoKHNjYWxlLmJpbmQobnVsbCwgTWF0aC5taW4oeFNjYWxlLCB5U2NhbGUpKSk7XG4gICAgICB9O1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHNjYWxlQWxsKTtcbiAgICBzY2FsZUFsbCgpO1xuICB9O1xuXG59O1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuLyohXG4gKiBiZXNwb2tlLXRoZW1lLWN1YmUgdjIuMC4xXG4gKlxuICogQ29weXJpZ2h0IDIwMTQsIE1hcmsgRGFsZ2xlaXNoXG4gKiBUaGlzIGNvbnRlbnQgaXMgcmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlXG4gKiBodHRwOi8vbWl0LWxpY2Vuc2Uub3JnL21hcmtkYWxnbGVpc2hcbiAqL1xuXG4hZnVuY3Rpb24oZSl7aWYoXCJvYmplY3RcIj09dHlwZW9mIGV4cG9ydHMpbW9kdWxlLmV4cG9ydHM9ZSgpO2Vsc2UgaWYoXCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kKWRlZmluZShlKTtlbHNle3ZhciBvO1widW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/bz13aW5kb3c6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9vPWdsb2JhbDpcInVuZGVmaW5lZFwiIT10eXBlb2Ygc2VsZiYmKG89c2VsZik7dmFyIGY9bztmPWYuYmVzcG9rZXx8KGYuYmVzcG9rZT17fSksZj1mLnRoZW1lc3x8KGYudGhlbWVzPXt9KSxmLmN1YmU9ZSgpfX0oZnVuY3Rpb24oKXt2YXIgZGVmaW5lLG1vZHVsZSxleHBvcnRzO3JldHVybiAoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSh7MTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG5cbnZhciBjbGFzc2VzID0gX2RlcmVxXygnYmVzcG9rZS1jbGFzc2VzJyk7XG52YXIgaW5zZXJ0Q3NzID0gX2RlcmVxXygnaW5zZXJ0LWNzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgY3NzID0gXCIqey1tb3otYm94LXNpemluZzpib3JkZXItYm94O2JveC1zaXppbmc6Ym9yZGVyLWJveDttYXJnaW46MDtwYWRkaW5nOjB9QG1lZGlhIHByaW50eyp7LXdlYmtpdC1wcmludC1jb2xvci1hZGp1c3Q6ZXhhY3R9fUBwYWdle3NpemU6bGFuZHNjYXBlO21hcmdpbjowfS5iZXNwb2tlLXBhcmVudHstd2Via2l0LXRyYW5zaXRpb246YmFja2dyb3VuZCAuNnMgZWFzZTt0cmFuc2l0aW9uOmJhY2tncm91bmQgLjZzIGVhc2U7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7Ym90dG9tOjA7bGVmdDowO3JpZ2h0OjA7b3ZlcmZsb3c6aGlkZGVufUBtZWRpYSBwcmludHsuYmVzcG9rZS1wYXJlbnR7b3ZlcmZsb3c6dmlzaWJsZTtwb3NpdGlvbjpzdGF0aWN9fS5iZXNwb2tlLXRoZW1lLWN1YmUtc2xpZGUtcGFyZW50e3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowOy13ZWJraXQtcGVyc3BlY3RpdmU6NjAwcHg7cGVyc3BlY3RpdmU6NjAwcHg7cG9pbnRlci1ldmVudHM6bm9uZX0uYmVzcG9rZS1zbGlkZXtwb2ludGVyLWV2ZW50czphdXRvOy13ZWJraXQtdHJhbnNpdGlvbjotd2Via2l0LXRyYW5zZm9ybSAuNnMgZWFzZSxvcGFjaXR5IC42cyBlYXNlLGJhY2tncm91bmQgLjZzIGVhc2U7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjZzIGVhc2Usb3BhY2l0eSAuNnMgZWFzZSxiYWNrZ3JvdW5kIC42cyBlYXNlOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjo1MCUgNTAlIDA7dHJhbnNmb3JtLW9yaWdpbjo1MCUgNTAlIDA7LXdlYmtpdC1iYWNrZmFjZS12aXNpYmlsaXR5OmhpZGRlbjtiYWNrZmFjZS12aXNpYmlsaXR5OmhpZGRlbjtkaXNwbGF5Oi13ZWJraXQtYm94O2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtYm94LW9yaWVudDp2ZXJ0aWNhbDstd2Via2l0LWJveC1kaXJlY3Rpb246bm9ybWFsOy13ZWJraXQtZmxleC1kaXJlY3Rpb246Y29sdW1uOy1tcy1mbGV4LWRpcmVjdGlvbjpjb2x1bW47ZmxleC1kaXJlY3Rpb246Y29sdW1uOy13ZWJraXQtYm94LXBhY2s6Y2VudGVyOy13ZWJraXQtanVzdGlmeS1jb250ZW50OmNlbnRlcjstbXMtZmxleC1wYWNrOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOy13ZWJraXQtYm94LWFsaWduOmNlbnRlcjstd2Via2l0LWFsaWduLWl0ZW1zOmNlbnRlcjstbXMtZmxleC1hbGlnbjpjZW50ZXI7YWxpZ24taXRlbXM6Y2VudGVyO3RleHQtYWxpZ246Y2VudGVyO3dpZHRoOjY0MHB4O2hlaWdodDo0ODBweDtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6NTAlO21hcmdpbi10b3A6LTI0MHB4O2xlZnQ6NTAlO21hcmdpbi1sZWZ0Oi0zMjBweDtiYWNrZ3JvdW5kOiNlYWVhZWE7cGFkZGluZzo0MHB4O2JvcmRlci1yYWRpdXM6MH1AbWVkaWEgcHJpbnR7LmJlc3Bva2Utc2xpZGV7em9vbToxIWltcG9ydGFudDtoZWlnaHQ6NzQzcHg7d2lkdGg6MTAwJTtwYWdlLWJyZWFrLWJlZm9yZTphbHdheXM7cG9zaXRpb246c3RhdGljO21hcmdpbjowOy13ZWJraXQtdHJhbnNpdGlvbjpub25lO3RyYW5zaXRpb246bm9uZX19LmJlc3Bva2UtYmVmb3Jley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZVgoMTAwcHgpdHJhbnNsYXRlWCgtMzIwcHgpcm90YXRlWSgtOTBkZWcpdHJhbnNsYXRlWCgtMzIwcHgpO3RyYW5zZm9ybTp0cmFuc2xhdGVYKDEwMHB4KXRyYW5zbGF0ZVgoLTMyMHB4KXJvdGF0ZVkoLTkwZGVnKXRyYW5zbGF0ZVgoLTMyMHB4KX1AbWVkaWEgcHJpbnR7LmJlc3Bva2UtYmVmb3Jley13ZWJraXQtdHJhbnNmb3JtOm5vbmU7dHJhbnNmb3JtOm5vbmV9fS5iZXNwb2tlLWFmdGVyey13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTEwMHB4KXRyYW5zbGF0ZVgoMzIwcHgpcm90YXRlWSg5MGRlZyl0cmFuc2xhdGVYKDMyMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTAwcHgpdHJhbnNsYXRlWCgzMjBweClyb3RhdGVZKDkwZGVnKXRyYW5zbGF0ZVgoMzIwcHgpfUBtZWRpYSBwcmludHsuYmVzcG9rZS1hZnRlcnstd2Via2l0LXRyYW5zZm9ybTpub25lO3RyYW5zZm9ybTpub25lfX0uYmVzcG9rZS1pbmFjdGl2ZXtvcGFjaXR5OjA7cG9pbnRlci1ldmVudHM6bm9uZX1AbWVkaWEgcHJpbnR7LmJlc3Bva2UtaW5hY3RpdmV7b3BhY2l0eToxfX0uYmVzcG9rZS1hY3RpdmV7b3BhY2l0eToxfS5iZXNwb2tlLWJ1bGxldHstd2Via2l0LXRyYW5zaXRpb246YWxsIC4zcyBlYXNlO3RyYW5zaXRpb246YWxsIC4zcyBlYXNlfUBtZWRpYSBwcmludHsuYmVzcG9rZS1idWxsZXR7LXdlYmtpdC10cmFuc2l0aW9uOm5vbmU7dHJhbnNpdGlvbjpub25lfX0uYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7b3BhY2l0eTowfWxpLmJlc3Bva2UtYnVsbGV0LWluYWN0aXZley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZVgoMTZweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoMTZweCl9QG1lZGlhIHByaW50e2xpLmJlc3Bva2UtYnVsbGV0LWluYWN0aXZley13ZWJraXQtdHJhbnNmb3JtOm5vbmU7dHJhbnNmb3JtOm5vbmV9fUBtZWRpYSBwcmludHsuYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7b3BhY2l0eToxfX0uYmVzcG9rZS1idWxsZXQtYWN0aXZle29wYWNpdHk6MX0uYmVzcG9rZS1zY2FsZS1wYXJlbnR7LXdlYmtpdC1wZXJzcGVjdGl2ZTo2MDBweDtwZXJzcGVjdGl2ZTo2MDBweDtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDtwb2ludGVyLWV2ZW50czpub25lfS5iZXNwb2tlLXNjYWxlLXBhcmVudCAuYmVzcG9rZS1hY3RpdmV7cG9pbnRlci1ldmVudHM6YXV0b31AbWVkaWEgcHJpbnR7LmJlc3Bva2Utc2NhbGUtcGFyZW50ey13ZWJraXQtdHJhbnNmb3JtOm5vbmUhaW1wb3J0YW50O3RyYW5zZm9ybTpub25lIWltcG9ydGFudH19LmJlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50e3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2hlaWdodDoycHh9QG1lZGlhIG9ubHkgc2NyZWVuIGFuZCAobWluLXdpZHRoOjEzNjZweCl7LmJlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50e2hlaWdodDo0cHh9fUBtZWRpYSBwcmludHsuYmVzcG9rZS1wcm9ncmVzcy1wYXJlbnR7ZGlzcGxheTpub25lfX0uYmVzcG9rZS1wcm9ncmVzcy1iYXJ7LXdlYmtpdC10cmFuc2l0aW9uOndpZHRoIC42cyBlYXNlO3RyYW5zaXRpb246d2lkdGggLjZzIGVhc2U7cG9zaXRpb246YWJzb2x1dGU7aGVpZ2h0OjEwMCU7YmFja2dyb3VuZDojMDA4OWYzO2JvcmRlci1yYWRpdXM6MCA0cHggNHB4IDB9LmVtcGhhdGlje2JhY2tncm91bmQ6I2VhZWFlYX0uYmVzcG9rZS1iYWNrZHJvcHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGVaKDApO3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApOy13ZWJraXQtdHJhbnNpdGlvbjpvcGFjaXR5IC42cyBlYXNlO3RyYW5zaXRpb246b3BhY2l0eSAuNnMgZWFzZTtvcGFjaXR5OjA7ei1pbmRleDotMX0uYmVzcG9rZS1iYWNrZHJvcC1hY3RpdmV7b3BhY2l0eToxfXByZXtwYWRkaW5nOjI2cHghaW1wb3J0YW50O2JvcmRlci1yYWRpdXM6OHB4fWJvZHl7Zm9udC1mYW1pbHk6aGVsdmV0aWNhLGFyaWFsLHNhbnMtc2VyaWY7Zm9udC1zaXplOjE4cHg7Y29sb3I6IzQwNDA0MH1oMXtmb250LXNpemU6NzJweDtsaW5lLWhlaWdodDo4MnB4O2xldHRlci1zcGFjaW5nOi0ycHg7bWFyZ2luLWJvdHRvbToxNnB4fWgye2ZvbnQtc2l6ZTo0MnB4O2xldHRlci1zcGFjaW5nOi0xcHg7bWFyZ2luLWJvdHRvbTo4cHh9aDN7Zm9udC1zaXplOjI0cHg7Zm9udC13ZWlnaHQ6NDAwO21hcmdpbi1ib3R0b206MjRweDtjb2xvcjojNjA2MDYwfWhye3Zpc2liaWxpdHk6aGlkZGVuO2hlaWdodDoyMHB4fXVse2xpc3Qtc3R5bGU6bm9uZX1saXttYXJnaW4tYm90dG9tOjEycHh9cHttYXJnaW46MCAxMDBweCAxMnB4O2xpbmUtaGVpZ2h0OjIycHh9YXtjb2xvcjojMDA4OWYzO3RleHQtZGVjb3JhdGlvbjpub25lfVwiO1xuICBpbnNlcnRDc3MoY3NzLCB7IHByZXBlbmQ6IHRydWUgfSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICBjbGFzc2VzKCkoZGVjayk7XG5cbiAgICB2YXIgd3JhcCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9ICdiZXNwb2tlLXRoZW1lLWN1YmUtc2xpZGUtcGFyZW50JztcbiAgICAgIGVsZW1lbnQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUod3JhcHBlciwgZWxlbWVudCk7XG4gICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuICAgIH07XG5cbiAgICBkZWNrLnNsaWRlcy5mb3JFYWNoKHdyYXApO1xuICB9O1xufTtcblxufSx7XCJiZXNwb2tlLWNsYXNzZXNcIjoyLFwiaW5zZXJ0LWNzc1wiOjN9XSwyOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XG4gICAgdmFyIGFkZENsYXNzID0gZnVuY3Rpb24oZWwsIGNscykge1xuICAgICAgICBlbC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLScgKyBjbHMpO1xuICAgICAgfSxcblxuICAgICAgcmVtb3ZlQ2xhc3MgPSBmdW5jdGlvbihlbCwgY2xzKSB7XG4gICAgICAgIGVsLmNsYXNzTmFtZSA9IGVsLmNsYXNzTmFtZVxuICAgICAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoJ2Jlc3Bva2UtJyArIGNscyArJyhcXFxcc3wkKScsICdnJyksICcgJylcbiAgICAgICAgICAudHJpbSgpO1xuICAgICAgfSxcblxuICAgICAgZGVhY3RpdmF0ZSA9IGZ1bmN0aW9uKGVsLCBpbmRleCkge1xuICAgICAgICB2YXIgYWN0aXZlU2xpZGUgPSBkZWNrLnNsaWRlc1tkZWNrLnNsaWRlKCldLFxuICAgICAgICAgIG9mZnNldCA9IGluZGV4IC0gZGVjay5zbGlkZSgpLFxuICAgICAgICAgIG9mZnNldENsYXNzID0gb2Zmc2V0ID4gMCA/ICdhZnRlcicgOiAnYmVmb3JlJztcblxuICAgICAgICBbJ2JlZm9yZSgtXFxcXGQrKT8nLCAnYWZ0ZXIoLVxcXFxkKyk/JywgJ2FjdGl2ZScsICdpbmFjdGl2ZSddLm1hcChyZW1vdmVDbGFzcy5iaW5kKG51bGwsIGVsKSk7XG5cbiAgICAgICAgaWYgKGVsICE9PSBhY3RpdmVTbGlkZSkge1xuICAgICAgICAgIFsnaW5hY3RpdmUnLCBvZmZzZXRDbGFzcywgb2Zmc2V0Q2xhc3MgKyAnLScgKyBNYXRoLmFicyhvZmZzZXQpXS5tYXAoYWRkQ2xhc3MuYmluZChudWxsLCBlbCkpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgYWRkQ2xhc3MoZGVjay5wYXJlbnQsICdwYXJlbnQnKTtcbiAgICBkZWNrLnNsaWRlcy5tYXAoZnVuY3Rpb24oZWwpIHsgYWRkQ2xhc3MoZWwsICdzbGlkZScpOyB9KTtcblxuICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oZSkge1xuICAgICAgZGVjay5zbGlkZXMubWFwKGRlYWN0aXZhdGUpO1xuICAgICAgYWRkQ2xhc3MoZS5zbGlkZSwgJ2FjdGl2ZScpO1xuICAgICAgcmVtb3ZlQ2xhc3MoZS5zbGlkZSwgJ2luYWN0aXZlJyk7XG4gICAgfSk7XG4gIH07XG59O1xuXG59LHt9XSwzOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbnZhciBpbnNlcnRlZCA9IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjc3MsIG9wdGlvbnMpIHtcbiAgICBpZiAoaW5zZXJ0ZWRbY3NzXSkgcmV0dXJuO1xuICAgIGluc2VydGVkW2Nzc10gPSB0cnVlO1xuICAgIFxuICAgIHZhciBlbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBlbGVtLnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2NzcycpO1xuXG4gICAgaWYgKCd0ZXh0Q29udGVudCcgaW4gZWxlbSkge1xuICAgICAgZWxlbS50ZXh0Q29udGVudCA9IGNzcztcbiAgICB9IGVsc2Uge1xuICAgICAgZWxlbS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7XG4gICAgfVxuICAgIFxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnByZXBlbmQpIHtcbiAgICAgICAgaGVhZC5pbnNlcnRCZWZvcmUoZWxlbSwgaGVhZC5jaGlsZE5vZGVzWzBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBoZWFkLmFwcGVuZENoaWxkKGVsZW0pO1xuICAgIH1cbn07XG5cbn0se31dfSx7fSxbMV0pXG4oMSlcbn0pO1xufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgYXhpcyA9IG9wdGlvbnMgPT0gJ3ZlcnRpY2FsJyA/ICdZJyA6ICdYJyxcbiAgICAgIHN0YXJ0UG9zaXRpb24sXG4gICAgICBkZWx0YTtcblxuICAgIGRlY2sucGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBmdW5jdGlvbihlKSB7XG4gICAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHN0YXJ0UG9zaXRpb24gPSBlLnRvdWNoZXNbMF1bJ3BhZ2UnICsgYXhpc107XG4gICAgICAgIGRlbHRhID0gMDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlY2sucGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBkZWx0YSA9IGUudG91Y2hlc1swXVsncGFnZScgKyBheGlzXSAtIHN0YXJ0UG9zaXRpb247XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWNrLnBhcmVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKE1hdGguYWJzKGRlbHRhKSA+IDUwKSB7XG4gICAgICAgIGRlY2tbZGVsdGEgPiAwID8gJ3ByZXYnIDogJ25leHQnXSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xufTtcbiIsInZhciBmcm9tID0gZnVuY3Rpb24ob3B0cywgcGx1Z2lucykge1xuICB2YXIgcGFyZW50ID0gKG9wdHMucGFyZW50IHx8IG9wdHMpLm5vZGVUeXBlID09PSAxID8gKG9wdHMucGFyZW50IHx8IG9wdHMpIDogZG9jdW1lbnQucXVlcnlTZWxlY3RvcihvcHRzLnBhcmVudCB8fCBvcHRzKSxcbiAgICBzbGlkZXMgPSBbXS5maWx0ZXIuY2FsbCh0eXBlb2Ygb3B0cy5zbGlkZXMgPT09ICdzdHJpbmcnID8gcGFyZW50LnF1ZXJ5U2VsZWN0b3JBbGwob3B0cy5zbGlkZXMpIDogKG9wdHMuc2xpZGVzIHx8IHBhcmVudC5jaGlsZHJlbiksIGZ1bmN0aW9uKGVsKSB7IHJldHVybiBlbC5ub2RlTmFtZSAhPT0gJ1NDUklQVCc7IH0pLFxuICAgIGFjdGl2ZVNsaWRlID0gc2xpZGVzWzBdLFxuICAgIGxpc3RlbmVycyA9IHt9LFxuXG4gICAgYWN0aXZhdGUgPSBmdW5jdGlvbihpbmRleCwgY3VzdG9tRGF0YSkge1xuICAgICAgaWYgKCFzbGlkZXNbaW5kZXhdKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZmlyZSgnZGVhY3RpdmF0ZScsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpO1xuICAgICAgYWN0aXZlU2xpZGUgPSBzbGlkZXNbaW5kZXhdO1xuICAgICAgZmlyZSgnYWN0aXZhdGUnLCBjcmVhdGVFdmVudERhdGEoYWN0aXZlU2xpZGUsIGN1c3RvbURhdGEpKTtcbiAgICB9LFxuXG4gICAgc2xpZGUgPSBmdW5jdGlvbihpbmRleCwgY3VzdG9tRGF0YSkge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgZmlyZSgnc2xpZGUnLCBjcmVhdGVFdmVudERhdGEoc2xpZGVzW2luZGV4XSwgY3VzdG9tRGF0YSkpICYmIGFjdGl2YXRlKGluZGV4LCBjdXN0b21EYXRhKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBzbGlkZXMuaW5kZXhPZihhY3RpdmVTbGlkZSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHN0ZXAgPSBmdW5jdGlvbihvZmZzZXQsIGN1c3RvbURhdGEpIHtcbiAgICAgIHZhciBzbGlkZUluZGV4ID0gc2xpZGVzLmluZGV4T2YoYWN0aXZlU2xpZGUpICsgb2Zmc2V0O1xuXG4gICAgICBmaXJlKG9mZnNldCA+IDAgPyAnbmV4dCcgOiAncHJldicsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpICYmIGFjdGl2YXRlKHNsaWRlSW5kZXgsIGN1c3RvbURhdGEpO1xuICAgIH0sXG5cbiAgICBvbiA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIChsaXN0ZW5lcnNbZXZlbnROYW1lXSB8fCAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXSkpLnB1c2goY2FsbGJhY2spO1xuICAgICAgcmV0dXJuIG9mZi5iaW5kKG51bGwsIGV2ZW50TmFtZSwgY2FsbGJhY2spO1xuICAgIH0sXG5cbiAgICBvZmYgPSBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IChsaXN0ZW5lcnNbZXZlbnROYW1lXSB8fCBbXSkuZmlsdGVyKGZ1bmN0aW9uKGxpc3RlbmVyKSB7IHJldHVybiBsaXN0ZW5lciAhPT0gY2FsbGJhY2s7IH0pO1xuICAgIH0sXG5cbiAgICBmaXJlID0gZnVuY3Rpb24oZXZlbnROYW1lLCBldmVudERhdGEpIHtcbiAgICAgIHJldHVybiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gfHwgW10pXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24obm90Q2FuY2VsbGVkLCBjYWxsYmFjaykge1xuICAgICAgICAgIHJldHVybiBub3RDYW5jZWxsZWQgJiYgY2FsbGJhY2soZXZlbnREYXRhKSAhPT0gZmFsc2U7XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH0sXG5cbiAgICBjcmVhdGVFdmVudERhdGEgPSBmdW5jdGlvbihlbCwgZXZlbnREYXRhKSB7XG4gICAgICBldmVudERhdGEgPSBldmVudERhdGEgfHwge307XG4gICAgICBldmVudERhdGEuaW5kZXggPSBzbGlkZXMuaW5kZXhPZihlbCk7XG4gICAgICBldmVudERhdGEuc2xpZGUgPSBlbDtcbiAgICAgIHJldHVybiBldmVudERhdGE7XG4gICAgfSxcblxuICAgIGRlY2sgPSB7XG4gICAgICBvbjogb24sXG4gICAgICBvZmY6IG9mZixcbiAgICAgIGZpcmU6IGZpcmUsXG4gICAgICBzbGlkZTogc2xpZGUsXG4gICAgICBuZXh0OiBzdGVwLmJpbmQobnVsbCwgMSksXG4gICAgICBwcmV2OiBzdGVwLmJpbmQobnVsbCwgLTEpLFxuICAgICAgcGFyZW50OiBwYXJlbnQsXG4gICAgICBzbGlkZXM6IHNsaWRlc1xuICAgIH07XG5cbiAgKHBsdWdpbnMgfHwgW10pLmZvckVhY2goZnVuY3Rpb24ocGx1Z2luKSB7XG4gICAgcGx1Z2luKGRlY2spO1xuICB9KTtcblxuICBhY3RpdmF0ZSgwKTtcblxuICByZXR1cm4gZGVjaztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBmcm9tOiBmcm9tXG59O1xuIiwiLy8gUmVxdWlyZSBOb2RlIG1vZHVsZXMgaW4gdGhlIGJyb3dzZXIgdGhhbmtzIHRvIEJyb3dzZXJpZnk6IGh0dHA6Ly9icm93c2VyaWZ5Lm9yZ1xudmFyIGJlc3Bva2UgPSByZXF1aXJlKCdiZXNwb2tlJyksXG4gIGZ4ID0gcmVxdWlyZSgnYmVzcG9rZS1meCcpLFxuICBjdWJlID0gcmVxdWlyZSgnYmVzcG9rZS10aGVtZS1jdWJlJyksXG4gIGtleXMgPSByZXF1aXJlKCdiZXNwb2tlLWtleXMnKSxcbiAgdG91Y2ggPSByZXF1aXJlKCdiZXNwb2tlLXRvdWNoJyksXG4gIGJ1bGxldHMgPSByZXF1aXJlKCdiZXNwb2tlLWJ1bGxldHMnKSxcbiAgYmFja2Ryb3AgPSByZXF1aXJlKCdiZXNwb2tlLWJhY2tkcm9wJyksXG4gIHNjYWxlID0gcmVxdWlyZSgnYmVzcG9rZS1zY2FsZScpLFxuICBoYXNoID0gcmVxdWlyZSgnYmVzcG9rZS1oYXNoJyksXG4gIHByb2dyZXNzID0gcmVxdWlyZSgnYmVzcG9rZS1wcm9ncmVzcycpLFxuICBmb3JtcyA9IHJlcXVpcmUoJ2Jlc3Bva2UtZm9ybXMnKTtcblxuLy8gQmVzcG9rZS5qc1xuYmVzcG9rZS5mcm9tKCdhcnRpY2xlJywgW1xuICBjdWJlKCksXG4gIGtleXMoKSxcbiAgdG91Y2goKSxcbiAgYnVsbGV0cygnbGksIC5idWxsZXQnKSxcbiAgYmFja2Ryb3AoKSxcbiAgc2NhbGUoKSxcbiAgaGFzaCgpLFxuICBwcm9ncmVzcygpLFxuICBmb3JtcygpXG5dKTtcbmJlc3Bva2UuZnJvbSgnI3ByZXNlbnRhdGlvbicsIFtcbiAgZngoKVxuXSk7XG5iZXNwb2tlLmZyb20oJ2FydGljbGUnLCBbXG4gIGJlc3Bva2UucGx1Z2lucy5meCgpXG5dKTtcbmJlc3Bva2UuaG9yaXpvbnRhbC5mcm9tKCdhcnRpY2xlJywge1xuICBmeDogdHJ1ZVxufSlcbmJlc3Bva2UudmVydGljYWwuZnJvbSgnYXJ0aWNsZScsIHtcbiAgZng6IHtcbiAgICAgIGRpcmVjdGlvbjogXCJ2ZXJ0aWNhbFwiLFxuICAgICAgdHJhbnNpdGlvbjogXCJjdWJlXCIsXG4gICAgICByZXZlcmVzZTogdHJ1ZVxuICAgIH1cbn0pO1xuLy8gUHJpc20gc3ludGF4IGhpZ2hsaWdodGluZ1xuLy8gVGhpcyBpcyBhY3R1YWxseSBsb2FkZWQgZnJvbSBcImJvd2VyX2NvbXBvbmVudHNcIiB0aGFua3MgdG9cbi8vIGRlYm93ZXJpZnk6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldWdlbmV3YXJlL2RlYm93ZXJpZnlcbnJlcXVpcmUoXCIuLy4uLy4uL2Jvd2VyX2NvbXBvbmVudHMvcHJpc20vcHJpc20uanNcIik7XG5cbiJdfQ==

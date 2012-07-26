/**
 *
 * '||''|.    ..|''||   '||    ||' '|| '||'  '|'           .           '||
 *  ||   ||  .|'    ||   |||  |||   '|. '|.  .'   ....   .||.    ....   || ..
 *  ||    || ||      ||  |'|..'||    ||  ||  |   '' .||   ||   .|   ''  ||' ||
 *  ||    || '|.     ||  | '|' ||     ||| |||    .|' ||   ||   ||       ||  ||
 * .||...|'   ''|...|'  .|. | .||.     |   |     '|..'|'  '|.'  '|...' .||. ||.
 * ----------------------------- By Display:inline ----------------------------
 *
 * Track DOM changes made by jQuery, and call setup/clear methods on target elements
 *
 * Structural good practices from the article from Addy Osmani 'Essential jQuery plugin patterns'
 * @url http://coding.smashingmagazine.com/2011/10/11/essential-jquery-plugin-patterns/
 */

/*
 * The semi-colon before the function invocation is a safety
 * net against concatenated scripts and/or other plugins
 * that are not closed properly.
 */
;(function($, window, document, undefined)
{
	/*
	 * undefined is used here as the undefined global variable in ECMAScript 3 and 4 is mutable (i.e. it can
	 * be changed by someone else). undefined isn't really being passed in so we can ensure that its value is
	 * truly undefined. In ES5, undefined can no longer be modified.
	 */

	/*
	 * window and document are passed through as local variables rather than as globals, because this (slightly)
	 * quickens the resolution process and can be more efficiently minified.
	 */

	/********************************************************/
	/*                 Variables declaration                */
	/********************************************************/

		// Objects cache
	var win = $(window),
		doc = $(document),

		// Whether auto-watching DOM changes or not
		autoWatch = true,

		// Recursion prevention in setup/clear watcher functions (prevent unnecessary processing)
		watching = true,

		// List of setup functions
		setupFunctions = [],

		// List of clear functions
		clearFunctions = [];

	// Public methods will be created in here
	$.domwatch = {

		/**
		 * Enable DOM watching
		 * @return void
		 */
		enableDOMWatch: function()
		{
			autoWatch = true;
		},

		/**
		 * Disable DOM watching
		 * @return boolean whether DOM watching was active before
		 */
		disableDOMWatch: function()
		{
			var previous = autoWatch;
			autoWatch = false;
			return previous;
		},

		/**
		 * Add a new global clear function. The function should accept 2 arguments:
		 * - self (whether the target element should be affected or not)
		 * - children (whether the element's children should be affected or not)
		 * The function should also return the jQuery selection, incremented from any added element in the root set
		 * (Note: the function may use the custom method findIn() with the same arguments)
		 *
		 * @param function func the function to be called on a jQuery object
		 * @param boolean priority set to true to call the function before all others (optional)
		 * @return void
		 */
		addClearFunction: function(func, priority)
		{
			clearFunctions[priority ? 'unshift' : 'push'](func);
		},

		/**
		 * Add a new global setup function. The function should accept 2 arguments:
		 * - self (whether the current element should be affected or not)
		 * - children (whether the element's children should be affected or not)
		 * The function should also return the jQuery selection, incremented from any added element in the root set
		 * (Note: the function may use the custom method findIn() with the same arguments)
		 *
		 * @param function func the function to be called on a jQuery object
		 * @param boolean priority set to true to call the function before all others (optional)
		 * @return void
		 */
		addSetupFunction: function(func, priority)
		{
			setupFunctions[priority ? 'unshift' : 'push'](func);
		}

	};

	/********************************************************/
	/*                DOM watching functions                */
	/********************************************************/

	/*
	 * The plugin intercepts main jQuery DOM methods to add a callback to the setup/clear functions.
	 * On heavy applications, this may lead to some performance loss, so this feature can be disabled on demand.
	 */
	$.each([

		/*
		 * Each function can have a clear and a setup function
		 * Both can take several options:
		 * - prepare (setup only): if required, perform an initial selection to detect which elements are added/removed
		 * - target: function that returns the target of the clear/setup functions
		 * - self: whether the clear/setup functions should apply to the modified elements
		 * - subs: whether the clear/setup functions should apply to the modified elements children
		 */
		{
			name:	'wrapAll',
			clear:	false,
			setup:	{ prepare: false,
					  target: function() { return this.parent(); },
					  self: true, subs: false }
		},
		{
			name:	'wrapInner',
			clear:	false,
			setup:	{ prepare: false,
					  target: function() { return this.children(); },
					  self: true, subs: false }
		},
		{
			name:	'wrap',
			clear:	false,
			setup:	{ prepare: false,
					  target: function() { return this.parent(); },
					  self: true, subs: false }
		},
		{
			name:	'unwrap',
			clear:	{ target: function() { return this.parent(); },
					  self: true, subs: false },
			setup:	false
		},
		{
			name:	'append',
			clear:	false,
			setup:	{ prepare: function() { return this.children(); },
					  target: function(prepared) { return this.children().not(prepared); },
					  self: true, subs: true }
		},
		{
			name:	'prepend',
			clear:	false,
			setup:	{ prepare: function() { return this.children(); },
					  target: function(prepared) { return this.children().not(prepared); },
					  self: true, subs: true }
		},
		{
			name:	'before',
			clear:	false,
			setup:	{ prepare: function() { return this.prevAll(); },
					  target: function(prepared) { return this.prevAll().not(prepared); },
					  self: true, subs: true }
		},
		{
			name:	'after',
			clear:	false,
			setup:	{ prepare: function() { return this.nextAll(); },
					  target: function(prepared) { return this.nextAll().not(prepared); },
					  self: true, subs: true }
		},
		{
			name:	'remove',
			clear:	{ target: function() { return this; },
					  self: true, subs: true },
			setup:	false
		},
		{
			name:	'empty',
			clear:	{ target: function() { return this; },
					  self: false, subs: true },
			setup:	false
		},
		{
			name:	'html',
			clear:	{ target: function() { return this; },
					  self: false, subs: true },
			setup:	{ prepare: false,
					  target: function() { return this; },
					  self: true,  subs: false }
		}

	], function()
	{
		// Store original
		var func = this,
			original = $.fn[func.name];

		// New wrapper function
		$.fn[func.name] = function()
		{
			var target,
				prepared = false,
				result;

			if (autoWatch && watching)
			{
				// Clear dynamic elements
				if (func.clear)
				{
					func.clear.target.call(this).applyClear(func.clear.self, func.clear.sub);
				}

				// Preparation for setup
				if (func.setup && func.setup.prepare)
				{
					prepared = func.setup.prepare.call(this);
				}
			}

			// Call original
			watching = false;
			result = original.apply(this, Array.prototype.slice.call(arguments));
			watching = true;

			// Call setup functions
			if (autoWatch && watching && func.setup)
			{
				func.setup.target.call(this, prepared).applySetup(func.setup.self, func.setup.sub);
			}

			return result;
		};
	});

	/********************************************************/
	/*                  Setup/clear methods                 */
	/********************************************************/

	/**
	 * Add a clear function on an element, with same format as $.domwatch.addClearFunction()
	 *
	 * @param function func the function to be added
	 * @param boolean priority set to true to call the function before all others (optional)
	 */
	$.fn.addClearFunction = function(func, priority)
	{
		this.each(function(i)
		{
			var element = $(this),
			functions = element.data('clearFunctions') || [];
			functions[priority ? 'unshift' : 'push'](func);
			element.addClass('withClearFunctions').data('clearFunctions', functions);
		});

		return this;
	};

	/**
	 * Remove a clear function from the element
	 *
	 * @param function func the function to be cleared
	 */
	$.fn.removeClearFunction = function(func)
	{
		this.each(function(i)
		{
			var element = $(this),
				functions = element.data('clearFunctions') || [],
				i;

			// Clear
			for (i = 0; i < functions.length; ++i)
			{
				if (functions[i] === func)
				{
					functions.splice(i, 1);
					--i;
				}
			}

			// If any function left
			if (functions.length > 0)
			{
				element.data('clearFunctions', functions);
			}
			else
			{
				element.removeClass('withClearFunctions').removeData('clearFunctions');
			}
		});

		return this;
	};

	/**
	 * Call every clear function over a jQuery object (for instance : $('body').applyClear())
	 *
	 * @param boolean self whether the current element should be affected or not (default: true)
	 * @param boolean children whether the element's children should be affected or not (default: true)
	 * @return void
	 */
	$.fn.applyClear = function(self, children)
	{
		var element = this,
			isWatching = $.domwatch.disableDOMWatch();

		// Defaults
		if (self === undefined) self = true;
		if (children === undefined) children = true;

		$.each(clearFunctions, function()
		{
			element = this.call(element, self, children);
		});

		// Re-enable DOM watching if required
		if (isWatching)
		{
			$.domwatch.enableDOMWatch();
		}

		return this;
	};

	/**
	 * Call every setup function over a jQuery object (for instance : $('body').applySetup())
	 *
	 * @param boolean self whether the current element should be affected or not (default: true)
	 * @param boolean children whether the element's children should be affected or not (default: true)
	 * @return void
	 */
	$.fn.applySetup = function(self, children)
	{
		var element = this,
			isWatching = $.domwatch.disableDOMWatch();

		// Defaults
		if (self === undefined) self = true;
		if (children === undefined) children = true;

		$.each(setupFunctions, function()
		{
			this.call(element, self, children);
		});

		// Re-enable DOM watching if required
		if (isWatching)
		{
			$.domwatch.enableDOMWatch();
		}

		return this;
	};

	/**
	 * Custom find method to work with the clear/setup functions arguments self & children
	 * @param boolean self whether the current element should be included in the search or not
	 * @param boolean children whether the element's children should be in the search or not
	 * @param mixed selector any selector for jQuery's find() method
	 * @return the selection
	 */
	$.fn.findIn = function(self, children, selector)
	{
		var element = $(this);

		// Mode
		if (self && children)
		{
			return element.filter(selector).add(element.find(selector));
		}
		else
		{
			return element[self ? 'filter' : 'find'](selector);
		}
	};

	// Main template clear function
	$.domwatch.addClearFunction(function(self, children)
	{
		// Elements with clear functions
		this.findIn(self, children, '.withClearFunctions').each(function(i)
		{
			var target = this,
				element = $(target),
				functions = element.data( 'clearFunctions' ) || [];

			$.each( functions, function( i )
			{
				this.apply( target );
			} );

			// Once called, functions are removed
			element.removeClass( 'withClearFunctions' ).removeData( 'clearFunctions' );
		});

		return this;
	});

	// Initial setup
	doc.ready(function()
	{
		$(document.body).applySetup();
	});

})(this.jQuery, window, document);
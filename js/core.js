(function () {
	var uid = 0;
	// utils
	function extend(oldObj, newObj) {
		for (var key in newObj) {
			oldObj[key] = newObj[key];
		}
		return oldObj;
	}

	function escapeHTML(str) {
		return str.replace(/&/g,'&amp;')
				  .replace(/</g,'&lt;')
				  .replace(/>/g,'&gt;');
	}

	function getUID() {
		return uid++;
	}

	function truncate(str, limit, omit) {
		if (str.length <= limit) return str;
		omit = omit || '...';
		limit -= omit.length;
		if (limit < 0) limit = 0;
		return (str.slice(0, limit) + omit);
	}

	function getBaseURL(str) {
		var match = str.match(/(\w+:\/\/[^\/]+)\/*.*/);
		return match[1] || '';
	}

	function relativeTime(start, end) {
		end = end || (new Date()).getTime();
        var s = (end - start)/1000;
		if (s < 60) {
			return Math.round(s)+'秒';
		} else if (s < 3600) {
			return Math.round(s/60)+'分钟';
		} else if (s < 86400) {
			return Math.round(s/3600)+'小时';
		} else {
			return Math.round(s/86400)+'天';
		}
	}

	// event bus
	var EventBus = (function () {
		function EventBus() {
			this.bus = {};
		}

		EventBus.prototype.register = function (ename, fn, scope) {
			if (ename instanceof Array) {
				for (var i = 0, n = ename.length;i < n;i++) {
					this.register(ename[i], fn, scope);
				}
			} else {
				if (this.bus[ename] == undefined) {
					this.bus[ename] = [];
				}
				this.bus[ename].push({
					fn : fn,
					scope : scope
				});
			}
		};

		EventBus.prototype.unregister = function (ename, fn) {
			var hds = this.bus[ename];
			if (hds != undefined) {
				for (var i = 0;i < hds.length;i++) {
					hds.splice(i, 1);
				}
			}
		};

		EventBus.prototype.post = function (ename) {
			var args = Array.prototype.slice.call(arguments, 1),
				hds = this.bus[ename], clone, i, n;
			if (hds != undefined) {
				n = hds.length;
				clone = [];
				for (i = 0;i < n;i++) {
					clone[i] = hds[i];
				}
				for (i = 0;i < n;i++) {
					clone[i].fn.apply(clone[i].scope, args);
				}
			}
		};

		return EventBus;
	})();

	// keyboard manager
	// [STATIC]
	var KeyboardManager = (function () {
		var pressedKeys = [],
			combos = {},
			eventBus = new EventBus(),
			exports = {};

		function processKeyDown(e) {
			var kc = e.keyCode, existFlag,
				n = pressedKeys.length;
			if (kc == 229) return;
			if (n == 0) {
				pressedKeys.push(kc);
			} else {
				existFlag = false;
				for (var i = 0;i < n;i++) {
					if (kc == pressedKeys[i]) {
						existFlag = true;
						break;
					} else if (kc > pressedKeys[i]) {
						break;
					}
				}
				if (!existFlag) {
					pressedKeys.splice(i, 0, kc);
				}
			}
			eventBus.post(generateEventName(e.keyCode), document.activeElement, e);
		}

		function processKeyUp(e) {
			var kc = e.keyCode,
				flag, i, n;
			for (var key in combos) {
				n = pressedKeys.length;
				if (combos[key].length == n) {
					flag = true;
					for (i = 0;i < n;i++) {
						if (combos[key][i] != pressedKeys[i]) {
							flag = false;
							break;
						}
					}
				} else {
					flag = false;
				}
				if (flag) {
					eventBus.post(key, document.activeElement, e);
				}
			}
			i = pressedKeys.indexOf(kc);
			if (i >= 0) {
				pressedKeys.splice(i, 1);
			}
		}

		function generateEventName(combo) {
			if (combo instanceof Array) {
				return 'kc_' + combo.join('_');
			} else {
				return 'ks_' + combo;
			}
		}

		exports.registerKeyCombo = function (combo, fn) {
			var sorted = combo.slice().sort(),
				ename = generateEventName(sorted);
			combos[ename] = sorted;
			eventBus.register(ename, fn);
		};

		exports.removeKeyCombo = function (combo, fn) {
			var sorted = combo.slice().sort(),
				ename = generateEventName(sorted);
			delete combos[ename];
			eventBus.unregister(ename, fn);
		};

		exports.registerSingleKey = function (keyCode, fn) {
			var ename = generateEventName(keyCode);
			eventBus.register(ename, fn);
		};

		exports.removeSingleKey = function (keyCode, fn) {
			var ename = generateEventName(keyCode);
			eventBus.unregister(ename, fn);
		};

		exports.flush = function () {
			pressedKeys = [];
		}

		exports.KEYS = {
			ENTER : 13,
			ESC : 27,
			SPACE : 32,
			TAB : 9,
			SHIFT : 16,
			CTRL : 17,
			ALT : 18,
			BACKSPACE : 8,
			LEFT : 37,
			UP : 38,
			RIGHT : 39,
			DOWN : 40 
		};

		window.addEventListener('keydown', processKeyDown);
		window.addEventListener('keyup', processKeyUp);

		return exports;
	})();

	// omnibox
	var Omnibox = (function () {
		var template = '<div class="transfer-ob-content"><input type="text" class="transfer-ob-input" placeholder=""></div>';
		function Omnibox() {
			var self = this, ele;
			self.eventBus = new EventBus();
			self.opened = false;

			ele = document.createElement('div');
			ele.className = 'transfer-ob-wrapper';
			ele.innerHTML = template;
			ele.addEventListener('transitioned', onTransitioned);
			self.ele = ele;
			self.input = this.ele.querySelector('input.transfer-ob-input');
			self.input.addEventListener('keyup', function () {
				if (!self.opened) return;
				if (self.timer != undefined) {
					clearTimeout(self.timer);
					self.timer = undefined;
				}
				self.timer = setTimeout(function () {
					var newVal = self.input.value;
					self.timer = undefined;
					if (self.prevValue != newVal) {
						self.eventBus.post('change', self.input.value);
					}
					self.prevValue = newVal;
				}, 200);
			});
			self.timer = null;

			return self;
		}

		function onTransitioned(e) {
			var ele = e.target;
			if (ele.style.opacity == 0.0) {
				ele.style.display = 'none';
			}
		}

		Omnibox.prototype.appendTo = function (node) {
			node.appendChild(this.ele);
			return this;
		}

		Omnibox.prototype.show = function () {
			if (!this.opened) {
				this.opened = true;
				this.ele.style.opacity = 1.0;
				this.ele.style.display = 'block';
				this.input.focus();
			}
			return this;
		}

		Omnibox.prototype.hide = function () {
			if (this.opened) {
				this.opened = false;
				this.ele.style.opacity = 0.0;
				this.ele.style.display = 'none';
				this.input.blur();
			}
			return this;
		}

		Omnibox.prototype.clear = function () {
			this.input.value = '';
			return this;
		}

		return Omnibox;
	})();

	// Omnilist
	var Omnilist = (function () {

		function Omnilist() {
			var self = this, frame;

			self.eventBus = new EventBus();
			/* list data stored here
			 * entry structure example
			 * {
			 *  	type : 'default',
			 *  	title : 'Title',
			 *  	info : 'information',
			 *  	highlights : [],
			 *  	icon : 'default',
			 * }
			**/
			self.dataEntries = [];
			self.listElements = [];
			self.selectedIndex = 0;
			// renders here, render name are associated with entry type
			self.renderers = {
				'default' : defaultRenderer
			};
			self.defaultRenderer = defaultRenderer;
			// set up dom elements
			self.wrapper = document.createElement('div');
			self.wrapper.className = 'transfer-l-wrapper';
			self.container = document.createElement('ul');
			self.container.className = 'transfer-l';
			frame = document.createElement('div');
			frame.className = 'transfer-l-frame';
			frame.appendChild(self.container);
			self.wrapper.appendChild(frame);
			self.wrapper.addEventListener('transitioned', function () {
				var ele = e.target;
				if (ele.style.opacity == 0.0) {
					ele.style.display = 'none';
				}
			});
			self.maxHeight = 500;
			self.hide();

			return self;
		}

		function defaultRenderer(entry) {
			return ('<div class="transfer-l-icon %1"></div>' +
					'<div class="transfer-l-content">' + 
					'<div class="transfer-title-wrapper"><h3 title="%2">%3</h3></div>' +
					'<div class="transfer-info-wrapper"><h4>%4</h4></div>' +
					'</div>')
					.replace('%1', entry.icon || '')
					.replace('%2', entry.title)
					.replace('%3', renderHighlights(entry.title, entry.highlights || []))
					.replace('%4', renderHighlights(entry.info || entry.url || '', entry.highlightsInfo || []));
		}

		/**
		 * add auto-scrolling animation to element, the HTML structure should be:
		 * <viewport>
		 *   <text wrapper>
		 *     <text>
		 * @param {DOMElement} 	ele    : text element
		 * @param {Number} 		cWidth : width of the viewport
		 */
		function addAutoScroll(ele, cWidth) {
			var textWidth = parseInt(window.getComputedStyle(ele).width);
			if (textWidth > cWidth) {
				// @todo
			}
		}

		/**
		 * render text with specified highlights into HTML
		 * @param  {String} txt : text input
		 * @param  {Array}	hls : indice array highlighted chars
		 * @param  {String}	tmpl : template, highlighted part is represented by %s
		 * @return {String}	HTML
		 */
		function renderHighlights(txt, hls, tmpl) {
			var newHTML = '',
				i, n, lastIdx,
				hlIdxStart, hlIdxEnd, hlStr;
			tmpl = tmpl || '<span class="highlight">%s</span>';
			lastIdx = 0;
			for (i = 0, n = hls.length;i < n;i++) {
				// merge adjacent highlights
				if (hlIdxStart > txt.length) break;
				hlIdxStart = hlIdxEnd = hls[i];
				hlStr = txt.charAt(hlIdxStart);
				while (hls[i+1] && hls[i+1] == hlIdxEnd + 1) {
					i++;
					hlIdxEnd++;
					hlStr += txt.charAt(hlIdxEnd);
				}
				newHTML += txt.slice(lastIdx, hlIdxStart);
				newHTML += tmpl.replace('%s', hlStr);
				lastIdx = hlIdxEnd + 1;
			}
			// append remaining text
			if (lastIdx < txt.length) {
				newHTML += txt.slice(lastIdx);
			}
			return newHTML;
		}

		/**
		 * [internal]
		 * get renderer for specified type, return default renderer if not found
		 * @param  {String}		rname : type
		 * @return {Function}	renderer
		 */
		Omnilist.prototype._getRenderer = function (rname) {
			var r = this.renderers[rname];
			return (r != undefined ? r : this.defaultRenderer);
		}

		/**
		 * [internal]
		 * update list selection
		 */
		Omnilist.prototype._updateSelection = function () {
			var self = this, i, n, curEntry,
				activeEl = self.listElements[self.selectedIndex];
			// classList API available in Chrome
			for (i = 0, n = self.listElements.length;i < n;i++) {
				curEntry = self.listElements[i];
				curEntry.classList.remove('active');
				//curEntry.querySelector('h3').style = "";
				//curEntry.querySelector('h4').style = "";
				self.dataEntries[i].selected = false;
			}
			var curTitle, curInfo, contentWidth,
				curHeight = parseInt(window.getComputedStyle(self.wrapper).height),
				curUlTop = parseInt(window.getComputedStyle(self.container).top);

			// height limit
			if (curHeight > self.maxHeight) {
				self.wrapper.style.height = self.maxHeight + 'px';
			}

			if (activeEl) {
				activeEl.classList.add('active');
				// horizontal auto-scrolling
				//curTitle = activeEl.querySelector('h3 span');
				//curInfo = activeEl.querySelector('h4 span');
				//contentWidth = parseInt(window.getComputedStyle(activeEl.childNodes[1]).width);
				//addAutoScroll(curTitle, contentWidth);
				//addAutoScroll(curInfo, contentWidth);

				self.dataEntries[self.selectedIndex].selected = true;

				var	curLiOffset = activeEl.offsetTop,
					curLiHeight = activeEl.offsetHeight;

				if (curLiOffset + curUlTop + curLiHeight > self.maxHeight) {
					self.container.style.top = (- curLiOffset - curLiHeight + self.maxHeight) + 'px';
				}
				if (curLiOffset + curUlTop < 0) {
					self.container.style.top = (- curLiOffset) + 'px';
				}
			}
			
		}

		/**
		 * add a single entry to the end of the list
		 * @param {Object} entry : data entry
		 */
		Omnilist.prototype.addEntry = function (entry) {
			var self = this, li, renderer, content;
			renderer = self._getRenderer(entry.type);
			content = renderer(entry);
			li = document.createElement('li');
			li.className = 'entry';
			li.innerHTML = content;
			self.container.appendChild(li);
			self.listElements.push(li);
			self.dataEntries.push(entry);
			self._updateSelection();
			return self;
		}

		/**
		 * add multiple entries to the list
		 * @param {Array} entries : array of entries
		 */
		Omnilist.prototype.addEntries = function (entries) {
			for (var i = 0,n = entries.length;i < n;i++) {
				this.addEntry(entries[i]);
			}
			return this;
		}

		/**
		 * replace specified entry with one or more list entries,
		 * best used for replacing a indicator entry with results
		 * @param  {Number} idx : entry index
		 * @param  {Array}	entries : new entries
		 */
		Omnilist.prototype.replaceEntryById = function (idx, entries) {
			var self = this;
			if (idx < 0 || idx > self.listElements.length) {
				throw new Error('Entry index out of range.');
			}
			if (!entries instanceof Array) {
				entries = [entries];
			}
			var i, n, li, renderer, content, newList,
				nextNode = self.container.childNodes[idx+1];
			for (i = 0, n = entries.length;i < n;i++) {
				renderer = self._getRenderer(entries[i].type);
				li = document.createElement('li');
				li.className = 'entry';
				li.innerHTML = renderer(entries[i]);
				if (nextNode) {
					self.container.insertBefore(li, nextNode);
				} else {
					self.container.appendChild(li);
				}
				self.listElements.splice(idx + i + 1, 0, li);
				self.dataEntries.splice(idx + i + 1, 0, entries[i]);
			}
			// delete replaced entry
			self.listElements[idx].remove()
			self.listElements.splice(idx, 1);
			self.dataEntries.splice(idx, 1);

			self._updateSelection();
			return self;
		}

		/**
		 * remove all entrys
		 */
		Omnilist.prototype.removeAllEntries = function () {
			var self = this, i, n;
			self.dataEntries = [];
			self.selectedIndex = 0;
			for (i = 0, n = self.listElements.length;i < n;i++) {
				self.container.removeChild(self.listElements[i]);
			}
			self.listElements = [];
			self.wrapper.style.height = 'auto';
			return self;
		}

		/**
		 * register a renderer for specified type
		 * @param  {String}   rname : type
		 * @param  {Function} fn : renderer
		 */
		Omnilist.prototype.registerRenderer = function (rname, fn) {
			this.renderers[rname] = fn;
			return this;
		};

		/**
		 * unregister a renderer
		 * @param  {String} rname : type
		 */
		Omnilist.prototype.unregisterRenderer = function (rname) {
			delete this.renderers[rname];
			return this;
		}

		/**
		 * append list to DOM element
		 * @param  {DOMElement} node
		 */
		Omnilist.prototype.appendTo = function (node) {
			node.appendChild(this.wrapper);
			return this;
		}

		/**
		 * select one of the entries, index will be clamped
		 * @param  {Number} idx : index
		 */
		Omnilist.prototype.select = function (idx) {
			this.selectedIndex = Math.min(Math.max(0, idx), this.listElements.length);
			this._updateSelection();
			return this;
		}

		Omnilist.prototype.selectNext = function () {
			this.select((this.selectedIndex + 1) % this.listElements.length);
			return this;
		}

		Omnilist.prototype.selectPrev = function () {
			this.select((this.selectedIndex > 0) ? this.selectedIndex - 1 : this.listElements.length - 1);
			return this;
		}


		Omnilist.prototype.getSelectedDataEntry = function () {
			return this.dataEntries[this.selectedIndex];
		}

		/**
		 * find the index of first entry with given type
		 * @param  {String} type : entry type
		 * @return {Numver}      index, -1 when not found
		 */
		Omnilist.prototype.getTypeOffset = function (type) {
			var i, n, idx = -1;
			for (i = 0, n = this.dataEntries.length;i < n;i++) {
				if (this.dataEntries[i].type == type) {
					idx = i;
					break;
				}
			}
			return idx;
		}

		/**
		 * find the index of specified list element in the omnilist
		 * @param  {DOMElement} listElement : li
		 * @return {Number}     index
		 */
		Omnilist.prototype.indexOf = function (listElement) {
			return this.listElements.indexOf(listElement);
		} 

		/**
		 * hide
		 */
		Omnilist.prototype.show = function () {
			if (!this.opened) {
				this.opened = true;
				this.wrapper.style.opacity = 1.0;
				this.wrapper.style.display = 'block';
			}
			return this;
		}

		/**
		 * show
		 */
		Omnilist.prototype.hide = function () {
			if (this.opened) {
				this.opened = false;
				this.wrapper.style.opacity = 0.0;
				this.wrapper.style.display = 'none';
			}
			return this;
		}

		return Omnilist;
	})();


	var transferApp = (function (KeyboardManager) {
		var exports = {},
			plugins = {},
			sortedPluginList = [],
			eventBus = new EventBus();

		var omnibox,
			omnilist;

		// ====================
		//  top level methods
		// ====================
		
		/**
		 * register a plugin, a valid plugin must have following properties and methods
		 * each plugin is assigned to an object, you may use "this" in the methods to
		 * access and store private information
		 * 	name : unique identifier, used as list type
		 * 	icon : icon displayed in the list item
		 * 	priority : a number between 0~1
		 * 	commandPlugin : whether this plugin is command plugin
		 * 	asyncProcessing : whether process is done asynchronously
		 * 	renderer : custom list item renderer, leave undefined to use default one
		 *  onProcess : will be called when user input updates, returns data entries
		 *  			to be added to the list. If asyncProcessing is true, it will
		 *  			be passed a boolean as the second argument to indicate the
		 *  			status of last async processing, and a function as the third
		 *  			parameter to fullfill the async callback and trigger rendering.
		 *  			e.g
		 *  			normal		: process(keyword)
		 *  			normal-async: process(keyword, doneProcessing, next)
		 *  			cmd			: process(arguments)
		 *  			cmd-async	: process(arguments, doneProcessing, next)
		 *  onExec   : will be called when user confirmed the action created by this
		 *  		   plugin. You can store additional information on each entry as
		 *  		   you like in processor so you can access them in the executor
		 *  onAbort  : For async processors, this function will be called if current
		 *  		   processing is ongoing and list update is cancelled. You should
		 *  		   terminate your async requests here.
		 * @param  {Object} plugin : plugin parameters
		 */
		exports.registerPlugin = function (plugin) {
			var newPlugin = plugins[plugin.name];
			if (newPlugin != undefined) {
				throw new Error('Plugin named "' + plugin.name + '" already exists.');
				return;
			}
			newPlugin = {};
			newPlugin.name = plugin.name;
			newPlugin.icon = plugin.icon || 'default';
			newPlugin.priority = Math.min(Math.max(0, plugin.priority), 1.0);
			newPlugin.process = plugin.onProcess;
			newPlugin.exec = plugin.onExec;
			newPlugin.init = plugin.init;
			newPlugin.asyncProcessing = plugin.asyncProcessing;
			newPlugin.commandPlugin = plugin.commandPlugin;
			if (plugin.commandPlugin) {
				newPlugin.command = plugin.command;
				newPlugin.commandS = plugin.commandS;
			}
			newPlugin.doneProcessing = true;
			if (plugin.renderer instanceof Function) {
				omnilist.registerRenderer(plugin.name, plugin.renderer);
			}
			if (newPlugin.init instanceof Function) {
				newPlugin.init();
			}
			if (newPlugin.asyncProcessing && plugin.onAbort instanceof Function) {
				newPlugin.abort = plugin.onAbort;
			}
			plugins[plugin.name] = newPlugin;
			sortedPluginList.push(newPlugin);
			sortedPluginList.sort(function (a, b) {
				return b.priority - a.priority;
			});
		};

		/**
		 * app initialization
		 */
		exports.init = function () {
			omnibox = new Omnibox();
			omnilist = new Omnilist();

			omnibox.appendTo(document.body);
			omnilist.appendTo(document.body);

			omnibox.eventBus.register('change', function (val) {
				var newEntries = [], curPlugin, i, n, fn, tmp,
					isCmd = false, isColon = false, cmd, args, skipFlag;
				val = val.trim();
				if (val&&val.length > 0) {
					if (val.charAt(0) == ':') {
						if (val.length > 1) {
							// process command line
							isCmd = true;
							val = val.slice(1).match(/[^"\s]+|"(?:[^"\\]|\\.)*"/g);
							cmd = val[0];
							val.shift();
							// remove quotes
							for (i = 0, n = val.length;i < n;i++) {
								tmp = val[i].length;
								if (val[i].charAt(0) == '"' && val[i].charAt(tmp-1) == '"') {
									val[i] = val[i].slice(1, tmp - 1);
								}
							}
						} else {
							isColon = true;
						}
					}
					if (!isColon) {
						n = sortedPluginList.length;
						// normal plugin - val is keyword
						// command plugin - val is argv
						for (i = 0;i < n;i++) {
							curPlugin = sortedPluginList[i];
							skipFlag = false;
							if (isCmd) {
								if (!(curPlugin.commandPlugin &&
									(curPlugin.command == cmd ||
									(curPlugin.commandS && curPlugin.commandS == cmd)))) {
									skipFlag = true;
								}
							} else {
								if (curPlugin.commandPlugin) {
									skipFlag = true;
								}
							}
							if (skipFlag) {
								if (curPlugin.asyncProcessing && !curPlugin.doneProcessing) {
									curPlugin.doneProcessing = true;
									curPlugin.abort();
								}
								continue;
							}
							if (curPlugin.asyncProcessing) {
								// closure to store reference to current plugin
								fn = (function () {
									var plugin = curPlugin;
									return function (asyncEntries) {
										asyncEntries.forEach(function (item) {
											item.type = plugin.name;
											item.icon = plugin.icon;
										});
										omnilist.replaceEntryById(omnilist.getTypeOffset(plugin.name), asyncEntries);
										plugin.doneProcessing = true;
									}
								})();
								tmp = curPlugin.process(val, curPlugin.doneProcessing, fn);
								if (tmp) {
									tmp.type = curPlugin.name;
									tmp.icon = tmp.icon || 'wait';
									newEntries.push(tmp);
								}
							} else {
								tmp = curPlugin.process(val);
								if (tmp) {
									tmp.forEach(function (item) {
										item.type = curPlugin.name;
										item.icon = curPlugin.icon;
									});
									newEntries = newEntries.concat(tmp);
								}
								curPlugin.doneProcessing = true;
							}
						}
					} else {
						newEntries.push({
							type : 'system',
							icon : 'settings',
							title : '进入命令模式，请在:后输入相应的指令',
							info : '例如输入“:top10”可以加载日月光华BBS今日十大'
						});
					}
					// update display
					omnilist.removeAllEntries()
							.addEntries(newEntries)
							.show();
				} else {
					omnilist.removeAllEntries()
							.hide();
				}
			});
			KeyboardManager.registerKeyCombo([90,191], function (ele) {
				if ((ele.tagName == 'INPUT' && ele.className.indexOf('transfer-ob-input') < 0) || ele.tagName == 'TEXTAREA') {
					return;
				}
				omnibox.clear().show();
			});
			KeyboardManager.registerSingleKey(KeyboardManager.KEYS.ESC, function () {
				omnibox.hide();
				omnilist.hide();
			});
			KeyboardManager.registerSingleKey(KeyboardManager.KEYS.UP, function (ele, e) {
				if (ele == omnibox.input) {
					e.preventDefault();
					e.stopPropagation();
					omnilist.selectPrev();
				}
			});
			KeyboardManager.registerSingleKey(KeyboardManager.KEYS.DOWN, function (ele, e) {
				if (ele == omnibox.input) {
					e.preventDefault();
					e.stopPropagation();
					omnilist.selectNext();
				}
			});
			KeyboardManager.registerSingleKey(KeyboardManager.KEYS.ENTER, function (ele, e) {
				if (ele == omnibox.input) {
					omnilist.hide();
					omnibox.hide();
					KeyboardManager.flush();
					var de = omnilist.getSelectedDataEntry();
					if (de) {
						plugins[de.type].exec(de);
					}
				}
			});
		}

		// ====================
		//       services
		// ====================
		exports.services = {};

		/**
		 * Perform ajax request similar to jQuery but with no promise
		 * @param  {Object} config
		 * @return {XMLHttpRequest Object}
		 */
		exports.services.ajax = function (config) {
			var xhr, serializedData, data, i, n;
			extend({
				method : 'get',
				dataType : 'text'
			}, config);
			xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {
						if (config.done instanceof Function) {
							switch (config.dataType) {
								case 'json':
									data = JSON.parse(xhr.responseText);
									break;
								case 'xml':
									data = xhr.responseXML;
									break;
								default:
									data = xhr.responseText;
							}
							config.done.call(xhr, data);
						}
					} else {
						if (config.fail instanceof Function) {
							config.fail.call(xhr, xhr.status);
						}
					}
				}
			}
			if (config.method == 'post') {
				if (config.data) {
					serializedData = [];
					for (var key in config.data) {
						serializedData.push(encodeURI(key) + '=' + encodeURI(config.data[key]));
					}
					serializedData = serializedData.join('&');
				} else {
					serializedData = '';
				}
				xhr.open('POST', config.url, true);
				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
			} else {
				xhr.open('GET', config.url, true);
			}
			xhr.send(serializedData);
			return xhr;
		}


		// utils
		exports.utils = {
			extend : extend,
			escapeHTML : escapeHTML,
			getUID : getUID,
			getBaseURL : getBaseURL,
			relativeTime : relativeTime
		};

		return exports;
	})(KeyboardManager);

	window.transferApp = transferApp;

	transferApp.init();

})();
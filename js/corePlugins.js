(function (app) {
	if (app == undefined) {
		throw new Error('App not found.');
	}
	// about
	app.registerPlugin({
		name : 'about',
		icon : 'default',
		priority : 1.0,
		commandPlugin : true,
		command : 'about',
		asyncProcessing : false,
		onProcess : function () {
			// do nothing
			return [{}];
		},
		renderer : function () {
			return '<div class="transfer-l-article">' +
				   '<p class="title">About this extension</p>' +
				   '<p>This is a improved version of my original extension which integrated STU transfer with Chrome. I completely rewrote the whole extension to make it more flexible to extend. Now all the functions including tab manager, BBS top10 viewer, are registered as plugins.</p>' +
				   '<p>By morriswmz</p>' +
				   '<p>This extension is released under MIT License.</p>' +
				   '<p>Icons are designed by <a href="http://www.visualpharm.com/">Visual Pharm</a></p>' +
				   '</div>';
		},
		onExec : function () {
			// do nothing
		}
	});

	// basic search plugin
	app.registerPlugin({
		name : 'search',
		icon : 'search',
		priority : 0,
		commandPlugin : false,
		asyncProcessing : false,
		onProcess : function (keyword) {
			var keyword = keyword || '',
				entries = [], i, n;

			var searchEngines = [
				{n:'Google', u:'http://www.google.com/search?q=%1'},
				{n:'百度', u:'http://www.baidu.com/s?wd=%1'},
				{n:'Bing', u:'http://www.bing.com/search?q=%1'}
			];
			for (i = 0, n = searchEngines.length;i < n;i++) {
				entries.push({
					title : '在' + searchEngines[i].n + '上搜索 ' + app.utils.escapeHTML(keyword),
					highlights : [],
					url : searchEngines[i].u.replace('%1', encodeURI(keyword)),
					info : '将在新标签页中显示' + searchEngines[i].n + '搜索结果。'
				});
			}
			return entries;
		},
		onExec : function (entry) {
			window.open(entry.url, '_newtab');
		}
	});

	// localdb plugin
	app.registerPlugin({
		name : 'localdb',
		icon : 'link',
		priority : 0.5,
		asyncProcessing : true,
		commandPlugin : false,
		onProcess : function (keyword, doneProcessing, next) {
			var self = this;
			self.lastCid = app.utils.getUID();
			chrome.extension.sendMessage({
				command : 'search-local',
				cid : self.lastCid,
				keyword : keyword
			}, function (res) {
				if (res.cid == self.lastCid) {
					next(res.payload);
				}
			});
			return {
				title : '正在查询符合条件的中转链接...',
				info : ''
			};
		},
		onAbort : function () {
			// do nothing
		},
		onExec : function (entry) {
			window.open(entry.url, '_newtab');
		}
	});

	// date plugin
	app.registerPlugin({
		name : 'date-plugin',
		icon : 'calender',
		priority : 0.8,
		asyncProcessing : false,
		commandPlugin : false,
		onProcess : function (keyword) {
			if (keyword == 'date' || keyword == 'time') {
				var now = new Date(),
					str = 'YYYY年MM月DD日 星期day',
					days = '日一二三四五六';
				str = str.replace('YYYY', now.getFullYear())
						 .replace('MM', now.getMonth()+1)
						 .replace('DD', now.getDate())
						 .replace('day', days.charAt(now.getDay()));
				return [{
					title : '当前日期：' + str,
					info : '按回车打开http://www.timeanddate.com/worldclock/'
				}];
			}
		},
		onExec : function (entry) {
			window.open('http://www.timeanddate.com/worldclock/', '_newtab');
		}
	});

	// bookmark plugin
	app.registerPlugin({
		name : 'bookmark-search',
		icon : 'bookmark',
		priority : 0.5,
		asyncProcessing : true,
		commandPlugin : false,
		onProcess : function (keyword, doneProcessing, next) {
			var self = this;
			self.lastCid = app.utils.getUID();
			chrome.extension.sendMessage({
				command : 'search-bookmark',
				cid : self.lastCid,
				keyword : keyword
			}, function (res) {
				if (res.cid == self.lastCid) {
					for (var i = 0, n = res.payload.length;i < n;i++) {
						res.payload[i].info = res.payload[i].url;
					}
					next(res.payload);
				}
			});
			return {
				title : '正在书签中搜索...',
				info : ''
			};
		},
		onAbort : function () {
			// do nothing
		},
		onExec : function (entry) {
			window.open(entry.url, '_newtab');
		}
	});

	// recent plugin
	app.registerPlugin({
		name : 'recent-closed',
		icon : 'history',
		priority : 0.2,
		asyncProcessing : true,
		commandPlugin : true,
		command : 'recent',
		commandS : 'r',
		onProcess : function (args, doneProcessing, next) {
			var self = this;
			self.lastCid = app.utils.getUID();
			chrome.extension.sendMessage({
				command : 'search-closed',
				cid : self.lastCid,
				keyword : args.join(' ')
			}, function (res) {
				if (res.cid == self.lastCid) {
					for (var i = 0, n = res.payload.length;i < n;i++) {
						res.payload[i].info = res.payload[i].url + ' [' +
											app.utils.relativeTime(res.payload[i].time) + 
											'前关闭]';;
					}
					next(res.payload);
				}
			});
			return {
				title : '正在搜索最近关闭的标签页...',
				info : ''
			};
		},
		onAbort : function () {
			// do nothing
		},
		onExec : function (entry) {
			window.open(entry.url, '_newtab');
		}
	});

	// tab manager plugin
	app.registerPlugin({
		name : 'tab-manager',
		icon : 'tab',
		priority : 0.2,
		asyncProcessing : true,
		commandPlugin : true,
		command : 'tab',
		commandS : 't',
		onProcess : function (args, doneProcessing, next) {
			var self = this;
			self.lastCid = app.utils.getUID();
			chrome.extension.sendMessage({
				command : 'search-opened',
				cid : self.lastCid,
				keyword : args.join(' ')
			}, function (res) {
				if (res.cid == self.lastCid) {
					for (var i = 0, n = res.payload.length;i < n;i++) {
						res.payload[i].info = res.payload[i].url;
					}
					next(res.payload);
				}
			});
			return {
				title : '正在检索打开的标签页...',
				info : ''
			};
		},
		onAbort : function () {
			// do nothing
		},
		onExec : function (entry) {
			chrome.extension.sendMessage({
				command : 'activate-tab',
				cid : app.utils.getUID(),
				tabId : entry.tabId
			});
		}
	});

	// math plugin
	app.registerPlugin({
		name : 'math',
		icon : 'calculator',
		priority : 0.8,
		asyncProcessing : true,
		commandPlugin : false,
		onProcess : function (keyword, doneProcessing, next) {
			var self = this;
			self.lastCid = app.utils.getUID();
			chrome.extension.sendMessage({
				command : 'do-math',
				cid : self.lastCid,
				keyword : keyword
			}, function (res) {
				if (res.cid == self.lastCid) {
					if (res.payload.success) {
						next([{
							title : res.payload.answer.toString(),
							info : '计算结果' 
						}]);
					} else {
						next([]);
					}
				}
			});
			return {
				title : '正在计算...',
				info : ''
			};
		},
		onAbort : function () {
			// do nothing
		},
		onExec : function (entry) {
			// do nothing
		}
	});

})(transferApp);
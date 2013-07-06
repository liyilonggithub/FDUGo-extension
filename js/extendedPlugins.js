(function (app) {
	if (app == undefined) {
		throw new Error('App not found.');
	}

	// bbs top 10 plugin
	app.registerPlugin({
		name : 'bbs-top10',
		icon : 'speech',
		priority : 0.2,
		asyncProcessing : true,
		commandPlugin : true,
		command : 'top10',
		onProcess : function (args, doneProcessing, next) {
			if (!doneProcessing) {
				if (this.xhr) {
					this.xhr.abort();
				}
			}
			this.xhr = app.services.ajax({
				url : 'http://bbs.fudan.edu.cn/bbs/top10',
				dataType : 'xml',
				done : function (xml) {
					var list, result = [];
					if (xml) {
						list = xml.querySelectorAll('top');
						for (var i = 0, n = list.length;i < n;i++) {
							result.push({
								title : (i+1).toString() + '. ' + list[i].textContent,
								info : '作者：%1 版面：%2 篇数：%3'.replace('%1', list[i].getAttribute('owner'))
																   .replace('%2', list[i].getAttribute('board'))
																   .replace('%3', list[i].getAttribute('count')),
								gid : parseInt(list[i].getAttribute('gid')),
								board : list[i].getAttribute('board')
							});
						}
					}
					next(result);
				},
				fail : function () {
					next([]);
				}
			});
			return {
				title : '正在加载今日十大...',
				info : '从bbs.fudan.edu.cn获取数据中'
			};
		},
		onAbort : function (entry) {
			if (this.xhr) {
				this.xhr.abort();
				this.xhr = undefined;
			}
		},
		onExec : function (entry) {
			var url = 'http://bbs.fudan.edu.cn/bbs/tcon?new=1&board=%1&f=%2';
			url = url.replace('%1', entry.board)
					 .replace('%2', entry.gid);
			window.open(url, '_newtab');
		}
	});

	// scholar
	app.registerPlugin({
		name : 'scholar',
		icon : 'book',
		priority : 0.4,
		commandPlugin : false,
		asyncProcessing : false,
		onProcess : function (keyword) {
			var newEntries = [];
			if (/^[\w\-\s]+$/.test(keyword)) {
				if (keyword.length >= 3) {
					newEntries.push({
						title : '在百度词典查询' + keyword + '的解释',
						info : 'http://dict.baidu.com/s?wd=' + encodeURI(keyword)
					});
					newEntries.push({
						title : '在Wikipedia上检索' + keyword,
						info : 'http://en.wikipedia.org/wiki/' + encodeURI(keyword)
					});
				}
				if (keyword.length > 8) {
					newEntries.push({
						title : '使用Google学术搜索查找与' + keyword + '相关的文献',
						info : 'http://scholar.google.com/scholar?q=' + encodeURI(keyword)
					});
				}
			}
			return newEntries;
		},
		onExec : function (entry) {
			window.open(entry.info, '_newtab');
		}
	});

})(transferApp);
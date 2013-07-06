(function () {
	// advanced search
	function advSearch(str, keyword) {
		var i, j, n, m, strl, keywords, flagArr, indices, lastIdx, p, matched, discount;
		str = str.toLowerCase();
		// init flag array
		strl = str.length;
		flagArr = [];
		for (i = 0;i < strl;i++) { flagArr[i] = false; }
		// get keywords
		keywords = keyword.replace(/[\/\.\?]/g, '').split(/ +/);
		m = keywords.length;
		// match
		indices = [];
		p = 0;
		for (i = 0;i < m;i++) {
			lastIdx = 0;
			n = keywords[i].length;
			if (n == 0) continue;
			discount = Math.pow(2.7182818, -i/m);
			while ((lastIdx = str.indexOf(keywords[i], lastIdx)) > -1)  {
				matched = false;
				for (j = 0;j < n;j++) {
					if (flagArr[j+lastIdx]) {
						matched = true;
						break;
					}
				}
				if (!matched) {
					for (j = 0;j < n;j++) {
						flagArr[j+lastIdx] = true;
						indices.push(j+lastIdx);
					}
					p += discount * (1.0 - 0.5 * lastIdx / strl);
				}
				lastIdx++;
			}
		}
		indices.sort(function (a, b) {
			return a - b;
		});
		return {
			found : indices.length > 0,
			indices : indices,
			weight : p
		}
	}

	// local db server
	var LocalDB = (function () {
		var exports = {},
			dbs = localDBData || {};

		exports.query = function (q, dbName, limit) {
			var db = dbs[dbName];
			if (!dbs) { return []; }

			var i, n = db.length,
				curEntry, resTitle, resS, resURL,
				arr = [];
			for (i = 0;i < n;i++) {
				curEntry = db[i];
				resTitle = advSearch(curEntry.t, q);
				resS = advSearch(curEntry.s, q);
				resURL = advSearch(curEntry.u, q);
				if (resTitle.found || resS.found || resURL.found) {
					arr.push({
						title : curEntry.t,
						url : curEntry.u,
						highlights : (resTitle.indices.length > 0) ? resTitle.indices : resS.indices,
						highlightsInfo : resURL.indices,
						weight : resTitle.weight + resS.weight + 0.8 * resURL.weight
					});
				}
			}
			arr.sort(function (a, b) {
				return b.weight - a.weight;
			});
			return arr.slice(0, limit);
		};

		return exports;
	})();

	// tab manager
	var TabManager = (function () {
		var exports = {},
			storageLimit = 100,
			openedTabs = [],
			closedTabs = [];

		function loadFromStorage() {
			var i, n = parseInt(localStorage['closedCount']);
			if (n > 0) {
				for (i = 0;i < n;i++) {
					closedTabs.push(JSON.parse(localStorage['tab' + i]));
				}
			}
		}

		function saveToStorage() {
			var i, n = closedTabs.length;
			localStorage['closedCount'] = n;
			for (i = 0;i < n;i++) {
				localStorage['tab' + i] = JSON.stringify(closedTabs[i]);
			}
		}

		function searchTabArray(tabArray, keyword, limit) {
			if (!keyword) {
				return tabArray.slice(0, limit);
			} else {
				var i, n = tabArray.length,
					arr = [], curTab, resTitle, resURL;
				for (i = 0;i < n;i++) {
					curTab = tabArray[i];
					resTitle = advSearch(curTab.title, keyword);
					resURL = advSearch(curTab.url, keyword);
					if (resTitle.found || resURL.found) {
						arr.push({
							title : curTab.title,
							tabId : curTab.tabId,
							url : curTab.url,
							time : curTab.time,
							highlights : resTitle.indices,
							highlightsInfo : resURL.indices,
							weight : resTitle.weight + resURL.weight
						});
					}
				}
				return arr.sort(function (a, b) {
					return b.weight - a.weight;
				}).slice(0, limit);
			}
		}

		function addClosed(tabInfo) {
			var i, n = closedTabs.length, idx = -1, old;
			for (i = 0;i < n;i++) {
				if (closedTabs[i].url == tabInfo.url) {
					idx = i;
					break;
				}
			}
			if (idx > -1) {
				old = closedTabs.splice(i, 1)[0];
				old.time = (new Date()).getTime();
				closedTabs.unshift(old);
			} else {
				if (n == storageLimit) {
					closedTabs.pop();
				}
				closedTabs.unshift({
					title : tabInfo.title,
					url : tabInfo.url,
					time : (new Date()).getTime()
				});
			}
			saveToStorage();
		}

		exports.updateOpened = function (tabId, tabInfo) {
			var i, n, found;
			if (!(/^http|https|ftp|mms/.test(tabInfo.url))) {
				return;
			}
			for (i = 0, n = openedTabs.length;i < n;i++) {
				if (openedTabs[i].tabId == tabId) {
					found = openedTabs[i];
					break;
				}
			}
			if (found) {
				found.title = tabInfo.title;
				found.url = tabInfo.url;	
			} else {
				openedTabs.push({
					tabId : tabId,
					title : tabInfo.title,
					url : tabInfo.url
				});
			}
		};

		exports.removeOpened = function (tabId) {
			var i, n, idx = -1;
			for (i = 0, n = openedTabs.length;i < n;i++) {
				if (openedTabs[i].tabId == tabId) {
					idx = i;
					break;
				}
			}
			if (idx > -1) {
				addClosed(openedTabs.splice(idx, 1)[0]);
			}
		};

		exports.searchClosed = function (keyword, limit) {
			return searchTabArray(closedTabs, keyword, limit);
		};

		exports.searchOpened = function (keyword, limit) {
			return searchTabArray(openedTabs, keyword, 20);
		};

		loadFromStorage();

		return exports;
	})();

	// bookmark manager
	var BookmarkManager = (function () {
		var exports = {};

		exports.search = function (query, limit, fn) {
			chrome.bookmarks.search(query, function (res) {
				var i, n = res.length, arr = [];
				for (i = 0;i < n;i++) {
					// ignore folders and javascripts
					if (res[i].url && res[i].url.charAt(0).toLowerCase() != 'j') {
						arr.push({
							title : res[i].title,
							url : res[i].url
						});
					}
				}
				fn.call(null, arr.slice(0, limit));
			});
		};

		return exports;
	})();

	// listen for events
	chrome.extension.onMessage.addListener(function (req, sender, sendRes) {
		//console.log('!');
		var response = {
			command : req.command,
			cid : req.cid
		};
		switch (req.command) {
			case 'search-local':
				response.payload = LocalDB.query(req.keyword, req.dbname || 'fudan', req.limit || 10);
				sendRes(response);
				break;
			case 'search-bookmark':
				BookmarkManager.search(req.keyword, req.limit || 20, function (arr) {
					response.payload = arr;
					sendRes(response);
				});
				break;
			case 'search-closed':
				response.payload = TabManager.searchClosed(req.keyword, req.limit || 10);
				sendRes(response);
				break;
			case 'search-opened':
				response.payload = TabManager.searchOpened(req.keyword, req.limit);
				sendRes(response);
				break;
			case 'activate-tab':
				chrome.tabs.update(req.tabId, {active : true});
				sendRes(response);
				break;
			case 'do-math':
				response.payload = {};
				if (!MathEvaluator) {
					response.payload.success = false;
				} else {
					var res = MathEvaluator.evaluate(req.keyword);
					if (res.success) {
						response.payload.success = true;
						response.payload.answer = res.answer;
					} else {
						response.payload.success = false;
					}
				}
				sendRes(response);
				break;
			default:
				response.errormsg = 'Unknown command';
				sendRes(response);
		}
		return true;
	});

	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
		TabManager.updateOpened(tabId, {
			title : tab.title,
			url : changeInfo.url || tab.url
		});
	});

	chrome.tabs.onRemoved.addListener(function (tabId) {
		TabManager.removeOpened(tabId);
	});

})();
console.log(`welcome to ${location.hostname}!`);

const runInitScripts = [
    // path prefix, document ready, page loaded:
    // ['/path/to/example/', initWhenFirstLoaded, initWhenPageLoaded]
];

/******************** site-wide focus reminder ********************/

function initFocusReminderGlobal() {
    if (document.querySelector('script[src="/static/focus-reminder-global.js"]')) {
        return;
    }
    gitsite.loadScript('/static/focus-reminder-global.js');
}

runInitScripts.push(['/', initFocusReminderGlobal, null]);

/******************** V6: search UX (keyboard + i18n + empty state) ********************/

function initSearchUX() {
    const input = document.getElementById('gsi-search-input');
    if (!input) return;
    // 中文占位符与可访问性
    input.placeholder = '搜索文章、笔记和工具…';
    input.setAttribute('aria-label', '站内搜索');
    input.type = 'search';

    let container = null;
    for (let el = input; el; el = el.parentElement) {
        if (el.classList && el.classList.contains('gsc-popup-container')) { container = el; break; }
    }
    const results = document.getElementById('gsi-search-results');

    // Esc 关闭搜索面板
    if (container) {
        container.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && window.gitsite && gitsite.hideSearch) {
                gitsite.hideSearch();
            }
        });
    }

    // 结果渲染增强：数量提示 + 空状态（观察主题渲染后的 DOM）
    if (results && 'MutationObserver' in window) {
        const mo = new MutationObserver(() => {
            const q = (input.value || '').trim();
            if (!q) return;
            const items = results.querySelectorAll(':scope > div');
            const hasEmpty = results.querySelector('.gsi-search-empty');
            if (items.length === 0 && results.children.length <= 1 && !hasEmpty) {
                results.innerHTML = '<div class="gsi-search-empty">没有找到相关内容，换个关键词试试</div>';
            } else if (items.length > 0 && !results.querySelector('.gsi-search-count')) {
                const count = document.createElement('div');
                count.className = 'gsi-search-count';
                count.textContent = `共 ${items.length} 条结果`;
                results.insertBefore(count, results.firstChild);
            }
        });
        mo.observe(results, { childList: true });
    }
}

runInitScripts.push(['/', initSearchUX, null]);

/******************** V8: nav active state for /static/* tools ********************/

function initNavActiveFix() {
    if (location.pathname.indexOf('/static/') !== 0) return;
    // 主题只按导航 uri 前缀匹配，/static/ 下的各工具页需要精确匹配
    document.querySelectorAll('#gsi-nav-menu li.gsc-nav-li a').forEach(a => {
        a.classList.remove('gsc-active');
        const href = a.getAttribute('href') || '';
        // 工具页路径带 /static/ 前缀，与导航 uri 前缀匹配
        if (href && href !== '#0' && href.indexOf('/static/') === 0 && location.pathname.indexOf(href) === 0) {
            a.classList.add('gsc-active');
        }
    });
}

runInitScripts.push(['/', initNavActiveFix, null]);

/******************** blog page views ********************/

function initBlogPageViews() {
    const info = document.querySelector('#gsi-blog-info');
    if (!info) {
        return;
    }

    let badge = info.querySelector('.gsi-blog-views');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'gsi-blog-views';
        badge.innerHTML = '<span class="gsi-blog-views-dot">·</span><span class="gsi-blog-views-text">浏览量读取中</span>';
        info.appendChild(badge);
    }

    const textEl = badge.querySelector('.gsi-blog-views-text');
    loadPageViewStats()
        .then((stats) => {
            const viewInfo = getCurrentPageViewInfo(stats);
            const views = viewInfo ? viewInfo.views : 0;
            textEl.textContent = `${views} 次浏览`;
        })
        .catch(() => {
            textEl.textContent = '浏览量暂不可用';
        });
}

function loadPageViewStats() {
    if (!window.__page_view_stats_promise__) {
        window.__page_view_stats_promise__ = fetch('/_analytics/stats.json', { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`stats request failed: ${response.status}`);
                }
                return response.json();
            });
    }
    return window.__page_view_stats_promise__;
}

function getCurrentPageViewInfo(stats) {
    const pageViews = stats && stats.pageViews ? stats.pageViews : {};
    for (const path of getCurrentPageViewCandidates()) {
        if (pageViews[path]) {
            return pageViews[path];
        }
    }
    return null;
}

function getCurrentPageViewCandidates() {
    const path = location.pathname || '/';
    const candidates = new Set([path]);
    if (path.endsWith('/index.html')) {
        candidates.add(path.slice(0, -'index.html'.length).replace(/\/$/, '') || '/');
        candidates.add(path.slice(0, -'index.html'.length));
    } else if (path.endsWith('/')) {
        candidates.add(path.slice(0, -1) || '/');
        candidates.add(`${path}index.html`);
    } else {
        candidates.add(`${path}/`);
        candidates.add(`${path}/index.html`);
    }
    return [...candidates];
}

runInitScripts.push(['/blogs/', initBlogPageViews, initBlogPageViews]);

/******************** copy code to clipboard ********************/

function initCopyCode() {
    let code_blocks = document.querySelectorAll('pre.hljs>code');
    if (code_blocks.length > 0) {
        console.log('init copy code...');
        let copy_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/></svg>';
        let copied_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/></svg>';
        for (let i = 0; i < code_blocks.length; i++) {
            let code_block = code_blocks[i];
            let pre = code_block.parentElement;
            let container = document.createElement('div');
            container.style.position = 'relative';
            pre.parentElement.insertBefore(container, pre);
            container.appendChild(pre);
            let copyButton = document.createElement('div');
            copyButton.style.position = 'absolute';
            copyButton.style.top = '8px';
            copyButton.style.right = '10px';
            copyButton.style.cursor = 'pointer';
            let a = document.createElement('a');
            a.innerHTML = copy_svg;
            a.title = '复制到剪贴板';
            a.href = 'javascript:void(0)';
            a.dataset.copied = '0';
            a.onclick = function () {
                if (a.dataset.copied === '1') {
                    return;
                }
                a.dataset.copied = '1';
                let code_block = copyButton.parentElement.querySelector('pre>code');
                navigator.clipboard.writeText(code_block.innerText || code_block.textContent).then(() => {
                    a.innerHTML = copied_svg;
                    a.title = '已复制';
                    setTimeout(() => {
                        a.dataset.copied = '0';
                        a.title = '复制到剪贴板';
                        a.innerHTML = copy_svg;
                    }, 2000);
                });
            };
            copyButton.appendChild(a);
            container.appendChild(copyButton);
        }
    }
}

runInitScripts.push(['/', initCopyCode, initCopyCode]);

/******************** auto load git explorer if link found ********************/

function initGitExplorer() {
    let git_links = document.querySelectorAll('#gsi-content a.git-explorer');
    if (git_links.length > 0) {
        console.log('load git explorer...');
        let create = function () {
            for (let i = 0; i < git_links.length; i++) {
                let git_link = git_links[i];
                let git_url = git_link.href;
                console.log(`process git link ${git_url}...`);
                createGitExplorer(git_link, git_url);
            }
        };
        gitsite.loadScript('/static/git-explorer.js', create);
    }
}

runInitScripts.push(['/', initGitExplorer, initGitExplorer]);

/******************** load script for blockchian ********************/

function initBlockchain() {
    gitsite.loadScript('/static/blockchain-lib.js');
}

runInitScripts.push(['/books/blockchain/', initBlockchain, null]);

/******************** load script for javascript ********************/

function initJqueryOrUnderscroll() {
    if (location.pathname.startsWith('/books/javascript/jquery/')) {
        gitsite.loadScript('/static/jquery.js');
    }
    if (location.pathname.startsWith('/books/javascript/underscore/')) {
        gitsite.loadScript('/static/underscore.js');
    }
}

runInitScripts.push(['/books/javascript/', initJqueryOrUnderscroll, initJqueryOrUnderscroll]);

/******************** load script for sql ********************/

function initSqlData() {
    alasql.options.joinstar = 'underscore';
    let
        i,
        classes_data = [['一班'], ['二班'], ['三班'], ['四班']],
        students_data = [[1, '小明', 'M', 90], [1, '小红', 'F', 95], [1, '小军', 'M', 88], [1, '小米', 'F', 73], [2, '小白', 'F', 81], [2, '小兵', 'M', 55], [2, '小林', 'M', 85], [3, '小新', 'F', 91], [3, '小王', 'M', 89], [3, '小丽', 'F', 88]];
    alasql('DROP TABLE IF EXISTS classes');
    alasql('DROP TABLE IF EXISTS students');
    alasql('CREATE TABLE classes (id BIGINT NOT NULL AUTO_INCREMENT, name VARCHAR(10) NOT NULL, PRIMARY KEY (id))');
    alasql('CREATE TABLE students (id BIGINT NOT NULL AUTO_INCREMENT, class_id BIGINT NOT NULL, name VARCHAR(10) NOT NULL, gender CHAR(1) NOT NULL, score BIGINT NOT NULL, PRIMARY KEY (id))');
    for (i = 0; i < classes_data.length; i++) {
        alasql('INSERT INTO classes (name) VALUES (?)', classes_data[i]);
    }
    for (i = 0; i < students_data.length; i++) {
        alasql('INSERT INTO students (class_id, name, gender, score) VALUES (?, ?, ?, ?)', students_data[i]);
    }
}

function initSql() {
    gitsite.loadScript('/static/alasql.js', initSqlData);
}

runInitScripts.push(['/books/sql/', initSql, initSqlData]);

/******************** auto load x-lang ********************/

async function exec_sql(code) {
    if (typeof (alasql) === undefined) {
        throw 'JavaScript嵌入式SQL引擎尚未加载完成，请稍后再试或者刷新页面！';
    }
    const genTable = function (rs) {
        if (rs.length === 0) {
            return '<pre><code>empty result set</pre></code>';
        }
        let keys = Object.keys(rs[0]);
        let ths = keys.map(th => {
            let n = th.indexOf('!');
            if (n >= 0) {
                th = th.substring(n + 1);
            }
            return '<th>' + gitsite.encodeHtml(th) + '</th>';
        });
        let trs = rs.map(row => {
            let tds = keys.map(key => {
                let v = row[key];
                if (v === undefined || v === null) {
                    v = 'NULL';
                }
                return '<td>' + gitsite.encodeHtml(String(v)) + '</td>';
            });
            return '<tr>' + tds.join('') + '</tr>';
        });
        return `<table><thead><tr>${ths.join('')}</tr></thead><tbody>${trs.join('')}</tbody></table>`;
    };
    // format lines:
    let lines = code.split('\n')
        .map( // remove comment
            line => {
                let n = line.indexOf('--');
                if (n >= 0) {
                    line = line.substring(0, n);
                }
                return line;
            })
        .join('\n')
        .split(';')
        .map(line => line.trim().replace(/[\s\n]+/g, ' '))
        .filter(line => line !== ''); // remove empty line
    console.log(lines);
    // execute each line:
    let results = [];
    for (let line of lines) {
        let result = '';
        try {
            let rs = alasql(line);
            if (Array.isArray(rs)) {
                result = genTable(rs);
            } else {
                result = '<pre><code>' + gitsite.encodeHtml(String(rs)) + '</code></pre>';
            }
        } catch (err) {
            result = '<pre><code>' + gitsite.encodeHtml(String(err)) + '</code></pre>';
        }
        results.push('<pre><code>&gt;&nbsp;' + gitsite.encodeHtml(line) + '</code></pre>');
        results.push(result);
    }
    return {
        html: true,
        output: results.join('')
    };
}

async function exec_javascript(code) {
    // we must capture console.log / console.error / ...:
    const { fn_log, fn_error, fn_warn, fn_debug, fn_trace, fn_info } = console;
    let buffer = '';
    let _log = function (...args) {
        console.log(...args);
        buffer = buffer + args.map(String).join(' ') + '\n';
    };
    let _warn = function (...args) {
        console.warn(...args);
        buffer = buffer + args.map(String).join(' ') + '\n';
    };
    let _error = function (...args) {
        console.error(...args);
        buffer = buffer + args.map(String).join(' ') + '\n';
    };
    _console = {
        trace: _log,
        debug: _log,
        log: _log,
        info: _log,
        warn: _warn,
        error: _error
    };
    try {
        eval('(function () { const console=_console;\n' + code + '\n})();');
    } catch (err) {
        buffer = buffer + String(err);
        return {
            error: true,
            output: buffer
        };
    }
    return {
        output: buffer
    };
}

function try_exec_code(btn) {
    let form = btn.parentElement.parentElement;
    let lang = form.getAttribute('data-lang');
    console.log(`try execute ${lang}...`);
    // get code:
    let codeText = form.querySelector('textarea').value;
    console.log('try code:\n' + codeText);
    // get element:
    let svgIdle = btn.querySelector('svg.exec-form-icon-idle');
    let svgBusy = btn.querySelector('svg.exec-form-icon-busy');
    let divResult = form.querySelector('div.exec-form-result');
    // start run:
    divResult.style.display = 'none';
    divResult.innerHTML = '';
    svgIdle.style.display = 'none';
    svgBusy.style.display = 'inline';
    btn.disabled = true;
    const setResult = (result) => {
        svgIdle.style.display = 'inline';
        svgBusy.style.display = 'none';
        btn.disabled = false;
        divResult.style.display = 'block';
        if (result.html) {
            // this is a html fragment:
            divResult.innerHTML = result.output || '<pre><code>(no output)</code></pre>';
        } else {
            divResult.innerHTML = '<pre><code></code></pre>';
            divResult.querySelector('code').innerText = result.output || '(no output)';
        }
    };
    setTimeout(() => {
        // run async function:
        let asyncExecFn = window[`exec_${lang}`];
        asyncExecFn(codeText)
            .then(result => {
                setResult(result);
            })
            .catch(err => {
                setResult({
                    error: true,
                    html: false,
                    output: (err || 'Error').toString()
                });
            });
    }, 200);
}

function initExecLang() {
    let codes = document.querySelectorAll('#gsi-content pre.hljs>code[class^="language-x-"]');
    if (codes.length === 0) {
        return;
    }
    const AsyncFunction = (async () => { }).constructor;
    codes.forEach(code => {
        let lang = code.className.substring(11); // 'codeLage-x-'
        if (!lang) {
            console.error(`invalid code class: ${code.className}`);
            return;
        }
        if (!window._next_output_id_) {
            window._next_output_id_ = 1;
        } else {
            window._next_output_id_++;
        }
        let outputId = 'exec-result-' + window._next_output_id_;
        let codeExecFn = window[`exec_${lang}`];
        if (typeof (codeExecFn) !== 'function' || !(codeExecFn instanceof AsyncFunction)) {
            console.error(`async function exec_${lang} not defined.`);
            return;
        }
        // get text:
        let codeText = code.innerText || code.textContent;
        // create form:
        let formHtml = `
<form data-lang="${lang}" class="exec-form" style="margin: 16px 0;" onsubmit="return false">
    <div>
        <textarea class="exec-form-textarea" name="comment" id="comment" class="" style="margin-top: 0; width:100%; height:260px; resize:vertical; font-family:Menlo,Consolas,Monaco,'Courier New',monospace;"></textarea>
    </div>
    <div>
        <button class="exec-form-button" type="button" onclick="try_exec_code(this, '${outputId}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="exec-form-icon-idle" width="20" height="20" fill="currentColor" style="display:inline" viewBox="0 0 16 16"><path d="M10.804 8 5 4.633v6.734zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696z"/></svg>
            <svg xmlns="http://www.w3.org/2000/svg" class="exec-form-icon-busy" width="20" height="20" fill="currentColor" stroke="currentColor" style="display:none" viewBox="0 0 100 100"><g><circle stroke-dasharray="141.37166941154067 49.12388980384689" r="30" stroke-width="6" fill="none" cy="50" cx="50"><animateTransform keyTimes="0;1" values="0 50 50;360 50 50" dur="1s" repeatCount="indefinite" type="rotate" attributeName="transform"></animateTransform></circle><g></g></g></svg>
            Run
        </button>
    </div>
    <div id="${outputId}" class="exec-form-result" style="display:none">
        <pre><code></code></pre>
    </div>
</form>
`;
        let div = document.createElement('div');
        div.innerHTML = formHtml;
        let pre = code.parentElement;
        pre.style.display = 'none';
        pre.after(div);
        div.querySelector('textarea').value = codeText;
    });
}

runInitScripts.push(['/', initExecLang, initExecLang]);

/******************** some dynamic script ********************/

function initDynamicScript() {
    let t = parseInt(Date.now() / 3600000);
    gitsite.loadScript(`https://youkechuang-dynamic-1251042815.cos.ap-shanghai.myqcloud.com/js/dynamic.js?t=${t}`, null, true);
}

runInitScripts.push(['/', initDynamicScript, null]);

// run init scripts when not in pdf mode:
if (!window.__pdf__) {
    for (let i = 0; i < runInitScripts.length; i++) {
        let [pathPrefix, initOnDocumentReady, initWhenContentChanged] = runInitScripts[i];
        if (location.pathname.startsWith(pathPrefix)) {
            initOnDocumentReady && documentReady(initOnDocumentReady);
            initWhenContentChanged && gitsite.addContentChangedListener(initWhenContentChanged);
        }
    }
}

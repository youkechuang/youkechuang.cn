# 首页

<section class="home-hero">
    <div class="home-hero-copy">
        <p class="home-eyebrow">尤科闯的官方网站</p>
        <h1>记录生活、学习和正在做的事。</h1>
        <p>这里收录我的长期写作、人生记录，以及边学边做的实用工具。先从最新文章认识我，也可以直接体验地图学习和效率工具。</p>
        <div class="home-actions">
            <a href="/blogs/all/index.html">看全部文章</a>
            <a href="/static/maphub/index.html">玩地图学习</a>
        </div>
    </div>
    <div class="home-hero-side" aria-live="polite">
        <span>内容档案</span>
        <strong id="homeBlogCount">加载中</strong>
        <small id="homeLatestDate">正在读取最近更新时间</small>
    </div>
</section>

<section class="home-section" id="home-about">
    <div class="home-about">
        <div class="home-about-copy">
            <p class="home-eyebrow">关于我</p>
            <h2>写作、工程与产品</h2>
            <p>我是尤科闯，长期记录生活与思考，也喜欢动手把想法变成能用的工具。这里有三条主线：用文字梳理经历与认知，用工程解决实际问题，用产品思维做小而有用的东西。</p>
            <div class="home-about-tags">
                <span>长期写作</span>
                <span>人生记录</span>
                <span>产品思考</span>
                <span>效率工具</span>
                <span>地图学习</span>
            </div>
        </div>
        <div class="home-about-cards">
            <a class="home-about-card" href="/static/life-journey/index.html">
                <strong>人生足迹</strong>
                <p>按时间线回看我走过的地方与经历。</p>
            </a>
            <a class="home-about-card" href="/blogs/all/index.html">
                <strong>精选文章</strong>
                <p>从育儿到产品，从英语到 AI，持续输出。</p>
            </a>
            <a class="home-about-card" href="/static/startup/index.html">
                <strong>正在做的事</strong>
                <p>探索中的产品、App、工具和原型项目。</p>
            </a>
        </div>
    </div>
</section>

<section class="home-section">
    <div class="home-section-head">
        <p class="home-eyebrow">主要入口</p>
        <h2>从这里开始</h2>
    </div>
    <div class="home-entry-grid">
        <a class="home-entry-card is-large" href="/books/onethird/index.html">
            <img src="/static/cover/ykc_coffee.jpg" alt="我的1/3人生封面" decoding="async" />
            <span>人生记录</span>
            <strong>我的1/3人生</strong>
            <p>整理个人经历、阶段复盘和长期观察。</p>
        </a>
        <a class="home-entry-card" href="/blogs/all/index.html">
            <img src="/static/cover/flower_sea.jpg" alt="博客封面" loading="lazy" decoding="async" />
            <span>文章</span>
            <strong>我的博客</strong>
            <p>记录最近的思考、学习、产品和生活更新。</p>
        </a>
        <a class="home-entry-card" href="/static/maphub/index.html">
            <img src="/static/cover/maphub-cover.svg" alt="地图学习入口" loading="lazy" decoding="async" />
            <span>学习工具</span>
            <strong>省份真实地图游戏</strong>
            <p>通过预习、每日挑战、错题复习来记住中国省级行政区。</p>
        </a>
        <a class="home-entry-card" href="/static/focus/index.html">
            <img src="/static/cover/focus-cover.svg" alt="15分钟计划记录入口" loading="lazy" decoding="async" />
            <span>效率工具</span>
            <strong>15分钟计划记录</strong>
            <p>填写今日计划，每 15 分钟记录一次实际做了什么，数据只存在本地。</p>
        </a>
        <a class="home-entry-card" href="/static/startup/index.html">
            <img src="/static/cover/startup-cover.svg" alt="创业专题入口" loading="lazy" decoding="async" />
            <span>创业专题</span>
            <strong>项目文档中心</strong>
            <p>集中整理正在探索的产品、App、工具和原型项目文档。</p>
        </a>
        <a class="home-entry-card" href="/static/docs/product.html">
            <img src="/static/cover/docs-cover.svg" alt="产品文档入口" loading="lazy" decoding="async" />
            <span>文档</span>
            <strong>网站产品文档</strong>
            <p>查看本站定位、功能模块、部署流程和后续规划。</p>
        </a>
    </div>
</section>

<section class="home-section">
    <div class="home-section-head home-section-head-row">
        <div>
            <p class="home-eyebrow">最近更新</p>
            <h2>最新发表的博客文章</h2>
        </div>
        <a class="home-section-more" href="/blogs/all/index.html">查看全部文章</a>
    </div>
    <div id="home-blog-list" class="home-blog-list" aria-busy="true"></div>
    <noscript><p class="home-blog-empty">请启用 JavaScript 查看最新文章，或直接进入<a href="/blogs/all/index.html">博客目录</a>。</p></noscript>
</section>

<script>
    // V2: 滚动入场动效（IntersectionObserver，降级安全）
    documentReady(function () {
        if (!('IntersectionObserver' in window) ||
            window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.documentElement.classList.add('no-anim');
            return;
        }
        const targets = document.querySelectorAll('.home-hero, .home-section');
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) {
                    e.target.classList.add('is-in');
                    io.unobserve(e.target);
                }
            }
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        targets.forEach(t => io.observe(t));
    });

    documentReady(async ()=>{
        const countEl = document.getElementById('homeBlogCount');
        const latestDateEl = document.getElementById('homeLatestDate');
        const listEl = document.getElementById('home-blog-list');
        try {
            const resp = await fetch('/blogs/all/index.json');
            if (!resp.ok) throw new Error('文章索引加载失败');
            const blogs = await resp.json();
            countEl.textContent = `${blogs.length} 篇内容`;
            if (blogs.length > 0) {
                const newest = new Date(blogs[0].date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
                latestDateEl.textContent = `最近更新于 ${newest}`;
            } else {
                latestDateEl.textContent = '新内容正在整理中';
            }
            const items = blogs.slice(0, 6).map(blog => {
                const date = new Date(blog.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
                return `
<a class="home-blog-list-item" href="${blog.uri}">
    <time datetime="${blog.date}">${date}</time>
    <strong>${gitsite.encodeHtml(blog.title)}</strong>
    <span class="home-blog-arrow" aria-hidden="true">↗</span>
</a>`;
            });
            listEl.innerHTML = items.join('') || '<p class="home-blog-empty">新文章正在整理中。</p>';
        } catch (error) {
            countEl.textContent = '持续更新中';
            latestDateEl.textContent = '文章列表暂时无法加载';
            listEl.innerHTML = '<p class="home-blog-empty">暂时无法读取最新文章，请前往<a href="/blogs/all/index.html">博客目录</a>查看。</p>';
        } finally {
            listEl.setAttribute('aria-busy', 'false');
        }
    });
</script>

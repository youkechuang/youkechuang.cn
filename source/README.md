# 首页

<section class="home-hero">
    <div class="home-hero-copy">
        <p class="home-eyebrow">尤科闯的官方网站</p>
        <h2>记录生活、学习和正在做的事。</h2>
        <p>这里会持续整理我的文章、人生记录、学习工具和网站建设过程。内容不追求复杂，重点是清楚、有用、能长期更新。</p>
        <div class="home-actions">
            <a href="/blogs/all/index.html">看全部文章</a>
            <a href="/static/maphub/index.html">玩地图学习</a>
        </div>
    </div>
    <div class="home-hero-side">
        <span>持续更新</span>
        <strong id="homeBlogCount">读取中</strong>
        <small>公开文章与页面会逐步整理到这里</small>
    </div>
</section>

<section class="home-section">
    <div class="home-section-head">
        <p class="home-eyebrow">主要入口</p>
        <h3>从这里开始</h3>
    </div>
    <div class="home-entry-grid">
        <a class="home-entry-card is-large" href="/books/onethird/index.html">
            <img src="/static/cover/ykc_coffee.jpg" alt="我的1/3人生封面" />
            <span>人生记录</span>
            <strong>我的1/3人生</strong>
            <p>整理个人经历、阶段复盘和长期观察。</p>
        </a>
        <a class="home-entry-card" href="/blogs/all/index.html">
            <img src="/static/cover/flower_sea.jpg" alt="博客封面" />
            <span>文章</span>
            <strong>我的博客</strong>
            <p>记录最近的思考、学习、产品和生活更新。</p>
        </a>
        <a class="home-entry-card" href="/static/maphub/index.html">
            <img src="/static/cover/flower.jpg" alt="地图学习入口" />
            <span>学习工具</span>
            <strong>省份真实地图游戏</strong>
            <p>通过预习、每日挑战、错题复习来记住中国省级行政区。</p>
        </a>
        <a class="home-entry-card" href="/static/focus/index.html">
            <img src="/static/cover/default.jpg" alt="15分钟计划记录入口" />
            <span>效率工具</span>
            <strong>15分钟计划记录</strong>
            <p>填写今日计划，每 15 分钟记录一次实际做了什么，数据只存在本地。</p>
        </a>
        <a class="home-entry-card" href="/static/startup/index.html">
            <img src="/static/cover/default.jpg" alt="创业专题入口" />
            <span>创业专题</span>
            <strong>项目文档中心</strong>
            <p>集中整理正在探索的产品、App、工具和原型项目文档。</p>
        </a>
        <a class="home-entry-card" href="/static/docs/product.html">
            <img src="/static/cover/default.jpg" alt="产品文档入口" />
            <span>文档</span>
            <strong>网站产品文档</strong>
            <p>查看本站定位、功能模块、部署流程和后续规划。</p>
        </a>
    </div>
</section>

<section class="home-section">
    <div class="home-section-head">
        <p class="home-eyebrow">最近更新</p>
        <h3>最新发表的博客文章</h3>
    </div>
    <div id="home-blog-list" class="home-blog-list"></div>
</section>

<script>
    documentReady(async ()=>{
        const resp = await fetch('/blogs/all/index.json');
        let blogs = await resp.json();
        const countEl = document.getElementById('homeBlogCount');
        if (countEl) {
            countEl.textContent = `${blogs.length} 篇内容`;
        }
        if (blogs.length > 12) {
            blogs = blogs.slice(0, 12);
        }
        const items = blogs.map(blog => {
            let date = new Date(blog.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            return `
<a class="home-blog-list-item" href="${blog.uri}">
    <span>${date}</span>
    <strong>${gitsite.encodeHtml(blog.title)}</strong>
</a>`;
        });
        document.getElementById('home-blog-list').innerHTML = items.join('');
    });
</script>

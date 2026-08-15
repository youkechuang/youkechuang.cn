#!/usr/bin/env python3
import html
import ipaddress
import json
import re
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


LOG_PATTERN = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] '
    r'"(?P<method>\S+) (?P<path>\S+) (?P<protocol>[^"]+)" '
    r'(?P<status>\d{3}) (?P<body_bytes>\S+) '
    r'"(?P<referer>[^"]*)" "(?P<ua>[^"]*)"'
)

ASSET_EXTENSIONS = {
    ".css",
    ".js",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".webp",
    ".woff",
    ".woff2",
    ".ttf",
    ".map",
    ".json",
    ".xml",
    ".txt",
}


def parse_args():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: analytics_report.py <access.log> <output-dir>")
    return Path(sys.argv[1]), Path(sys.argv[2])


def resolve_log_path(log_path):
    if log_path.exists() and log_path.stat().st_size > 0:
        return log_path
    fallback = log_path.with_name("youkechuang.access.log")
    if fallback.exists() and fallback.stat().st_size > 0:
        return fallback
    return log_path


def normalize_path(raw_path):
    path = raw_path.split("?", 1)[0]
    if not path.startswith("/"):
        return None
    if path.startswith("/_analytics/"):
        return None
    suffix = Path(path).suffix.lower()
    if suffix in ASSET_EXTENSIONS:
        return None
    if path.endswith("/index.html"):
        path = path[: -len("index.html")]
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return path or "/"


def parse_nginx_time(value):
    try:
        return datetime.strptime(value, "%d/%b/%Y:%H:%M:%S %z")
    except ValueError:
        return None


def read_events(log_path):
    if not log_path.exists():
        return []

    events = []
    with log_path.open("r", encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            match = LOG_PATTERN.match(line.strip())
            if not match:
                continue
            status = int(match.group("status"))
            if status >= 400:
                continue
            path = normalize_path(match.group("path"))
            if not path:
                continue
            method = match.group("method")
            if method not in {"GET", "HEAD"}:
                continue
            timestamp = parse_nginx_time(match.group("time"))
            events.append(
                {
                    "ip": match.group("ip"),
                    "path": path,
                    "status": status,
                    "time": timestamp,
                    "ua": match.group("ua"),
                    "referer": match.group("referer"),
                }
            )
    return events


def is_private_ip(ip):
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
    )


def default_geo(ip):
    label = "内网/本机" if is_private_ip(ip) else "未知地区"
    return {
        "ip": ip,
        "country": label,
        "region": "",
        "city": "",
        "isp": "",
        "label": label,
    }


def load_geo_cache(cache_path):
    if not cache_path.exists():
        return {}
    try:
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_geo_cache(cache_path, cache):
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def query_geo_batch(ips):
    if not ips:
        return {}

    payload = json.dumps(
        [
            {
                "query": ip,
                "fields": "status,message,country,regionName,city,isp,query",
                "lang": "zh-CN",
            }
            for ip in ips
        ]
    ).encode("utf-8")
    request = urllib.request.Request(
        "http://ip-api.com/batch",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return {}

    locations = {}
    for item in result if isinstance(result, list) else []:
        ip = item.get("query")
        if not ip or item.get("status") != "success":
            continue
        country = item.get("country") or "未知国家"
        region = item.get("regionName") or ""
        city = item.get("city") or ""
        label_parts = [part for part in [country, region, city] if part]
        locations[ip] = {
            "ip": ip,
            "country": country,
            "region": region,
            "city": city,
            "isp": item.get("isp") or "",
            "label": " / ".join(label_parts) or country,
        }
    return locations


def resolve_geo(events, output_dir):
    cache_path = output_dir.parent / "geo_cache.json"
    cache = load_geo_cache(cache_path)
    ips = sorted({event["ip"] for event in events})
    missing_public_ips = [
        ip for ip in ips if ip not in cache and not is_private_ip(ip)
    ][:100]

    fetched = query_geo_batch(missing_public_ips)
    if fetched:
        cache.update(fetched)
        save_geo_cache(cache_path, cache)

    return {ip: cache.get(ip, default_geo(ip)) for ip in ips}


def parse_device(ua):
    text = ua or ""
    lower = text.lower()

    if "bot" in lower or "spider" in lower or "crawler" in lower:
        device_type = "爬虫/机器人"
    elif "ipad" in lower or "tablet" in lower:
        device_type = "平板"
    elif "mobile" in lower or "iphone" in lower or "android" in lower:
        device_type = "手机"
    else:
        device_type = "电脑"

    if "iphone" in lower or "ipad" in lower or "ios" in lower:
        os_name = "iOS"
    elif "android" in lower:
        os_name = "Android"
    elif "mac os x" in lower or "macintosh" in lower:
        os_name = "macOS"
    elif "windows" in lower:
        os_name = "Windows"
    elif "linux" in lower:
        os_name = "Linux"
    else:
        os_name = "未知系统"

    if "edg/" in lower:
        browser = "Edge"
    elif "crios/" in lower:
        browser = "Chrome iOS"
    elif "chrome/" in lower and "chromium" not in lower:
        browser = "Chrome"
    elif "firefox/" in lower:
        browser = "Firefox"
    elif "safari/" in lower and "chrome/" not in lower and "crios/" not in lower:
        browser = "Safari"
    elif "curl/" in lower:
        browser = "curl"
    elif "bot" in lower or "spider" in lower or "crawler" in lower:
        browser = "Bot"
    else:
        browser = "未知浏览器"

    brand = parse_device_brand(text, lower, os_name, browser)

    return {
        "type": device_type,
        "os": os_name,
        "browser": browser,
        "brand": brand,
        "label": f"{device_type} / {brand} / {os_name} / {browser}",
    }


def parse_device_brand(text, lower, os_name, browser):
    if browser == "Bot":
        return "爬虫/机器人"
    if os_name in {"iOS", "macOS"}:
        return "Apple"
    if "samsung" in lower or "sm-" in lower or "gt-" in lower:
        return "Samsung"
    if "xiaomi" in lower or "redmi" in lower or "poco" in lower or re.search(r"\bmi\s", lower):
        return "Xiaomi"
    if "huawei" in lower or "honor" in lower:
        return "Huawei/Honor"
    if "oppo" in lower or "cpH".lower() in lower:
        return "OPPO"
    if "vivo" in lower:
        return "vivo"
    if "oneplus" in lower:
        return "OnePlus"
    if "realme" in lower:
        return "realme"
    if "pixel" in lower:
        return "Google Pixel"
    if "motorola" in lower or "moto " in lower:
        return "Motorola"
    if "lenovo" in lower:
        return "Lenovo"
    if "zte" in lower:
        return "ZTE"
    if "nokia" in lower:
        return "Nokia"
    if "sony" in lower:
        return "Sony"
    if "meizu" in lower:
        return "Meizu"
    if "asus" in lower:
        return "ASUS"
    if "windows" in lower or os_name in {"Windows", "Linux"}:
        return "未知电脑品牌"
    if "android" in lower:
        model_match = re.search(r"android[^;)]*[;)]\s*([^;)]+)", text, re.IGNORECASE)
        if model_match:
            model = model_match.group(1).strip()
            model_lower = model.lower()
            if (
                model
                and not model_lower.startswith(("wv", "mobile", "build"))
                and not re.fullmatch(r"[a-z]{2}[-_][a-z]{2}", model_lower)
            ):
                return f"未知安卓品牌（{model[:24]}）"
        return "未知安卓品牌"
    return "未知品牌"


def render_html(events):
    generated_at = datetime.now(timezone.utc).astimezone()
    total_views = len(events)
    unique_ips = len({event["ip"] for event in events})

    page_views = Counter(event["path"] for event in events)
    page_ips = defaultdict(set)
    day_views = Counter()
    day_ips = defaultdict(set)
    hour_views = Counter()
    hour_ips = defaultdict(set)
    country_views = Counter()
    country_ips = defaultdict(set)
    location_views = Counter()
    location_ips = defaultdict(set)
    device_views = Counter()
    device_ips = defaultdict(set)
    os_views = Counter()
    os_ips = defaultdict(set)
    browser_views = Counter()
    browser_ips = defaultdict(set)
    brand_views = Counter()
    brand_ips = defaultdict(set)
    recent_events = []
    geo_by_ip = getattr(render_html, "geo_by_ip", {})

    for event in events:
        page_ips[event["path"]].add(event["ip"])
        geo = geo_by_ip.get(event["ip"], default_geo(event["ip"]))
        country_views[geo["country"]] += 1
        country_ips[geo["country"]].add(event["ip"])
        location_views[geo["label"]] += 1
        location_ips[geo["label"]].add(event["ip"])
        device = parse_device(event["ua"])
        device_views[device["type"]] += 1
        device_ips[device["type"]].add(event["ip"])
        os_views[device["os"]] += 1
        os_ips[device["os"]].add(event["ip"])
        browser_views[device["browser"]] += 1
        browser_ips[device["browser"]].add(event["ip"])
        brand_views[device["brand"]] += 1
        brand_ips[device["brand"]].add(event["ip"])
        if event["time"]:
            local_time = event["time"].astimezone()
            day_key = local_time.date().isoformat()
            hour_key = local_time.strftime("%Y-%m-%d %H:00")
            day_views[day_key] += 1
            day_ips[day_key].add(event["ip"])
            hour_views[hour_key] += 1
            hour_ips[hour_key].add(event["ip"])

    for event in reversed(events[-80:]):
        recent_events.append(event)

    top_pages = page_views.most_common(100)
    top_days = sorted(day_views.items(), reverse=True)[:30]
    recent_days = sorted(day_views.items())[-14:]
    recent_hours = sorted(hour_views.items())[-24:]
    top_countries = country_views.most_common(50)
    top_locations = location_views.most_common(100)
    top_devices = device_views.most_common(20)
    top_systems = os_views.most_common(20)
    top_browsers = browser_views.most_common(20)
    top_brands = brand_views.most_common(30)

    page_rows = "\n".join(
        f"<tr><td><a href=\"{html.escape(path)}\">{html.escape(path)}</a></td>"
        f"<td>{views}</td><td>{len(page_ips[path])}</td></tr>"
        for path, views in top_pages
    )
    day_rows = "\n".join(
        f"<tr><td>{html.escape(day)}</td><td>{views}</td><td>{len(day_ips[day])}</td></tr>"
        for day, views in top_days
    )
    day_max = max(day_views.values(), default=1)
    hour_max = max(hour_views.values(), default=1)
    day_board = "\n".join(
        f"<div class=\"bar-row\"><div class=\"bar-label\">{html.escape(day[5:])}</div>"
        f"<div class=\"bar-track\"><span style=\"width:{max(4, round(views / day_max * 100))}%\"></span></div>"
        f"<div class=\"bar-value\"><strong>{views}</strong><small>{len(day_ips[day])} IP</small></div></div>"
        for day, views in recent_days
    )
    hour_board = "\n".join(
        f"<div class=\"bar-row\"><div class=\"bar-label\">{html.escape(hour[-5:])}</div>"
        f"<div class=\"bar-track\"><span style=\"width:{max(4, round(views / hour_max * 100))}%\"></span></div>"
        f"<div class=\"bar-value\"><strong>{views}</strong><small>{len(hour_ips[hour])} IP</small></div></div>"
        for hour, views in recent_hours
    )
    country_rows = "\n".join(
        f"<tr><td>{html.escape(country)}</td><td>{views}</td><td>{len(country_ips[country])}</td></tr>"
        for country, views in top_countries
    )
    location_rows = "\n".join(
        f"<tr><td>{html.escape(location)}</td><td>{views}</td><td>{len(location_ips[location])}</td></tr>"
        for location, views in top_locations
    )
    device_rows = "\n".join(
        f"<tr><td>{html.escape(device)}</td><td>{views}</td><td>{len(device_ips[device])}</td></tr>"
        for device, views in top_devices
    )
    system_rows = "\n".join(
        f"<tr><td>{html.escape(system)}</td><td>{views}</td><td>{len(os_ips[system])}</td></tr>"
        for system, views in top_systems
    )
    browser_rows = "\n".join(
        f"<tr><td>{html.escape(browser)}</td><td>{views}</td><td>{len(browser_ips[browser])}</td></tr>"
        for browser, views in top_browsers
    )
    brand_rows = "\n".join(
        f"<tr><td>{html.escape(brand)}</td><td>{views}</td><td>{len(brand_ips[brand])}</td></tr>"
        for brand, views in top_brands
    )
    recent_rows = "\n".join(
        "<tr>"
        f"<td>{html.escape(event['time'].astimezone().strftime('%Y-%m-%d %H:%M:%S') if event['time'] else '-')}</td>"
        f"<td>{html.escape(event['ip'])}</td>"
        f"<td>{html.escape(geo_by_ip.get(event['ip'], default_geo(event['ip']))['label'])}</td>"
        f"<td>{html.escape(parse_device(event['ua'])['brand'])}</td>"
        f"<td>{html.escape(parse_device(event['ua'])['label'])}</td>"
        f"<td><a href=\"{html.escape(event['path'])}\">{html.escape(event['path'])}</a></td>"
        f"<td>{html.escape(event['ua'][:140])}</td>"
        "</tr>"
        for event in recent_events
    )

    data = {
        "generatedAt": generated_at.isoformat(),
        "totalViews": total_views,
        "uniqueIps": unique_ips,
        "pages": [
            {"path": path, "views": views, "uniqueIps": len(page_ips[path])}
            for path, views in top_pages
        ],
        "days": [{"date": day, "views": views} for day, views in sorted(day_views.items())],
        "hours": [
            {"hour": hour, "views": views, "uniqueIps": len(hour_ips[hour])}
            for hour, views in sorted(hour_views.items())
        ],
        "countries": [
            {"country": country, "views": views, "uniqueIps": len(country_ips[country])}
            for country, views in top_countries
        ],
        "locations": [
            {"location": location, "views": views, "uniqueIps": len(location_ips[location])}
            for location, views in top_locations
        ],
        "devices": [
            {"device": device, "views": views, "uniqueIps": len(device_ips[device])}
            for device, views in top_devices
        ],
        "systems": [
            {"system": system, "views": views, "uniqueIps": len(os_ips[system])}
            for system, views in top_systems
        ],
        "browsers": [
            {"browser": browser, "views": views, "uniqueIps": len(browser_ips[browser])}
            for browser, views in top_browsers
        ],
        "brands": [
            {"brand": brand, "views": views, "uniqueIps": len(brand_ips[brand])}
            for brand, views in top_brands
        ],
    }
    empty_page_rows = '<tr><td colspan="3">暂无数据</td></tr>'
    empty_day_rows = '<tr><td colspan="3">暂无数据</td></tr>'
    empty_board = '<div class="empty-board">暂无数据</div>'
    empty_geo_rows = '<tr><td colspan="3">暂无数据</td></tr>'
    empty_recent_rows = '<tr><td colspan="7">暂无数据</td></tr>'

    return (
        "<!doctype html>\n"
        "<html lang=\"zh-CN\">\n"
        "<head>\n"
        "  <meta charset=\"UTF-8\" />\n"
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n"
        "  <title>网站访问统计</title>\n"
        "  <style>\n"
        "    :root{--bg:#f4f7f8;--paper:#fff;--ink:#15202b;--muted:#647184;--line:#dbe5ea;--accent:#0f766e;--soft:#eef8f6;--blue:#2563eb;--shadow:0 12px 30px rgba(25,38,52,.08);}\n"
        "    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.55;}\n"
        "    main{width:min(1280px,calc(100% - 32px));margin:0 auto;padding:28px 0 48px;} .hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:16px} h1{margin:0 0 6px;font-size:2rem;line-height:1.15;} h2{margin:0 0 12px;font-size:1.06rem;} .muted{color:var(--muted);margin:0}.stamp{font-size:.86rem;color:var(--muted);text-align:right;}\n"
        "    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0;} .card,.panel{border:1px solid var(--line);border-radius:8px;background:var(--paper);box-shadow:var(--shadow)} .card{padding:16px}.card strong{display:block;font-size:2rem;color:var(--accent);line-height:1.05}.card span{color:var(--muted);font-size:.9rem;font-weight:750}\n"
        "    .board-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.panel{padding:16px;min-width:0}.bar-list{display:grid;gap:9px}.hour-board{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px}.bar-row{display:grid;grid-template-columns:58px minmax(0,1fr)70px;gap:10px;align-items:center}.bar-label{color:#39495c;font-size:.86rem;font-weight:850}.bar-track{height:10px;border-radius:999px;background:#e9eff3;overflow:hidden}.bar-track span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent),#14b8a6)}.bar-value{text-align:right}.bar-value strong{display:block;font-size:.95rem}.bar-value small{display:block;color:var(--muted);font-size:.7rem}.empty-board{padding:22px;color:var(--muted);text-align:center;background:#f7fafb;border-radius:8px}\n"
        "    .rank-grid{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:12px;margin-top:12px}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--paper);} table{width:100%;min-width:520px;border-collapse:collapse;} th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;} th{background:#edf4f5;font-size:.82rem;color:#465568;} tr:last-child td{border-bottom:0;} td:nth-child(n+2),th:nth-child(n+2){text-align:right;white-space:nowrap} a{color:var(--accent);font-weight:750} code{background:#eaf1f5;border-radius:5px;padding:.12em .32em;}\n"
        "    details{margin-top:12px}.detail-panel{margin-top:12px}.section-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.section-title span{color:var(--muted);font-size:.82rem}.recent table{min-width:980px}.compact table{min-width:420px}\n"
        "    @media(max-width:980px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.board-grid,.rank-grid{grid-template-columns:1fr}.hero{display:block}.stamp{text-align:left;margin-top:8px}}\n"
        "    @media(max-width:760px){.hour-board{grid-template-columns:1fr}}\n"
        "    @media(max-width:620px){main{width:min(100% - 20px,1280px);padding-top:20px}h1{font-size:1.65rem}.cards{grid-template-columns:1fr}.bar-row{grid-template-columns:48px minmax(0,1fr)60px}.card strong{font-size:1.65rem}}\n"
        "  </style>\n"
        "</head>\n"
        "<body>\n"
        "<main>\n"
        "  <div class=\"hero\"><div><h1>访问统计看板</h1><p class=\"muted\">按天、按小时查看访问趋势，静态资源和统计页访问已过滤。</p></div>"
        f"<div class=\"stamp\">生成时间<br>{html.escape(generated_at.strftime('%Y-%m-%d %H:%M:%S %z'))}</div></div>\n"
        "  <div class=\"cards\">\n"
        f"    <div class=\"card\"><strong>{total_views}</strong><span>页面访问次数</span></div>\n"
        f"    <div class=\"card\"><strong>{unique_ips}</strong><span>独立 IP 数</span></div>\n"
        f"    <div class=\"card\"><strong>{len(page_views)}</strong><span>被访问页面数</span></div>\n"
        f"    <div class=\"card\"><strong>{len(day_views)}</strong><span>有访问的天数</span></div>\n"
        "  </div>\n"
        "  <section class=\"board-grid\">\n"
        "    <div class=\"panel\"><div class=\"section-title\"><h2>最近 14 天</h2><span>访问次数 / 独立 IP</span></div><div class=\"bar-list\">\n"
        f"{day_board or empty_board}\n"
        "    </div></div>\n"
        "    <div class=\"panel\"><div class=\"section-title\"><h2>最近 24 小时</h2><span>访问次数 / 独立 IP</span></div><div class=\"bar-list hour-board\">\n"
        f"{hour_board or empty_board}\n"
        "    </div></div>\n"
        "  </section>\n"
        "  <section class=\"rank-grid\">\n"
        "    <div class=\"panel\"><h2>页面排行</h2><div class=\"table-wrap\"><table><thead><tr><th>页面</th><th>访问</th><th>IP</th></tr></thead><tbody>\n"
        f"{page_rows or empty_page_rows}\n"
        "    </tbody></table></div></div>\n"
        "    <div class=\"panel compact\"><h2>地区排行</h2><div class=\"table-wrap\"><table><thead><tr><th>国家/地区</th><th>访问</th><th>IP</th></tr></thead><tbody>\n"
        f"{country_rows or empty_geo_rows}\n"
        "    </tbody></table></div></div>\n"
        "    <div class=\"panel compact\"><h2>设备排行</h2><div class=\"table-wrap\"><table><thead><tr><th>设备类型</th><th>访问</th><th>IP</th></tr></thead><tbody>\n"
        f"{device_rows or empty_geo_rows}\n"
        "    </tbody></table></div></div>\n"
        "  </section>\n"
        "  <details><summary>更多明细</summary>\n"
        "  <div class=\"panel detail-panel compact\"><h2>最近 30 天</h2><div class=\"table-wrap\"><table><thead><tr><th>日期</th><th>访问</th><th>IP</th></tr></thead><tbody>\n"
        f"{day_rows or empty_day_rows}\n"
        "  </tbody></table></div></div>\n"
        "  <div class=\"panel detail-panel compact\"><h2>详细地区</h2><div class=\"table-wrap\"><table><thead><tr><th>地区</th><th>访问</th><th>IP</th></tr></thead><tbody>\n"
        f"{location_rows or empty_geo_rows}\n"
        "  </tbody></table></div></div>\n"
        "  <div class=\"panel detail-panel compact\"><h2>设备品牌</h2><div class=\"table-wrap\"><table><thead><tr><th>品牌</th><th>访问</th><th>IP</th></tr></thead><tbody>\n"
        f"{brand_rows or empty_geo_rows}\n"
        "  </tbody></table></div></div>\n"
        "  <div class=\"panel detail-panel compact\"><h2>系统 / 浏览器</h2><div class=\"table-wrap\"><table><thead><tr><th>操作系统</th><th>访问</th><th>IP</th></tr></thead><tbody>\n"
        f"{system_rows or empty_geo_rows}\n"
        "  </tbody></table></div><br><div class=\"table-wrap\"><table><thead><tr><th>浏览器</th><th>访问</th><th>IP</th></tr></thead><tbody>\n"
        f"{browser_rows or empty_geo_rows}\n"
        "  </tbody></table></div></div>\n"
        "  <div class=\"panel detail-panel recent\"><h2>最近访问明细</h2><div class=\"table-wrap\"><table><thead><tr><th>时间</th><th>IP</th><th>地区</th><th>品牌</th><th>设备</th><th>页面</th><th>User-Agent</th></tr></thead><tbody>\n"
        f"{recent_rows or empty_recent_rows}\n"
        "  </tbody></table></div></div>\n"
        "  </details>\n"
        "  <p class=\"muted\">原始结构化数据：<code>/_analytics/stats.json</code></p>\n"
        "</main>\n"
        f"<script type=\"application/json\" id=\"stats-data\">{html.escape(json.dumps(data, ensure_ascii=False))}</script>\n"
        "</body>\n"
        "</html>\n"
    ), data


def main():
    log_path, output_dir = parse_args()
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = resolve_log_path(log_path)
    events = read_events(log_path)
    render_html.geo_by_ip = resolve_geo(events, output_dir)
    html_text, data = render_html(events)
    (output_dir / "index.html").write_text(html_text, encoding="utf-8")
    (output_dir / "stats.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()

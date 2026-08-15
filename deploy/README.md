# 阿里云自动部署与访问统计

这个目录用于把网站发布流程从本机 SSH 操作迁移到 GitHub Actions。

## 自动部署

合并后，在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 配置：

- `ALIYUN_HOST`：服务器公网 IP，例如 `60.205.199.206`
- `ALIYUN_USER`：登录用户，建议创建非 root 用户；当前也可用 `root`
- `ALIYUN_SSH_KEY`：服务器登录私钥
- `ANALYTICS_USER`：统计页用户名
- `ANALYTICS_PASSWORD`：统计页密码

以后发布只需要：

1. 提交代码。
2. 推送到 `main` 分支。
3. GitHub Actions 自动构建并发布到服务器。

## 服务器要求

- 已安装 Docker。
- SSH 私钥可登录服务器。
- 服务器 80 端口开放。

## 访问统计

统计不使用第三方插件。实现方式：

1. Nginx 记录访问日志到 `/opt/youkechuang/logs/youkechuang.access.log`。
2. `deploy/analytics_report.py` 定时解析日志。
3. 统计页面输出到 `/opt/youkechuang/analytics/index.html`。
4. 网站通过 `/_analytics/` 访问统计页。

统计页默认启用 Basic Auth，避免把 IP 访问明细公开给所有访客。

## 隐私说明

访问日志会记录用户 IP、访问路径、User-Agent、访问时间。上线前建议在网站隐私说明中补充该行为，并按实际合规要求设置日志保留周期。

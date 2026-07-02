# 部署到公司服务器（223.107.76.50，经现有 nginx 以 /topo/ 子路径接入）

> 服务器无 git、无空余端口。方案：本地构建镜像 → 导出 tar 上传 → `docker load` →
> 加入现有 compose 栈（不占宿主端口，走 `backend` 内部网络）→ 现有 nginx 加一段 `location`。
> 访问地址：**http://223.107.76.50:8126/topo/topo.html**（输入 `/topo.html` 会自动 301 跳转）。
> 前端所有资源与 API 均为相对路径，子路径部署无需改任何业务代码。

## 1. 本地构建并导出镜像

> Windows 下用 `docker save -o` 直接导出 tar，**不要**用 `docker save | gzip > xxx.tar.gz` 的
> 管道写法——PowerShell 没有 gzip，即使装了，其管道也会破坏二进制流，导致服务器上
> `docker load` 报 `invalid tar header` / `unexpected EOF`。镜像一百多 MB，不压缩直接传即可。

```powershell
docker build --platform linux/amd64 -t enercloud-topo:1.0 .
docker save -o enercloud-topo-1.0.tar enercloud-topo:1.0
scp -P 8119 enercloud-topo-1.0.tar bms@223.107.76.50:/home/bms/
```

## 2. 服务器导入镜像

```bash
docker load -i /home/bms/enercloud-topo-1.0.tar
```

## 3. 现有 docker-compose.yml 追加服务

**插入位置**：`services:` 区块内、文件末尾 `networks:` 定义**之前**（即紧跟
`energy-dashboard` 服务之后），`topo:` 缩进 2 空格与其他服务名对齐。
若误贴到文件最后（`networks:` 之后），会报
`networks.topo additional properties 'image', 'volumes', ... not allowed`。

不映射宿主端口（`expose` 仅内网可见），模板持久化到宿主机目录：

```yaml
  # ================= 拓扑编辑器 =================
  topo:
    image: enercloud-topo:1.0
    container_name: enercloud-topo
    restart: unless-stopped
    environment:
      TZ: Asia/Shanghai
    expose:
      - "3009"
    volumes:
      - ./data/myapp/topo/templates:/data/templates   # 用户模板持久化，备份此目录即可
    networks:
      - backend
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3009/templates/index.json"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512m
```

## 4. nginx-admin.conf 追加两段 location

放在 `location /` 之前。**`^~` 必须保留**：现有配置末尾有
`location ~* \.(js|css|...)$` 正则把所有静态文件反代到 energy-dashboard，
`^~` 前缀匹配优先于正则，否则 `/topo/*.js` 会被劫持导致白屏。

```nginx
	# 拓扑编辑器：输入 /topo.html 自动跳转（absolute_redirect off 防止跳转丢外部端口 8126）
	location = /topo.html {
		absolute_redirect off;
		return 301 /topo/topo.html;
	}

	# 拓扑编辑器：^~ 优先于静态资源正则，勿去掉；结尾斜杠成对（/topo/ → 容器内 /）
	location ^~ /topo/ {
		proxy_pass http://enercloud-topo:3009/;
		proxy_http_version 1.1;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		client_max_body_size 20m;   # 模板保存接口请求体上限 16MB，nginx 默认 1MB 会 413
		proxy_connect_timeout 60s;
		proxy_send_timeout 60s;
		proxy_read_timeout 60s;
	}
```

## 5. 启动与生效

```bash
cd /home/bms/base_docker
docker compose config --quiet    # 先校验 compose 语法，无输出即通过
docker compose up -d topo
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

验证：浏览器打开 http://223.107.76.50:8126/topo/topo.html ，画几个节点保存为模板，
确认 `/home/bms/base_docker/data/myapp/topo/templates/` 下出现 `tpl_*.json`。

## 6. 后续升级

本地改代码后：

```powershell
docker build --platform linux/amd64 -t enercloud-topo:1.1 .
docker save -o enercloud-topo-1.1.tar enercloud-topo:1.1
scp -P 8119 enercloud-topo-1.1.tar bms@223.107.76.50:/home/bms/
```

服务器：`docker load` 后把 compose 里的 tag 改成 1.1，`docker compose up -d topo`。
用户已保存的模板在宿主机目录里，升级不受影响（首启种子拷贝仅在目录为空时执行）。

## 7. 常见报错排查

| 报错特征 | 原因与处理 |
|---|---|
| `networks.topo additional properties 'image', ... not allowed` | `topo` 服务贴到了 `networks:` 区块之后；上移到 `services:` 区块内（见第 3 节） |
| `docker load` 报 `invalid tar header` / `unexpected EOF` | tar 文件损坏，多为 Windows 下用了 `docker save \| gzip` 管道；改用 `docker save -o` 重新导出重传（见第 1 节） |
| `docker compose: command not found` | 服务器是老版 compose v1，改用 `docker-compose`（带连字符） |
| nginx reload 报 `host not found in upstream "enercloud-topo"` | topo 容器未启动或不在 `backend` 网络；先 `docker ps` 确认 `enercloud-topo` 在跑，再 reload |
| 访问 `/topo/` 白屏、JS 404 | nginx 里 `location ^~ /topo/` 的 `^~` 被去掉，静态文件被末尾的正则 location 劫持到 energy-dashboard |
| 保存大模板报 413 | `location ^~ /topo/` 里缺 `client_max_body_size 20m` |
| 输入 `/topo.html` 跳转后端口丢失 | `location = /topo.html` 里缺 `absolute_redirect off;` |

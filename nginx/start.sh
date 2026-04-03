#!/bin/sh
set -e

# 从容器的 resolv.conf 动态读取 nameserver（兼容 Docker 和 Podman）
NS=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
echo "Using DNS resolver: $NS"

# 将占位符替换为实际的 resolver IP
sed -i "s/__RESOLVER__/${NS}/g" /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"

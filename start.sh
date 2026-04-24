#!/bin/bash
set -e
cd /opt/geo-blog/frontend
npm install clsx

cd /opt/geo-blog

echo "=== Starting geo-blog services ==="

# Function to check and create network
ensure_network() {
    local network_name="geo-net"
    
    if podman network exists "$network_name" 2>/dev/null; then
        echo "✓ Network $network_name already exists, skipping creation"
    else
        echo "Creating network $network_name..."
        podman network create "$network_name"
        echo "✓ Network $network_name created successfully"
    fi
}

# Ensure geo-net exists
ensure_network

# Stop and remove existing containers
podman-compose down 2>/dev/null || true

# Build and start all services
podman-compose build
podman-compose up -d

# Give containers a moment to start
sleep 3

# Connect all containers to geo-net (for dnsname DNS resolution)
echo "Connecting containers to geo-net..."
for c in geo-api geo-frontend quartz-notes; do
  podman network connect geo-net $c 2>/dev/null && echo "  $c -> geo-net OK" || echo "  $c already on geo-net"
done

echo "=== All services started ==="
podman ps --filter name=geo-frontend --filter name=geo-api --filter name=quartz-notes

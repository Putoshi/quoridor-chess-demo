#!/bin/bash

# Quoridor Chess - Go Module Build Script
# This script builds the Go module in the exact same Nakama runtime environment

set -e

echo "Building Quoridor Chess Go module..."

# Create modules directory if it doesn't exist
mkdir -p backend/data/modules

# Start postgres first
docker-compose up -d postgres
sleep 5

# Build the plugin inside a temporary Nakama container with the exact runtime
docker run --rm \
    --entrypoint="/bin/bash" \
    -v "$(pwd)/backend/modules:/modules-source" \
    -v "$(pwd)/backend/data/modules:/output" \
    -e POSTGRES_HOST=postgres \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=localdb \
    -e POSTGRES_DB=nakama \
    --net quoridor-chess-demo_default \
    heroiclabs/nakama:3.21.1 \
    -c "
        echo 'Building plugin in Nakama runtime environment...'
        
        # Create build directory
        mkdir -p /tmp/build
        cp -r /modules-source/* /tmp/build/
        cd /tmp/build
        
        echo 'Files to build:'
        ls -la
        
        echo 'Building Go plugin with Nakama Go version...'
        export CGO_ENABLED=0
        go mod tidy
        go mod download
        go build -buildmode=plugin -o /output/quoridor-chess.so .
        
        echo 'Plugin built successfully!'
        ls -la /output/
    "

echo "Go module build complete! File saved to backend/data/modules/"
#!/bin/bash
set -e

echo "Building CMG Waste Collection Card..."
echo ""

cd "$(dirname "$0")/.."

if ! command -v docker &> /dev/null; then
    echo "Error: Docker not installed"
    exit 1
fi

mkdir -p dist

echo "Building Docker image..."
docker build -f docker-tools/Dockerfile -t cmg-waste-card-builder .

echo "Extracting built file..."
CONTAINER_ID=$(docker create cmg-waste-card-builder)
docker cp $CONTAINER_ID:/app/dist/cmg-waste-collection-card.js ./dist/
docker rm $CONTAINER_ID > /dev/null 2>&1

if [ -f "dist/cmg-waste-collection-card.js" ]; then
    SIZE=$(ls -lh dist/cmg-waste-collection-card.js | awk '{print $5}')
    echo ""
    echo "✓ Build complete: dist/cmg-waste-collection-card.js ($SIZE)"
else
    echo "Error: Build failed"
    exit 1
fi

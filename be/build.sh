#!/bin/bash
# Build script for Render deployment

# Install dependencies
pip install -r requirements.txt

# Generate Prisma Client
export PRISMA_PY_DEBUG_GENERATOR=1
python -m prisma generate

echo "✅ Build completed successfully!"

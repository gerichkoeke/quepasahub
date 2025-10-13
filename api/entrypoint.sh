#!/bin/sh
set -e

echo "Waiting for database..."
sleep 5

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node dist/index.js

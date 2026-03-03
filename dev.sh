#!/bin/bash

trap 'kill 0' EXIT

echo "Starting backend..."
cd backend && npm run dev &

echo "Starting frontend..."
cd frontend && npm run dev &

wait

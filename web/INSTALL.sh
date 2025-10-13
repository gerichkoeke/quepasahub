#!/bin/bash

# Installation script for Integrador Waha-Typebot Frontend

echo "=========================================="
echo "Integrador Waha-Typebot Frontend Installer"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your API URL."
else
    echo "✅ .env file already exists"
fi
echo ""

# Run TypeScript check
echo "🔍 Running TypeScript type check..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
    echo "⚠️  TypeScript type check found issues (non-fatal)"
else
    echo "✅ TypeScript check passed"
fi
echo ""

# Build the project
echo "🔨 Building production bundle..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"
echo ""

echo "=========================================="
echo "Installation Complete! 🎉"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update .env file with your API URL"
echo "2. Start development server: npm run dev"
echo "3. Open http://localhost:5173 in your browser"
echo ""
echo "Useful commands:"
echo "  npm run dev      - Start development server"
echo "  npm run build    - Build for production"
echo "  npm run preview  - Preview production build"
echo "  npm run lint     - Lint code"
echo "  npm run format   - Format code"
echo ""

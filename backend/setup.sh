#!/bin/bash
# Setup script for DeepTrust Enhanced AI Backend

echo "🚀 Setting up DeepTrust Enhanced AI Backend..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your API keys:"
    echo "   - GNEWS_API_KEY (get from https://gnews.io/)"
    echo "   - PUTER_API_TOKEN (get from https://puter.com/)"
    echo "   - SIGHTENGINE credentials (optional)"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your API keys"
echo "2. Run: npm run dev (development) or npm start (production)"
echo "3. Test at: http://localhost:5000/api/health"
echo ""
echo "📖 Read ENHANCED_AI_README.md for full documentation"

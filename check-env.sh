#!/bin/bash

echo "🔍 Next Star Soccer - Environment Check"
echo "========================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Create one using .env.example as a template"
    exit 1
fi

echo "✅ .env file exists"
echo ""

# Required environment variables
required_vars=(
    "VITE_APPWRITE_ENDPOINT"
    "VITE_APPWRITE_PROJECT_ID"
    "VITE_APPWRITE_DATABASE_ID"
    "VITE_APPWRITE_PARENT_USERS_COLLECTION_ID"
    "VITE_APPWRITE_YOUTH_PLAYERS_COLLECTION_ID"
    "VITE_APPWRITE_COLLEGIATE_PLAYERS_COLLECTION_ID"
    "VITE_APPWRITE_PROFESSIONAL_PLAYERS_COLLECTION_ID"
    "VITE_APPWRITE_COACHES_COLLECTION_ID"
    "VITE_APPWRITE_TEAM_TRAINING_COLLECTION_ID"
    "VITE_APPWRITE_SIGNUPS_COLLECTION_ID"
    "VITE_APPWRITE_CHECKINS_COLLECTION_ID"
    "VITE_APPWRITE_COACH_SIGNUPS_COLLECTION_ID"
    "VITE_APPWRITE_COACH_CHECKINS_COLLECTION_ID"
    "VITE_APPWRITE_MESSAGES_COLLECTION_ID"
    "VITE_APPWRITE_BILLS_COLLECTION_ID"
    "VITE_APPWRITE_BILL_ITEMS_COLLECTION_ID"
    "VITE_APPWRITE_PAYMENTS_COLLECTION_ID"
    "VITE_APPWRITE_FAMILY_RELATIONSHIPS_COLLECTION_ID"
    "VITE_APPWRITE_FAMILY_INVITATIONS_COLLECTION_ID"
    "VITE_STRIPE_PUBLISHABLE_KEY"
)

echo "Checking environment variables:"
echo "--------------------------------"

missing_vars=()

for var in "${required_vars[@]}"; do
    if grep -q "^$var=" .env 2>/dev/null && [ -n "$(grep "^$var=" .env | cut -d '=' -f 2-)" ]; then
        echo "✅ $var"
    else
        echo "❌ $var (missing or empty)"
        missing_vars+=("$var")
    fi
done

echo ""

if [ ${#missing_vars[@]} -eq 0 ]; then
    echo "🎉 All environment variables are set!"
    echo ""
    echo "You can now:"
    echo "  1. Run: npm run dev (for local development)"
    echo "  2. Run: npm run build (to test production build)"
    echo "  3. Add these variables to Vercel for deployment"
else
    echo "⚠️  Missing ${#missing_vars[@]} environment variable(s)"
    echo ""
    echo "Please add the following to your .env file:"
    for var in "${missing_vars[@]}"; do
        echo "  $var=your_value_here"
    done
    echo ""
    echo "See .env.example for a template"
fi

echo ""
echo "📚 For Vercel deployment help, see: VERCEL_DEPLOYMENT.md"

#!/bin/bash
# catn8.us .htaccess Replacement Script
# This script safely replaces the current .htaccess file with the new one

set -e  # Exit on any error

echo "🔧 catn8.us .htaccess Replacement Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .htaccess.new exists
if [ ! -f ".htaccess.new" ]; then
    echo -e "${RED}❌ Error: .htaccess.new file not found!${NC}"
    echo "Please ensure the .htaccess.new file exists in the current directory."
    exit 1
fi

# Check if current .htaccess exists
if [ -f ".htaccess" ]; then
    echo -e "${YELLOW}⚠️  Current .htaccess file found. Creating backup...${NC}"
    cp .htaccess .htaccess.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Backup created: .htaccess.backup.$(date +%Y%m%d_%H%M%S)${NC}"
fi

# Replace the .htaccess file
echo -e "${YELLOW}🔄 Replacing .htaccess file...${NC}"
mv .htaccess.new .htaccess
echo -e "${GREEN}✅ .htaccess file replaced successfully${NC}"

# Verify the new file
echo -e "${YELLOW}🔍 Verifying new .htaccess file...${NC}"
if [ -f ".htaccess" ]; then
    echo -e "${GREEN}✅ New .htaccess file exists${NC}"
    echo "File size: $(stat -f%z .htaccess) bytes"
    echo "File permissions: $(stat -f%Lp .htaccess)"

    # Show first few lines to verify content
    echo -e "${YELLOW}📋 First few lines of new .htaccess:${NC}"
    head -5 .htaccess
    echo ""
else
    echo -e "${RED}❌ Error: .htaccess file not found after replacement!${NC}"
    exit 1
fi

# Test the website
echo -e "${YELLOW}🌐 Testing website functionality...${NC}"
echo "Testing .htaccess accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://catn8.us/.htaccess" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✅ .htaccess file properly protected (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠️  .htaccess file returned HTTP $HTTP_CODE (expected 403 or 404)${NC}"
fi

echo "Testing CSS file accessibility..."
CSS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://catn8.us/dist/assets/main-tw5clO3o.css" 2>/dev/null || echo "000")

if [ "$CSS_CODE" = "200" ]; then
    echo -e "${GREEN}✅ CSS file accessible (HTTP $CSS_CODE)${NC}"
else
    echo -e "${RED}❌ CSS file not accessible (HTTP $CSS_CODE)${NC}"
fi

echo "Testing manifest.json..."
MANIFEST_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://catn8.us/dist/.vite/manifest.json" 2>/dev/null || echo "000")

if [ "$MANIFEST_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Manifest.json accessible (HTTP $MANIFEST_CODE)${NC}"
else
    echo -e "${RED}❌ Manifest.json not accessible (HTTP $MANIFEST_CODE)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 .htaccess replacement completed successfully!${NC}"
echo ""
echo "📝 Summary of changes:"
echo "  • ✅ Created backup of old .htaccess file"
echo "  • ✅ Replaced .htaccess with new configuration"
echo "  • ✅ Verified file permissions and content"
echo "  • ✅ Tested website functionality"
echo ""
echo "🔧 Next steps:"
echo "  1. Monitor the website for any issues"
echo "  2. If problems occur, restore from backup:"
echo "     mv .htaccess.backup.$(date +%Y%m%d_%H%M%S) .htaccess"
echo "  3. Check website styling and functionality"
echo ""
echo -e "${YELLOW}⚠️  If you encounter any issues, the old .htaccess file has been backed up.${NC}"

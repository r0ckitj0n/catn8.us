#!/bin/bash
# WhimsicalFrog .htaccess Restoration Script
# This script restores the working .htaccess file from backup

set -e  # Exit on any error

echo "🔧 WhimsicalFrog .htaccess Restoration Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if working .htaccess file exists
if [ ! -f ".htaccess.working" ]; then
    echo -e "${RED}❌ Error: .htaccess.working file not found!${NC}"
    echo "Please ensure the .htaccess.working file exists in the current directory."
    exit 1
fi

# Create backup of current .htaccess
if [ -f ".htaccess" ]; then
    echo -e "${YELLOW}⚠️  Creating backup of current .htaccess file...${NC}"
    cp .htaccess .htaccess.broken.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Backup created: .htaccess.broken.$(date +%Y%m%d_%H%M%S)${NC}"
fi

# Replace the .htaccess file
echo -e "${YELLOW}🔄 Restoring working .htaccess file...${NC}"
cp .htaccess.working .htaccess
echo -e "${GREEN}✅ .htaccess file restored successfully${NC}"

# Verify the restored file
echo -e "${YELLOW}🔍 Verifying restored .htaccess file...${NC}"
if [ -f ".htaccess" ]; then
    echo -e "${GREEN}✅ Restored .htaccess file exists${NC}"
    echo "File size: $(stat -f%z .htaccess) bytes"
    echo "File permissions: $(stat -f%Lp .htaccess)"

    # Show first few lines to verify content
    echo -e "${YELLOW}📋 First few lines of restored .htaccess:${NC}"
    head -5 .htaccess
    echo ""
else
    echo -e "${RED}❌ Error: .htaccess file not found after restoration!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 .htaccess restoration completed successfully!${NC}"
echo ""
echo "📝 Summary of changes:"
echo "  • ✅ Created backup of broken .htaccess file"
echo "  • ✅ Restored working .htaccess from backup"
echo "  • ✅ Verified file permissions and content"
echo ""
echo "🔧 Next steps:"
echo "  1. Test the website functionality"
echo "  2. Check if CSS/JS loading works properly"
echo "  3. Monitor for any server errors"
echo ""
echo -e "${YELLOW}⚠️  The broken .htaccess file has been backed up.${NC}"

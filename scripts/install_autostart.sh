#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

PLIST_NAME="com.whimsicalfrog.autostart.plist"
SOURCE_PLIST="$SCRIPT_DIR/$PLIST_NAME"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/$PLIST_NAME"

# WhimsicalFrog Auto-Start Installation Script
# This script sets up automatic startup of WhimsicalFrog servers when you log in

echo "🐸 WhimsicalFrog Auto-Start Installation"
echo "========================================"

# Make sure start_servers.sh is executable
chmod +x "$SCRIPT_DIR/start_servers.sh"
echo "✅ Made start_servers.sh executable"

# Copy the LaunchAgent plist to the correct location
cp "$SOURCE_PLIST" "$TARGET_DIR/"
echo "✅ Copied LaunchAgent configuration to $TARGET_DIR"

# Load the LaunchAgent
launchctl load "$TARGET_PLIST"
echo "✅ Loaded LaunchAgent"

# Verify it's loaded
if launchctl list | grep -q "com.whimsicalfrog.autostart"; then
    echo "✅ Auto-start is now active!"
    echo ""
    echo "🎉 WhimsicalFrog will now start automatically when you log in!"
    echo ""
    echo "📝 What happens next:"
    echo "   • When you log in, WhimsicalFrog servers will start automatically"
    echo "   • The startup window will close automatically after 15 seconds"
    echo "   • You can access your site at http://localhost:8000"
    echo ""
    echo "🔧 Management commands:"
    echo "   • To disable auto-start: launchctl unload '$TARGET_PLIST'"
    echo "   • To re-enable auto-start: launchctl load '$TARGET_PLIST'"
    echo "   • To check status: launchctl list | grep whimsicalfrog"
    echo ""
    echo "📋 Logs are saved to: autostart.log"
else
    echo "❌ Failed to load LaunchAgent. Please check the configuration."
fi 
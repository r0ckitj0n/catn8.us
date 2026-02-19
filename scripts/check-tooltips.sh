#!/bin/bash
# Tooltip Coverage Check

echo "🔍 Checking tooltip coverage..."

for file in sections/admin_*.php; do
  if [[ -f "$file" ]]; then
    # Find buttons with IDs (macOS compatible)
    grep -o 'id="[^"]*"' "$file" | sed 's/id="//g' | sed 's/"//g' | while read id; do
      if [[ ! -z "$id" ]]; then
        response=$(curl -s "http://localhost:8080/api/help_tooltips.php?action=get&element_id=$id&admin_token=whimsical_admin_2024")
        if ! echo "$response" | grep -q '"success":true'; then
          echo "❌ Missing: $id"
          exit 1
        fi
      fi
    done
  fi
done

echo "✅ All tooltips present!"

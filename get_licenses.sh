#!/bin/bash

# License Information Export Script
# Purpose: Generates a CSV file containing license information for production dependencies
# Usage: ./get_licenses.sh
# Output: prod_licenses.csv
#
# This script:
# 1. Uses license-checker to get dependency licenses
# 2. Formats output as CSV with proper module name and version columns
# 3. Handles special characters in module names (e.g., @scoped packages)

npx license-checker --csv --production | sed 's/^"@/"/' | sed 's/@/","/'| sed 's/^"module name"/"module name","version"/' > prod_licenses.csv

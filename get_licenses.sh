#!/bin/bash

# License Information Export Script
# Generates a CSV file containing license information for production dependencies

npx license-checker --csv --production | sed 's/^"@/"/' | sed 's/@/","/'| sed 's/^"module name"/"module name","version"/' > prod_licenses.csv

#!/bin/bash
npx license-checker --csv --production | sed 's/^"@/"/' | sed 's/@/","/'| sed 's/^"module name"/"module name","version"/' > prod_licenses.csv

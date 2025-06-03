#!/bin/sh

# Environment Variable Injection Script, automatically executed by Nginx container during startup
#
# This script:
# 1. Finds all environment variables starting with 'APP_'
# 2. For each variable, replaces its placeholder in JS files with actual value
# 3. Only processes .js files to avoid unnecessary processing of other static assets

for i in $(env | grep APP_)
do
    key=$(echo $i | cut -d '=' -f 1)
    value=$(echo $i | cut -d '=' -f 2-)
    echo $key=$value
    # Note: We only process JS files to optimize performance
    # Original approach for all files (commented out):
    # find /usr/share/nginx/html -type f -exec sed -i "s|${key}|${value}|g" '{}' +

    # Process only JS files for better performance
    find /usr/share/nginx/html -type f -name '*.js' -exec sed -i "s|${key}|${value}|g" '{}' +
done
echo 'done'
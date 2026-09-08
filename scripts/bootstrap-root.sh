#!/usr/bin/env bash
set -euo pipefail

read -r -p "Supabase URL: " supabase_url
read -r -p "Publishable key (optional): " publishable_key
read -r -s -p "CUSTOM_BOOTSTRAP_SECRET: " bootstrap_secret
printf '\n'
read -r -p "ROOT username [ADMIN]: " root_username
root_username="${root_username:-ADMIN}"
read -r -s -p "ROOT password: " root_password
printf '\n'

payload="$(ROOT_USERNAME="$root_username" ROOT_PASSWORD="$root_password" python3 - <<'PY'
import json, os
print(json.dumps({"username": os.environ["ROOT_USERNAME"], "password": os.environ["ROOT_PASSWORD"]}))
PY
)"

headers=(-H "Content-Type: application/json" -H "x-bootstrap-secret: ${bootstrap_secret}")
if [[ -n "${publishable_key}" ]]; then
  headers+=(-H "apikey: ${publishable_key}")
fi

curl --fail-with-body --silent --show-error --request POST \
  "${supabase_url%/}/functions/v1/bootstrap-root" \
  "${headers[@]}" \
  --data "${payload}"
printf '\nBootstrap completed. The returned JSON does not contain a plaintext password.\n'

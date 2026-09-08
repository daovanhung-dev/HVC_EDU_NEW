#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  unset bootstrap_secret root_password payload secrets_output response_with_code response headers
}
trap cleanup EXIT

read -r -p "Supabase URL: " supabase_url
supabase_url="${supabase_url%/}"
read -r -p "Publishable key (optional): " publishable_key

if ! command -v supabase >/dev/null 2>&1; then
  echo "Không tìm thấy Supabase CLI. Cài CLI rồi chạy lại script." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Không tìm thấy Python 3 để sinh secret an toàn." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "Không tìm thấy curl để gọi Edge Function bootstrap-root." >&2
  exit 1
fi
if ! supabase projects list >/dev/null 2>&1; then
  echo "Supabase CLI chưa đăng nhập hoặc không có quyền truy cập project." >&2
  echo "Hãy chạy 'supabase login' rồi chạy lại script." >&2
  exit 1
fi

project_ref="${SUPABASE_PROJECT_REF:-}"
if [[ -z "${project_ref}" ]]; then
  project_host="${supabase_url#https://}"
  if [[ "${project_host}" == "${supabase_url}" || "${project_host}" != *.* ]]; then
    echo "Supabase URL không hợp lệ; cần dạng https://PROJECT_REF.supabase.co." >&2
    exit 1
  fi
  project_ref="${project_host%%.*}"
fi

bootstrap_secret="${CUSTOM_BOOTSTRAP_SECRET:-}"
if [[ -z "${bootstrap_secret}" ]]; then
  if ! secrets_output="$(supabase secrets list --project-ref "${project_ref}" 2>/dev/null)"; then
    echo "Không thể đọc danh sách secrets của Supabase project ${project_ref}." >&2
    exit 1
  fi

  if grep -q 'CUSTOM_BOOTSTRAP_SECRET' <<<"${secrets_output}"; then
    read -r -s -p "CUSTOM_BOOTSTRAP_SECRET hiện có: " bootstrap_secret
    printf '\n'
  else
    bootstrap_secret="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
    if ! supabase secrets set "CUSTOM_BOOTSTRAP_SECRET=${bootstrap_secret}" --project-ref "${project_ref}" >/dev/null 2>&1; then
      echo "Không thể tự tạo CUSTOM_BOOTSTRAP_SECRET trên Supabase." >&2
      echo "Bạn có thể tạo secret thủ công trong Edge Functions → Secrets rồi chạy lại." >&2
      exit 1
    fi
    echo "Đã tạo CUSTOM_BOOTSTRAP_SECRET an toàn trên Supabase (giá trị không hiển thị)."
  fi
fi

read -r -p "ROOT username [ADMIN]: " root_username
root_username="${root_username:-ADMIN}"
read -r -s -p "ROOT password: " root_password
printf '\n'
if [[ -z "${root_password}" || "${#root_password}" -lt 8 ]]; then
  echo "Mật khẩu ROOT phải có ít nhất 8 ký tự." >&2
  exit 1
fi

payload="$(ROOT_USERNAME="${root_username}" ROOT_PASSWORD="${root_password}" python3 - <<'PY'
import json, os
print(json.dumps({"username": os.environ["ROOT_USERNAME"], "password": os.environ["ROOT_PASSWORD"]}))
PY
)"

headers=(-H "Content-Type: application/json" -H "x-bootstrap-secret: ${bootstrap_secret}")
if [[ -n "${publishable_key}" ]]; then
  headers+=(-H "apikey: ${publishable_key}")
fi

set +e
response_with_code="$(curl --silent --show-error --request POST \
  "${supabase_url}/functions/v1/bootstrap-root" \
  "${headers[@]}" \
  --write-out $'\n%{http_code}' \
  --data "${payload}")"
curl_status=$?
set -e

http_code="${response_with_code##*$'\n'}"
response="${response_with_code%$'\n'*}"
printf '%s\n' "${response}"

if [[ "${http_code}" == "200" ]]; then
  echo "Bootstrap completed. The response does not contain a plaintext password."
  exit 0
fi
if grep -q 'ROOT_ALREADY_BOOTSTRAPPED' <<<"${response}"; then
  echo "ROOT_ALREADY_BOOTSTRAPPED: ROOT đã được tạo trước đó, không tạo thêm tài khoản." >&2
elif [[ "${http_code}" == "403" ]] || grep -q 'Bootstrap token không hợp lệ' <<<"${response}"; then
  echo "Bootstrap bị từ chối: CUSTOM_BOOTSTRAP_SECRET không khớp secret trên Supabase." >&2
else
  echo "Bootstrap thất bại với HTTP ${http_code}." >&2
fi

# curl returns zero for HTTP 4xx/5xx unless --fail is used. Always return a
# non-zero status for a rejected bootstrap so CI/shell automation can detect it.
if [[ "${curl_status}" -ne 0 ]]; then
  exit "${curl_status}"
fi
exit 1

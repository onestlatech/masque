#!/usr/bin/env bash
# Checks that every file a deployment serves, plain and brotli, was attested by this repository's CI.
set -euo pipefail

base=${1:-https://masque.onestla.tech}
repo=${2:-onestlatech/masque}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failed=0

# Fetches $1 with Accept-Encoding $2 and checks the bytes are attested under that path.
verify() {
	local path=$1 encoding=$2 name digest
	name=${path#/}
	name=${name:-index.html}
	if ! curl -sSf --proto =https -H "Accept-Encoding: $encoding" -D "$tmp/headers" -o "$tmp/body" "$base$path"; then
		echo "::error::$path ($encoding): fetch failed"
		return 1
	fi
	if grep -qi '^content-encoding: *br' "$tmp/headers"; then
		name+=.br
	fi
	digest=$(shasum -a 256 "$tmp/body" | cut -d ' ' -f 1)
	if ! gh attestation verify "$tmp/body" --repo "$repo" \
		--signer-workflow "$repo/.github/workflows/ci.yml" --format json >"$tmp/result.json"; then
		echo "::error::$path ($encoding): sha256:$digest has no valid attestation"
		return 1
	fi
	if ! jq -e --arg name "$name" --arg digest "$digest" \
		'any(.[].verificationResult.statement.subject[]; .name == $name and .digest.sha256 == $digest)' \
		"$tmp/result.json" >/dev/null; then
		echo "::error::$path ($encoding): sha256:$digest is attested, but not as $name"
		return 1
	fi
	echo "ok $path ($encoding) $name sha256:$digest"
}

# sw.js lists every other file; its own attestation must hold before that list is trusted.
verify /sw.js identity || exit 1
cp "$tmp/body" "$tmp/sw.js"
paths=$(grep -o '\["/[^]]*\]' "$tmp/sw.js" | jq -r '.[]')
if [ -z "$paths" ]; then
	echo "::error::no precache list found in sw.js"
	exit 1
fi

while IFS= read -r path; do
	for encoding in identity br; do
		verify "$path" "$encoding" </dev/null || failed=$((failed + 1))
	done
done <<<"/sw.js
$paths"

if [ "$failed" -gt 0 ]; then
	echo "::error::$failed responses from $base do not match an attested build of $repo"
	exit 1
fi

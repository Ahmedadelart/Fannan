#!/usr/bin/env bash
# One-time setup: fannan.net and *.fannan.net -> Google Cloud load balancer -> Cloud Run (fannan-production).
# Cloudflare sits in front (proxied DNS, its own edge certificate); the load balancer has a
# Google-managed certificate for the same names so Cloudflare can use "Full (strict)".
#
# Needs: gcloud signed in with owner rights on fannan-510913, and CLOUDFLARE_API_TOKEN /
# CLOUDFLARE_ZONE_ID in the environment for the DNS steps. Safe to re-run: existing pieces are kept.
set -euo pipefail

P=fannan-510913
REGION=europe-west1
DOMAIN=fannan.net
CF="https://api.cloudflare.com/client/v4"

step() { echo; echo "== $*"; }
exists() { "$@" >/dev/null 2>&1; }

step "Static address"
exists gcloud compute addresses describe fannan-ip --global --project $P ||
  gcloud compute addresses create fannan-ip --global --ip-version IPV4 --project $P
IP=$(gcloud compute addresses describe fannan-ip --global --project $P --format='value(address)')
echo "IP: $IP"

step "Load balancer pieces (serverless NEG -> backend -> URL map)"
exists gcloud compute network-endpoint-groups describe fannan-production-neg --region $REGION --project $P ||
  gcloud compute network-endpoint-groups create fannan-production-neg --region $REGION \
    --network-endpoint-type serverless --cloud-run-service fannan-production --project $P
exists gcloud compute backend-services describe fannan-backend --global --project $P || {
  gcloud compute backend-services create fannan-backend --global --load-balancing-scheme EXTERNAL_MANAGED --project $P
  gcloud compute backend-services add-backend fannan-backend --global \
    --network-endpoint-group fannan-production-neg --network-endpoint-group-region $REGION --project $P
}
exists gcloud compute url-maps describe fannan-urlmap --global --project $P ||
  gcloud compute url-maps create fannan-urlmap --default-service fannan-backend --global --project $P

step "Certificate for $DOMAIN and *.$DOMAIN (DNS authorisation)"
exists gcloud certificate-manager dns-authorizations describe fannan-dns-auth --project $P ||
  gcloud certificate-manager dns-authorizations create fannan-dns-auth --domain $DOMAIN --project $P
AUTH_NAME=$(gcloud certificate-manager dns-authorizations describe fannan-dns-auth --project $P --format='value(dnsResourceRecord.name)')
AUTH_DATA=$(gcloud certificate-manager dns-authorizations describe fannan-dns-auth --project $P --format='value(dnsResourceRecord.data)')
echo "Add in Cloudflare (DNS only): CNAME $AUTH_NAME -> $AUTH_DATA"
exists gcloud certificate-manager certificates describe fannan-cert --project $P ||
  gcloud certificate-manager certificates create fannan-cert --domains "$DOMAIN,*.$DOMAIN" \
    --dns-authorizations fannan-dns-auth --project $P
exists gcloud certificate-manager maps describe fannan-certmap --project $P ||
  gcloud certificate-manager maps create fannan-certmap --project $P
exists gcloud certificate-manager maps entries describe fannan-apex --map fannan-certmap --project $P ||
  gcloud certificate-manager maps entries create fannan-apex --map fannan-certmap --hostname $DOMAIN --certificates fannan-cert --project $P
exists gcloud certificate-manager maps entries describe fannan-wildcard --map fannan-certmap --project $P ||
  gcloud certificate-manager maps entries create fannan-wildcard --map fannan-certmap --hostname "*.$DOMAIN" --certificates fannan-cert --project $P

step "HTTPS front door"
exists gcloud compute target-https-proxies describe fannan-https --global --project $P ||
  gcloud compute target-https-proxies create fannan-https --url-map fannan-urlmap --certificate-map fannan-certmap --global --project $P
exists gcloud compute forwarding-rules describe fannan-https-rule --global --project $P ||
  gcloud compute forwarding-rules create fannan-https-rule --global --load-balancing-scheme EXTERNAL_MANAGED \
    --address fannan-ip --target-https-proxy fannan-https --ports 443 --project $P

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ZONE_ID:-}" ]]; then
  step "Cloudflare DNS"
  cf() { curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }
  upsert() { # type name content proxied
    local id
    id=$(cf "$CF/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=$1&name=$2" | python -c "import json,sys; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')")
    local body="{\"type\":\"$1\",\"name\":\"$2\",\"content\":\"$3\",\"proxied\":$4,\"ttl\":1}"
    if [[ -n "$id" ]]; then cf -X PUT "$CF/zones/$CLOUDFLARE_ZONE_ID/dns_records/$id" -d "$body" >/dev/null
    else cf -X POST "$CF/zones/$CLOUDFLARE_ZONE_ID/dns_records" -d "$body" >/dev/null; fi
    echo "  $1 $2 -> $3 (proxied: $4)"
  }
  upsert CNAME "${AUTH_NAME%.}" "${AUTH_DATA%.}" false
  upsert A "$DOMAIN" "$IP" true
  upsert A "*.$DOMAIN" "$IP" true
  cf -X PATCH "$CF/zones/$CLOUDFLARE_ZONE_ID/settings/ssl" -d '{"value":"strict"}' >/dev/null && echo "  SSL mode: Full (strict)"
  cf -X PATCH "$CF/zones/$CLOUDFLARE_ZONE_ID/settings/always_use_https" -d '{"value":"on"}' >/dev/null && echo "  Always use HTTPS: on"
fi

step "Certificate status (ACTIVE can take 15-60 minutes after the DNS record exists)"
gcloud certificate-manager certificates describe fannan-cert --project $P --format='value(managed.state)'

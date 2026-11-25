#!/usr/bin/env bash
# ============================================================
# WhatsApp CRM — update server dari GitHub (satu perintah)
#
#   sudo bash /home/wacrm/wa_official/deploy/update-server.sh
#
# Langkah: tarik kode terbaru → bun install (be & fe) → build frontend
#          → restart service → cek kesehatan backend & frontend.
# Semua perintah aplikasi dijalankan sebagai user pemilik folder (default: wacrm),
# jadi tidak ada lagi masalah "dubious ownership" / file milik root.
#
# Variabel opsional:
#   APP_DIR=/home/wacrm/wa_official  APP_USER=wacrm  BRANCH=main
#   BACKEND_SERVICE=wa-crm-backend    FRONTEND_SERVICE=wa-crm-frontend
#   BACKEND_PORT=3000                 FRONTEND_PORT=3001
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
APP_USER="${APP_USER:-$(stat -c '%U' "$APP_DIR")}"
BRANCH="${BRANCH:-main}"
BACKEND_SERVICE="${BACKEND_SERVICE:-wa-crm-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-wa-crm-frontend}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"

info() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m[x] %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Jalankan dengan sudo: sudo bash $0"
[ -d "$APP_DIR/.git" ] || fail "Folder repo tidak ditemukan: $APP_DIR"
id "$APP_USER" >/dev/null 2>&1 || fail "User $APP_USER tidak ada"

# Run a command as the app user, with bun on PATH
as_app() {
  sudo -u "$APP_USER" -H env PATH="/home/$APP_USER/.bun/bin:/usr/local/bin:/usr/bin:/bin" \
    bash -c "cd '$APP_DIR' && $*"
}

info "Repo: $APP_DIR  (user: $APP_USER, branch: $BRANCH)"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

as_app "command -v bun >/dev/null" || fail "bun tidak ditemukan untuk user $APP_USER (cek /home/$APP_USER/.bun/bin)"
getent hosts github.com >/dev/null || fail "Server tidak bisa resolve github.com (cek DNS / koneksi internet)"

BEFORE="$(as_app 'git rev-parse --short HEAD')"

if [ -n "$(as_app 'git status --porcelain --untracked-files=no')" ]; then
  warn "Ada perubahan lokal pada file yang dilacak git di server:"
  as_app 'git status --short --untracked-files=no'
  fail "Batalkan / simpan perubahan itu dulu (git stash) agar pull tidak konflik."
fi

info "Menarik kode terbaru dari GitHub"
as_app "git fetch origin '$BRANCH' && git checkout '$BRANCH' && git pull --ff-only origin '$BRANCH'"
AFTER="$(as_app 'git rev-parse --short HEAD')"
if [ "$BEFORE" = "$AFTER" ]; then
  warn "Tidak ada commit baru ($AFTER). Tetap lanjut install & build."
else
  echo "Update: $BEFORE -> $AFTER"
  as_app "git log --oneline $BEFORE..$AFTER | head -20"
fi

info "Install dependency backend"
as_app "cd be && bun install"

info "Install dependency & build frontend"
as_app "cd fe && bun install && bun run build"

info "Restart service"
systemctl restart "$BACKEND_SERVICE" "$FRONTEND_SERVICE"

info "Cek kesehatan"
ok=1
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then break; fi
  sleep 1
  [ "$i" -eq 20 ] && ok=0
done
if [ "$ok" -eq 1 ]; then echo "Backend  : OK (port $BACKEND_PORT)"; else warn "Backend belum merespons di port $BACKEND_PORT"; fi

if curl -fsS -o /dev/null "http://127.0.0.1:$FRONTEND_PORT/" 2>/dev/null; then
  echo "Frontend : OK (port $FRONTEND_PORT)"
else
  warn "Frontend belum merespons di port $FRONTEND_PORT"
fi

systemctl --no-pager --lines=0 status "$BACKEND_SERVICE" "$FRONTEND_SERVICE" | grep -E "●|Active:" || true

info "Log backend terbaru"
journalctl -u "$BACKEND_SERVICE" -n 25 --no-pager || true

if [ "$ok" -ne 1 ]; then
  fail "Backend tidak sehat. Rollback ke versi sebelumnya:
    sudo -u $APP_USER git -C '$APP_DIR' reset --hard $BEFORE
    sudo -u $APP_USER bash -c 'cd $APP_DIR/be && bun install && cd ../fe && bun install && bun run build'
    sudo systemctl restart $BACKEND_SERVICE $FRONTEND_SERVICE"
fi
info "Selesai — versi aktif: $AFTER. Buka web lalu tekan Ctrl+Shift+R."

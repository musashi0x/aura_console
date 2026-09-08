#!/usr/bin/env bash
# Start the ADK agent the Console asks questions of.
#
# Without this process the API answers /health/agent with reachable:false and
# every chat returns 503 agent_unavailable. The Console then renders the
# grounding warning on every surface and no question is ever answered — which
# reads as "the whole app is a mock" when in fact one process is missing.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# The repo may be checked out as a git worktree; the venv lives once, in the
# main checkout, so look there too rather than making every worktree build one.
main_root="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||')"
adk=""
for candidate in "$root/.venv-adk/bin/adk" "${main_root:-}/.venv-adk/bin/adk"; do
  if [ -x "$candidate" ]; then adk="$candidate"; break; fi
done

if [ -z "$adk" ]; then
  echo "No ADK interpreter found (.venv-adk/bin/adk)." >&2
  echo "  python3.11 -m venv .venv-adk && .venv-adk/bin/pip install google-adk" >&2
  exit 1
fi

if [ ! -f "$HOME/.config/gcloud/application_default_credentials.json" ]; then
  echo "No application default credentials, so Vertex will refuse every call." >&2
  echo "  gcloud auth application-default login" >&2
  exit 1
fi

project="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
if [ -z "$project" ] || [ "$project" = "(unset)" ]; then
  echo "No Google Cloud project. Set GOOGLE_CLOUD_PROJECT or run:" >&2
  echo "  gcloud config set project <project-id>" >&2
  exit 1
fi

port="${ADK_PORT:-8000}"
echo "ADK agent: project $project, port $port, agents/ from $root"

exec env \
  GOOGLE_GENAI_USE_VERTEXAI=TRUE \
  GOOGLE_CLOUD_PROJECT="$project" \
  GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}" \
  "$adk" api_server agents --port "$port"

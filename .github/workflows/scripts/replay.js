#!/usr/bin/env node
/* eslint-disable */
/**
 * Discord workflow replay harness.
 *
 * Extracts the `run:` block from each .github/workflows/discord-*.yml,
 * resolves `${{ ... }}` GitHub Actions expressions against a synthetic
 * event payload, executes the bash with a stubbed `curl` on PATH, and
 * asserts the resulting JSON is well-formed.
 *
 * Used by .github/workflows/discord-workflows-lint.yml on every push
 * and PR that touches a Discord workflow. Can also be run locally:
 *
 *   NODE_PATH=./backend/node_modules node .github/workflows/scripts/replay.js
 */
'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'rajat-wyrm/Quintern';
const WORKFLOWS_DIR = path.resolve(__dirname, '..');
const SCRATCH = '/tmp/discord-lint';

// ── Synthetic event payloads ─────────────────────────────────────────────
// Shape mirrors what GitHub sends. Workflows that use
// `toJSON(github.event.X)` get just the X sub-object, not the wrapper.

const PAYLOADS = {
  'discord-issues.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'issue.json',
    channel: 'feed',
    payload: {
      action: 'opened',
      issue: {
        number: 99,
        html_url: 'https://github.com/x/y/issues/99',
        title: 'bug(test): sample title with spaces & symbols',
        body: '## Summary\n\nLine one.\nLine two.',
        user: { login: 'rajat-wyrm', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/rajat-wyrm' },
        labels: [{ name: 'bug' }],
        assignees: [{ login: 'rajat-wyrm' }],
      },
    },
  },
  'discord-pull-request.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'pr.json',
    channel: 'feed',
    payload: {
      action: 'opened',
      pull_request: {
        number: 42,
        html_url: 'https://github.com/x/y/pull/42',
        title: 'feat: spaces & symbols',
        body: 'PR body',
        user: { login: 'rajat-wyrm', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/rajat-wyrm' },
        head: { ref: 'feature/x' },
        base: { ref: 'main' },
        commits: 3,
        additions: 10,
        deletions: 2,
      },
    },
  },
  'discord-push.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'push.json',
    channel: 'feed',
    payload: {
      ref: 'refs/heads/main',
      repository: { full_name: REPO },
      pusher: { name: 'rajat-wyrm' },
      sender: { avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/rajat-wyrm' },
      commits: [
        {
          id: 'abcdef1234567890',
          url: 'https://github.com/x/y/commit/abcdef1234567890',
          message: 'fix: thing\n\nbody',
          author: { name: 'rajat' },
        },
      ],
    },
  },
  'discord-release.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'release.json',
    channel: 'releases',
    payload: {
      id: 1,
      html_url: 'https://github.com/x/y/releases/tag/v1.2.3',
      tag_name: 'v1.2.3',
      name: 'Quintern 1.2.3',
      body: 'Release notes',
      prerelease: false,
      draft: false,
      author: { login: 'rajat-wyrm', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/rajat-wyrm' },
      published_at: '2026-06-18T00:00:00Z',
    },
  },
  'discord-ci.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'run.json',
    channel: 'cicd',
    payload: {
      id: 555,
      name: 'CI',
      html_url: 'https://github.com/x/y/actions/runs/555',
      conclusion: 'success',
      head_branch: 'main',
      head_sha: 'abcdef1234567890',
      event: 'push',
      run_duration_ms: 12345,
      head_commit: { author: { username: 'rajat' }, message: 'fix: thing' },
      head_repository: { owner: { login: 'rajat-wyrm' } },
    },
  },
  'discord-branch.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'branch-create.json',
    channel: 'feed',
    payload: {
      ref: 'feature/x',
      ref_type: 'branch',
      sender: { login: 'rajat-wyrm', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/rajat-wyrm' },
    },
  },
  'discord-review-comment.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'review-comment.json',
    channel: 'feed',
    payload: {
      action: 'created',
      comment: {
        body: 'Looks good to me — ship it!',
        html_url: 'https://github.com/x/y/pull/42#discussion_r1',
        user: { login: 'rajat-wyrm', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/rajat-wyrm' },
        path: 'src/index.js',
      },
      pull_request: { number: 42, title: 'feat: spaces & symbols' },
    },
  },
  'discord-bug-reports.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'bug-report.json',
    channel: 'bugs',
    payload: {
      action: 'labeled',
      label: { name: 'bug' },
      issue: {
        number: 99,
        html_url: 'https://github.com/x/y/issues/99',
        title: 'bug(test): sample title with spaces & symbols',
        body: '## Summary\n\nSteps to reproduce.',
        user: { login: 'rajat-wyrm', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/rajat-wyrm' },
        labels: [{ name: 'bug' }],
        assignees: [],
      },
    },
  },
  'discord-main-broken.yml': {
    envVar: 'EVENT_PAYLOAD',
    file: 'main-broken.json',
    channel: 'cicd',
    payload: {
      id: 555,
      name: 'CI',
      html_url: 'https://github.com/x/y/actions/runs/555',
      conclusion: 'failure',
      head_branch: 'main',
      head_sha: 'abcdef1234567890',
      event: 'push',
      run_duration_ms: 12345,
      head_commit: { author: { username: 'rajat' }, message: 'fix: thing' },
      head_repository: { owner: { login: 'rajat-wyrm' } },
    },
  },
};

// ── Stub curl: writes payload to disk, prints 204 ────────────────────────

const STUB_CURL = `#!/usr/bin/env bash
url="\${@: -1}"
this_tag=$(echo "$url" | sed 's|.*/||;s|[^a-zA-Z0-9]|_|g')
out="${SCRATCH}/last-\${this_tag}.json"
body=""
for ((i=0; i<$#; i++)); do
  if [ "\${!i}" = "-d" ]; then
    j=$((i+1)); body="\${!j}"
    break
  fi
done
if [ "$body" = "@-" ]; then
  cat > "$out"
elif [[ "$body" == @* ]]; then
  cp "\${body:1}" "$out"
elif [ -n "$body" ]; then
  printf '%s' "$body" > "$out"
fi
echo "204"
`;

// ── GitHub Actions expression resolver ───────────────────────────────────

function resolve(value, payload, webhookUrl) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\${{\s*github\.repository\s*}}/g, REPO)
    .replace(/\${{\s*github\.ref\s*}}/g, 'refs/heads/main')
    .replace(/\${{\s*github\.event\.pusher\.name\s*}}/g, 'rajat-wyrm')
    .replace(/\${{\s*github\.event\.action\s*}}/g, payload.action || 'opened')
    .replace(/\${{\s*github\.event\.ref\s*}}/g, payload.ref || 'refs/heads/main')
    .replace(/\${{\s*github\.event\.ref_type\s*}}/g, payload.ref_type || 'branch')
    .replace(/\${{\s*github\.event\.sender\.login\s*}}/g, payload.sender?.login || 'rajat-wyrm')
    .replace(/\${{\s*github\.event\.pull_request\.merged\s*}}/g, 'false')
    .replace(/\${{\s*secrets\.[A-Z_]+\s*}}/g, webhookUrl)
    .replace(/\${{\s*toJSON\(github\.event\)\s*}}/g, JSON.stringify(payload))
    .replace(/\${{\s*toJSON\(github\.event\.[a-z_]+\)\s*}}/g, JSON.stringify(payload));
}

// ── Main ─────────────────────────────────────────────────────────────────

function extractRunBlock(content) {
  const doc = yaml.load(content);
  for (const job of Object.values(doc.jobs || {})) {
    for (const step of job.steps || []) {
      if (step.run) return { run: step.run, env: step.env || {} };
    }
  }
  return null;
}

function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, 'curl'), STUB_CURL, { mode: 0o755 });

  let failed = 0;
  const results = [];

  for (const [wf, cfg] of Object.entries(PAYLOADS)) {
    const fullPath = path.join(WORKFLOWS_DIR, wf);
    if (!fs.existsSync(fullPath)) {
      results.push(`SKIP ${wf} (missing)`);
      continue;
    }
    const { run, env: stepEnv } = extractRunBlock(fs.readFileSync(fullPath, 'utf8'));
    if (!run) {
      console.log(`::error file=${wf}::no run: block`);
      failed++;
      continue;
    }

    const webhookUrl = `https://discord.com/api/webhooks/test/${cfg.channel}`;
    const env = {
      ...process.env,
      PATH: SCRATCH + ':' + process.env.PATH,
      GITHUB_REPOSITORY: REPO,
    };
    for (const [k, v] of Object.entries(stepEnv)) {
      env[k] = resolve(v, cfg.payload, webhookUrl);
    }
    env[cfg.envVar] = JSON.stringify(cfg.payload);

    const scriptPath = path.join(SCRATCH, `script-${wf}.sh`);
    fs.writeFileSync(scriptPath, run);

    try {
      execSync('rm -f ' + path.join(SCRATCH, 'last-*.json'), { shell: '/bin/bash' });
    } catch {}

    let stderr = '';
    try {
      execSync(`bash ${scriptPath}`, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      stderr = (e.stderr || Buffer.from('')).toString();
      console.log(`::error file=${wf}::script exited ${e.status}`);
      console.log(stderr.split('\n').slice(-5).map((l) => '  ' + l).join('\n'));
      failed++;
      results.push(`FAIL ${wf}`);
      continue;
    }

    const captured = fs
      .readdirSync(SCRATCH)
      .filter((f) => f.startsWith('last-') && f.endsWith('.json'));
    if (!captured.length) {
      console.log(`::error file=${wf}::stub curl never received a payload`);
      failed++;
      results.push(`FAIL ${wf}`);
      continue;
    }
    const payload = JSON.parse(fs.readFileSync(path.join(SCRATCH, captured[0]), 'utf8'));
    const title = payload.embeds?.[0]?.title || payload.title || '?';
    results.push(`OK   ${wf.padEnd(32)} → ${title}`);
  }

  console.log('\n── Replay results ──');
  for (const r of results) console.log(r);
  console.log(failed === 0 ? '\nAll passed.' : `\n${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main();

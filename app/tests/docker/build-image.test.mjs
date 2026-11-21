import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs docker/build-image.sh in --dry-run mode, so no container engine is needed, and checks
// the commands it would run for each engine and option, and that bad input is refused
// before anything runs.
const here = fileURLToPath(new URL('.', import.meta.url));
const script = resolve(here, '../../../docker/build-image.sh');

function run(args = [], env = {}) {
  const res = spawnSync('sh', [script, ...args], {
    env: { PATH: process.env.PATH, CONTAINER_ENGINE: 'docker', ...env },
    encoding: 'utf8',
  });
  const cmds = res.stdout.split('\n').filter((l) => l.startsWith('+ '));
  return { status: res.status, out: res.stdout, err: res.stderr, cmds };
}

const builds = (cmds) => cmds.filter((c) => / build /.test(c));

describe('build-image.sh help', () => {
  it('prints usage and exits 0', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    for (const opt of ['--engine', '--tag', '--skip-tests', '--no-cache', '--platform', '--run', '--name', '--port', '--dry-run']) {
      expect(r.out).toContain(opt);
    }
  });
});

describe('build-image.sh default run', () => {
  const r = run(['--dry-run']);

  it('succeeds and starts nothing', () => {
    expect(r.status).toBe(0);
    expect(r.cmds.some((c) => / run /.test(c))).toBe(false);
  });

  it('runs the test stage first, then the production build', () => {
    const b = builds(r.cmds);
    expect(b).toHaveLength(2);
    expect(b[0]).toContain('--target test');
    expect(b[0]).toContain('--iidfile');
    expect(b[1]).not.toContain('--target');
    expect(b[1]).toContain('-t aws-network-visualizer:dev');
  });

  it('builds docker/Dockerfile with the project root as the context', () => {
    for (const c of builds(r.cmds)) {
      expect(c).toContain('-f docker/Dockerfile');
      expect(c.endsWith(' .')).toBe(true);
    }
  });
});

describe('build-image.sh options', () => {
  it('--skip-tests builds only the image', () => {
    const b = builds(run(['--dry-run', '--skip-tests']).cmds);
    expect(b).toHaveLength(1);
    expect(b[0]).not.toContain('--target');
  });

  it('passes the tag, no-cache and platform to the builds', () => {
    const r = run(['--dry-run', '--skip-tests', '--tag', 'example/viz:1.2', '--no-cache', '--platform', 'linux/amd64']);
    const [b] = builds(r.cmds);
    expect(b).toContain('-t example/viz:1.2');
    expect(b).toContain('--no-cache');
    expect(b).toContain('--platform linux/amd64');
  });

  it('applies no-cache and platform to the test stage too', () => {
    const [test] = builds(run(['--dry-run', '--no-cache', '--platform', 'linux/arm64']).cmds);
    expect(test).toContain('--target test');
    expect(test).toContain('--no-cache');
    expect(test).toContain('--platform linux/arm64');
  });

  it('builds the commit tag from the image name when this is a git checkout', () => {
    const [b] = builds(run(['--dry-run', '--skip-tests', '--tag', 'example/viz:1.2']).cmds);
    const tags = [...b.matchAll(/-t (\S+)/g)].map((m) => m[1]);
    expect(tags[0]).toBe('example/viz:1.2');
    for (const t of tags.slice(1)) expect(t.startsWith('example/viz:')).toBe(true);
  });
});

describe('build-image.sh engines', () => {
  it('uses the engine from CONTAINER_ENGINE and from --engine', () => {
    expect(run(['--dry-run', '--skip-tests'], { CONTAINER_ENGINE: 'nerdctl' }).cmds[0]).toMatch(/^\+ nerdctl build /);
    expect(run(['--dry-run', '--skip-tests', '--engine', 'podman'], { CONTAINER_ENGINE: 'docker' }).cmds[0]).toMatch(/^\+ podman build /);
  });

  it('asks podman for docker-format images, which keep the HEALTHCHECK', () => {
    for (const c of builds(run(['--dry-run', '--engine', 'podman']).cmds)) expect(c).toContain('--format docker');
    for (const engine of ['docker', 'nerdctl']) {
      for (const c of builds(run(['--dry-run', '--engine', engine]).cmds)) expect(c).not.toContain('--format');
    }
  });
});

describe('build-image.sh --run', () => {
  const r = run(['--dry-run', '--skip-tests', '--run', '--name', 'viz', '--port', '9090']);
  const runCmd = r.cmds.find((c) => c.startsWith('+ docker run '));

  it('replaces only the container with the chosen name', () => {
    expect(r.cmds).toContain('+ docker rm -f viz');
  });

  it('starts it hardened and published on localhost only', () => {
    expect(runCmd).toBeDefined();
    for (const part of [
      '-d --name viz',
      '--read-only',
      '--tmpfs /tmp',
      '--cap-drop ALL',
      '--security-opt no-new-privileges:true',
      '-p 127.0.0.1:9090:8080',
    ]) {
      expect(runCmd).toContain(part);
    }
    expect(runCmd.endsWith(' aws-network-visualizer:dev')).toBe(true);
    expect(runCmd).not.toContain('0.0.0.0');
  });

  it('defaults to the name nwv on port 8080', () => {
    const d = run(['--dry-run', '--skip-tests', '--run']);
    expect(d.cmds).toContain('+ docker rm -f nwv');
    expect(d.cmds.find((c) => c.startsWith('+ docker run '))).toContain('-p 127.0.0.1:8080:8080');
  });

  it('passes the platform to the run command as well', () => {
    const p = run(['--dry-run', '--skip-tests', '--run', '--platform', 'linux/arm64']);
    expect(p.cmds.find((c) => c.startsWith('+ docker run '))).toContain('--platform linux/arm64');
  });
});

describe('build-image.sh input checks', () => {
  const bad = [
    [['--tag', 'x;rm -rf /'], 'invalid tag'],
    [['--tag', '$(touch /tmp/pwned)'], 'invalid tag'],
    [['--name', 'two words'], 'invalid container name'],
    [['--port', 'abc'], 'invalid port'],
    [['--port', '70000'], 'invalid port'],
    [['--port', '0'], 'invalid port'],
    [['--platform', 'linux amd64'], 'invalid platform'],
    [['--engine', 'rm'], 'invalid engine'],
    [['--bogus'], 'unknown option'],
    [['--tag'], 'needs a value'],
  ];

  it.each(bad)('refuses %j before running anything', (args, message) => {
    const r = run(['--dry-run', ...args]);
    expect(r.status).toBe(2);
    expect(r.err).toContain(message);
    expect(r.cmds).toHaveLength(0);
  });
});

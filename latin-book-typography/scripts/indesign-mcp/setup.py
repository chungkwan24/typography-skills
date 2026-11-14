"""Generate machine-local pairing and MCP client config fragments; never register or load automatically."""
import argparse
import json
import os
from pathlib import Path
import secrets
import shlex


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mailbox', type=Path, help='Absolute nativePath returned by the loaded UXP plugin getDataFolder()')
    parser.add_argument('--python', type=Path, help='Absolute Python executable with requirements installed; default: this package .venv')
    parser.add_argument('--home', type=Path,
                        help='Absolute durable directory for runtime/ state and generated fragments; default: this package. '
                             'Choose one outside the installed skill so reinstalling or updating the skill keeps the pairing.')
    args = parser.parse_args()
    if args.mailbox and (not args.mailbox.is_absolute() or not args.mailbox.is_dir()):
        parser.error('--mailbox must be an existing absolute directory')
    if args.python and (not args.python.is_absolute() or not args.python.is_file()):
        parser.error('--python must be an existing absolute executable path')
    if args.home and not args.home.is_absolute():
        parser.error('--home must be an absolute directory path')
    home = args.home or root
    runtime = home / 'runtime'
    runtime.mkdir(parents=True, exist_ok=True)
    os.chmod(runtime, 0o700)
    token = runtime / 'token'
    if not token.exists():
        token.write_text(secrets.token_urlsafe(32))
    os.chmod(token, 0o600)
    # The plugin loads config.js from its own folder; rerun setup after reinstalling the skill.
    config = root / 'plugin/config.js'
    config.write_text('globalThis.BOOK_MCP_CONFIG=' + json.dumps({'token': token.read_text().strip()}) + ';\n')
    os.chmod(config, 0o600)
    if args.mailbox:
        mailbox = runtime / 'mailbox-path'
        mailbox.write_text(str(args.mailbox) + '\n')
        os.chmod(mailbox, 0o600)
    python = str(args.python or root / '.venv/bin/python')
    server = str(root / 'server.py')
    env = {'INDESIGN_MCP_HOME': str(home)} if args.home else {}

    codex = ('\n[mcp_servers.indesign_local]\ncommand = ' + json.dumps(python) +
             '\nargs = [' + json.dumps(server) + ']\nstartup_timeout_sec = 20\ntool_timeout_sec = 45\n')
    if env:
        codex += '[mcp_servers.indesign_local.env]\n' + ''.join(k + ' = ' + json.dumps(v) + '\n' for k, v in env.items())
    (home / 'codex-config.toml').write_text(codex)

    entry = {'type': 'stdio', 'command': python, 'args': [server]}
    if env:
        entry['env'] = env
    (home / 'claude-mcp.json').write_text(json.dumps({'mcpServers': {'indesign_local': entry}}, indent=2) + '\n')

    add = ['claude', 'mcp', 'add', 'indesign_local']
    for k, v in env.items():
        add += ['-e', k + '=' + v]
    add += ['--', python, server]
    print('Local pairing files are ready in ' + str(runtime) + '; credential omitted.')
    print('Config fragments: ' + str(home / 'claude-mcp.json') + ' (Claude Code .mcp.json) and ' +
          str(home / 'codex-config.toml') + ' (Codex).')
    print('Claude Code registration command, for review only (not run): ' + ' '.join(shlex.quote(a) for a in add))
    print('No MCP registration, plugin load, document operation, or dependency installation was performed.')


if __name__ == '__main__':
    main()

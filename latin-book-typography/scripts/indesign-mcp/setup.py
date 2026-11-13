"""Generate machine-local pairing and a stdio config fragment; never register or load automatically."""
import argparse
import json
import os
from pathlib import Path
import secrets


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mailbox', type=Path, help='Absolute nativePath returned by the loaded UXP plugin getDataFolder()')
    parser.add_argument('--python', type=Path, help='Absolute Python executable with requirements installed; default: this package .venv')
    args = parser.parse_args()
    if args.mailbox and (not args.mailbox.is_absolute() or not args.mailbox.is_dir()):
        parser.error('--mailbox must be an existing absolute directory')
    if args.python and (not args.python.is_absolute() or not args.python.is_file()):
        parser.error('--python must be an existing absolute executable path')
    runtime = root / 'runtime'
    runtime.mkdir(exist_ok=True)
    os.chmod(runtime, 0o700)
    token = runtime / 'token'
    if not token.exists():
        token.write_text(secrets.token_urlsafe(32))
    os.chmod(token, 0o600)
    config = root / 'plugin/config.js'
    config.write_text('globalThis.BOOK_MCP_CONFIG=' + json.dumps({'token': token.read_text().strip()}) + ';\n')
    os.chmod(config, 0o600)
    if args.mailbox:
        mailbox = runtime / 'mailbox-path'
        mailbox.write_text(str(args.mailbox) + '\n')
        os.chmod(mailbox, 0o600)
    python = args.python or root / '.venv/bin/python'
    fragment = root / 'codex-config.toml'
    fragment.write_text('\n[mcp_servers.indesign_local]\ncommand = ' + json.dumps(str(python)) +
                        '\nargs = [' + json.dumps(str(root / 'server.py')) +
                        ']\nstartup_timeout_sec = 20\ntool_timeout_sec = 45\n')
    print('Local pairing files and codex-config.toml are ready; credential omitted.')
    print('No MCP registration, plugin load, document operation, or dependency installation was performed.')


if __name__ == '__main__':
    main()

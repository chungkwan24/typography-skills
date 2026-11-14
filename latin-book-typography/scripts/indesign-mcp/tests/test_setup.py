import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SETUP = Path(__file__).resolve().parents[1] / 'setup.py'

class SetupTests(unittest.TestCase):
    def test_pairing_is_local_idempotent_and_does_not_print_token(self):
        with tempfile.TemporaryDirectory(prefix='mcp setup ') as tmp:
            root = Path(tmp); (root / 'plugin').mkdir()
            mailbox = root / 'mailbox'; mailbox.mkdir()
            shutil.copy2(SETUP, root / 'setup.py')
            cmd = [sys.executable, str(root / 'setup.py'), '--mailbox', str(mailbox), '--python', sys.executable]
            first = subprocess.run(cmd, check=True, capture_output=True, text=True)
            token = (root / 'runtime/token').read_text()
            self.assertNotIn(token, first.stdout + first.stderr)
            self.assertEqual((root / 'runtime/token').stat().st_mode & 0o777, 0o600)
            subprocess.run(cmd, check=True, capture_output=True)
            self.assertEqual(token, (root / 'runtime/token').read_text())
            self.assertEqual((root / 'runtime/mailbox-path').read_text().strip(), str(mailbox))
            config = (root / 'codex-config.toml').read_text()
            self.assertIn(json.dumps(str(root.resolve() / 'server.py')), config)
            self.assertNotIn(token, config)
            claude = json.loads((root / 'claude-mcp.json').read_text())
            entry = claude['mcpServers']['indesign_local']
            self.assertEqual(entry['args'], [str(root.resolve() / 'server.py')])
            self.assertNotIn('env', entry)
            self.assertNotIn(token, json.dumps(claude) + first.stdout)

    def test_home_keeps_runtime_outside_package(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'pkg'; (root / 'plugin').mkdir(parents=True)
            home = Path(tmp) / 'durable home'
            shutil.copy2(SETUP, root / 'setup.py')
            subprocess.run([sys.executable, str(root / 'setup.py'), '--home', str(home), '--python', sys.executable],
                           check=True, capture_output=True)
            self.assertTrue((home / 'runtime/token').is_file())
            self.assertFalse((root / 'runtime').exists())
            entry = json.loads((home / 'claude-mcp.json').read_text())['mcpServers']['indesign_local']
            self.assertEqual(entry['env'], {'INDESIGN_MCP_HOME': str(home)})
            self.assertIn('INDESIGN_MCP_HOME', (home / 'codex-config.toml').read_text())
            r = subprocess.run([sys.executable, str(root / 'setup.py'), '--home', 'relative'], capture_output=True)
            self.assertNotEqual(r.returncode, 0)

    def test_bad_mailbox_is_rejected_before_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); shutil.copy2(SETUP, root / 'setup.py')
            r = subprocess.run([sys.executable, str(root / 'setup.py'), '--mailbox', 'relative'], capture_output=True)
            self.assertNotEqual(r.returncode, 0)
            self.assertFalse((root / 'runtime').exists())

if __name__ == '__main__':
    unittest.main()

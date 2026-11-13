import importlib.util, threading, time, unittest, tempfile
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('bridge_server',Path(__file__).parents[1]/'server.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
class BridgeTests(unittest.TestCase):
 def live(self):
  b=s.Bridge('secret');b.poll({'session':'test-session','host':{}});return b
 def test_offline(self):
  with self.assertRaisesRegex(RuntimeError,'offline'):s.Bridge('x').call('list_documents',{})
 def test_pending_timeout_cancels(self):
  b=self.live()
  with self.assertRaisesRegex(TimeoutError,'cancelled'):b.call('list_documents',{},.01)
  self.assertIsNone(b.poll({'session':'test-session'})['job'])
 def running(self):
  b=self.live();errors=[]
  def run():
   try:b.call('list_documents',{},.05)
   except Exception as e:errors.append(e)
  t=threading.Thread(target=run);t.start()
  for _ in range(100):
   if b.job:break
   time.sleep(.001)
  j=b.poll({'session':'test-session'})['job'];return b,t,j,errors
 def test_unknown_blocks_retry_and_accepts_late_receipt(self):
  b,t,j,errors=self.running();t.join();self.assertEqual(b.job['state'],'unknown')
  with self.assertRaisesRegex(RuntimeError,'unresolved'):b.call('list_documents',{})
  with self.assertRaises(ValueError):b.result({'id':j['id'],'session':'wrong'})
  b.result({'id':j['id'],'session':'test-session','result':{'documents':[]}})
  self.assertEqual(b.job['state'],'complete')
  with self.assertRaises(ValueError):b.result({'id':j['id'],'session':'test-session'})
 def test_new_session_invalidates_running_request(self):
  b,t,j,errors=self.running();b.poll({'session':'new-session'});t.join()
  self.assertEqual(b.job['state'],'failed');self.assertTrue(errors)
 def test_single_instance(self):
  with tempfile.TemporaryDirectory() as tmp, patch.object(s,'RUNTIME',Path(tmp)):
   first=s.acquire_lock()
   try:
    with self.assertRaisesRegex(RuntimeError,'Another'):s.acquire_lock()
   finally:first.close()
if __name__=='__main__':unittest.main()

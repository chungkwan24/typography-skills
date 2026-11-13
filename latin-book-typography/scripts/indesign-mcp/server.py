"""Controlled stdio MCP -> authenticated private mailbox -> InDesign UXP."""
import asyncio, json, secrets, threading, time, uuid, fcntl
from pathlib import Path
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations
ROOT=Path(__file__).resolve().parent
RUNTIME=ROOT/'runtime'
mcp=FastMCP('InDesign Local Bridge')

class Bridge:
    def __init__(self, token):
        self.token=token; self.cv=threading.Condition(); self.session=None
        self.last_seen=0; self.host=None; self.job=None
    def status(self):
        with self.cv:
            return {'connected':bool(self.session and time.monotonic()-self.last_seen<6),
                    'host':self.host,'transport':'private plugin mailbox',
                    'job':{k:self.job[k] for k in ('id','operation','state')} if self.job else None}
    def poll(self, body):
        session=body.get('session')
        if not isinstance(session,str) or not 8<=len(session)<=100:raise ValueError('Invalid session')
        with self.cv:
            if session!=self.session:
                if self.job and self.job['state'] in ('pending','running','unknown'):
                    self.job['state']='failed'; self.job['error']='UXP session changed';self.cv.notify_all()
                self.session=session
            self.last_seen=time.monotonic();self.host=body.get('host')
            j=self.job
            if j and j['state']=='pending':
                j['state']='running';j['session']=session
                return {'job':{k:j[k] for k in ('id','operation','arguments')}}
            return {'job':None}
    def result(self, body):
        with self.cv:
            j=self.job
            if not j or body.get('id')!=j['id'] or body.get('session')!=j.get('session'):
                raise ValueError('Unmatched result')
            if j['state'] not in ('running','unknown'):raise ValueError('Already completed')
            j['state']='failed' if body.get('error') else 'complete'
            j['error']=body.get('error');j['result']=body.get('result');self.cv.notify_all()
            return {'accepted':True}
    def call(self, operation, arguments, timeout=30):
        with self.cv:
            if not self.session or time.monotonic()-self.last_seen>=6:raise RuntimeError('InDesign UXP is offline')
            if self.job and self.job['state'] in ('pending','running','unknown'):
                raise RuntimeError('A previous request is unresolved; inspect connection status, do not retry')
            j={'id':uuid.uuid4().hex,'operation':operation,'arguments':arguments,'state':'pending'}
            self.job=j;end=time.monotonic()+timeout
            while j['state'] in ('pending','running'):
                remaining=end-time.monotonic()
                if remaining<=0:
                    # An undelivered request can be cancelled; a delivered request is unknown.
                    j['state']='cancelled' if j['state']=='pending' else 'unknown'
                    raise TimeoutError('Request '+j['id']+' timed out; state='+j['state']+'; no automatic retry')
                self.cv.wait(remaining)
            if j['state']!='complete':raise RuntimeError(j.get('error','Request failed'))
            return {'request_id':j['id'],'status':'complete','data':j['result']}

bridge=None
@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
def get_connection_status() -> dict:
    """Read connection, host version and current request state; never queues a host operation."""
    return bridge.status()

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
async def list_documents() -> dict:
    """List InDesign document IDs, names, page counts and modified states. No manuscript text."""
    return await asyncio.to_thread(bridge.call,'list_documents',{})

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
async def inspect_document(document_id:int, expected_name:str) -> dict:
    """Read fonts, page order, sections and overset IDs for an explicitly identified document. No editing."""
    if isinstance(document_id,bool) or document_id<=0 or not expected_name:raise ValueError('Provide document ID and expected name')
    return await asyncio.to_thread(bridge.call,'inspect_document',{'document_id':document_id,'expected_name':expected_name})

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
async def list_text_frames(document_id:int, expected_name:str, physical_page:int) -> dict:
    """Read frame/story IDs and bounded previews on one physical page (cover=1)."""
    return await asyncio.to_thread(bridge.call,'list_text_frames',locals())

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
async def prepare_tracking_edit(document_id:int, expected_name:str, story_id:int,
                                start:int, length:int, expected_text:str, tracking:int) -> dict:
    """Preview a tracking-only edit on 1–128 story characters (zero-based); requires exact current text. No document changes. User rules govern the chosen value."""
    return await asyncio.to_thread(bridge.call,'prepare_tracking_edit',locals())

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=False))
async def apply_prepared_edit(plan_id:str) -> dict:
    """Apply a reviewed plan once after rechecking text/tracking. Writes a recovery receipt first. Does not save. Do not retry on timeout."""
    return await asyncio.to_thread(bridge.call,'apply_prepared_edit',locals())

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=False))
async def restore_edit(document_id:int, expected_name:str, transaction_id:str) -> dict:
    """Restore this session's recorded tracking edit only if current text/tracking still match. Not global InDesign Undo. Does not save."""
    return await asyncio.to_thread(bridge.call,'restore_edit',locals())

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
async def get_edit_record(transaction_id:str) -> dict:
    """Read the current plugin session's edit receipt; no DOM mutation."""
    return await asyncio.to_thread(bridge.call,'get_edit_record',locals())

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=False))
async def save_document(document_id:int, expected_name:str, expected_modified:bool) -> dict:
    """Explicitly save ALL current changes to this document's existing file. Requires authorization to save that file. No Save As, new version, PDF or close. Do not retry on timeout."""
    return await asyncio.to_thread(bridge.call,'save_document',locals())

def mailbox_worker(folder, stop):
    def read(name):
        try:
            data=json.loads((folder/name).read_text())
            if not secrets.compare_digest(data.get('token',''),bridge.token):return None
            return data
        except (OSError,ValueError,TypeError):return None
    delivered=None
    while not stop.wait(0.2):
        heartbeat=read('heartbeat.json')
        if not heartbeat or abs(time.time()-heartbeat.get('timestamp',0))>6:continue
        # Only actual plugin heartbeat timestamps count as live.
        poll=bridge.poll(heartbeat)
        if poll['job']:
            request={'token':bridge.token,'session':heartbeat['session'],'job':poll['job']}
            tmp=folder/'request.tmp'
            tmp.write_text(json.dumps(request));tmp.chmod(0o600)
            tmp.replace(folder/'request.json')
            delivered=poll['job']['id']
        result=read('result.json')
        if result and result.get('id')==delivered:
            try:bridge.result(result);delivered=None
            except ValueError:pass

def acquire_lock():
    lock=(RUNTIME/'server.lock').open('a')
    try:fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        raise RuntimeError('Another InDesign MCP server is running')
    return lock

def main():
    global bridge
    RUNTIME.mkdir(exist_ok=True)
    lock=acquire_lock()  # Keep descriptor alive until this server exits.
    token_path=RUNTIME/'token'
    if not token_path.exists():raise SystemExit('Run setup.py first')
    bridge=Bridge(token_path.read_text().strip())
    config=RUNTIME/'mailbox-path'
    if not config.exists():raise SystemExit('Set runtime/mailbox-path to the UXP private data directory')
    folder=Path(config.read_text().strip())
    if not folder.is_dir():raise SystemExit('UXP private mailbox directory does not exist')
    # Remove only stale bridge-owned command/result files before serving this session.
    for name in ('request.json','result.json'):
        (folder/name).unlink(missing_ok=True)
    stop=threading.Event()
    worker=threading.Thread(target=mailbox_worker,args=(folder,stop),daemon=True);worker.start()
    try:mcp.run(transport='stdio')
    finally:stop.set();worker.join(timeout=2)
if __name__=='__main__':main()

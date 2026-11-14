#!/usr/bin/env python3
"""Prepare a one-shot InDesign JSX job; never launches InDesign or edits documents."""
import argparse
import json
from pathlib import Path
import uuid

SERIALIZER = r'''
function encode(v) {
    function quote(s) { return '"' + String(s).replace(/[\\"\x00-\x1f]/g, function(c) {
        if (c === '"') return '\\"'; if (c === '\\') return '\\\\';
        var h=c.charCodeAt(0).toString(16); return '\\u' + ('0000'+h).slice(-4);
    }) + '"'; }
    if (v === null || typeof v === 'undefined') return 'null';
    if (typeof v === 'string') return quote(v);
    if (typeof v === 'number') return isFinite(v) ? String(v) : 'null';
    if (typeof v === 'boolean') return String(v);
    var a=[], k;
    if (v instanceof Array) { for(k=0;k<v.length;k++) a.push(encode(v[k])); return '['+a.join(',')+']'; }
    for(k in v) if(v.hasOwnProperty(k)) a.push(quote(k)+':'+encode(v[k]));
    return '{'+a.join(',')+'}';
}
'''

def literal(value):
    # ASCII source is reliable in ExtendScript even for Unicode paths.
    return json.dumps(str(value), ensure_ascii=True)


def prepare(payload, document, job_root):
    payload = Path(payload).expanduser().resolve(strict=True)
    document = Path(document).expanduser().resolve(strict=True)
    if payload.suffix.lower() != '.jsx' or document.suffix.lower() != '.indd':
        raise ValueError('Expected a .jsx payload and an existing .indd document')
    root = Path(job_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    job = root / ('job-' + uuid.uuid4().hex)
    job.mkdir()
    # Snapshot the payload: later source edits cannot alter an in-flight job.
    (job / 'payload.jsx').write_bytes(payload.read_bytes())
    status = job / 'status.json'
    config = {'jobId': job.name, 'expectedDocument': str(document),
              'payload': str(job / 'payload.jsx'), 'statusFile': str(status),
              'resultFile': str(job / 'result.json')}
    (job / 'config.json').write_text(json.dumps(config, indent=2)+'\n')
    wrapper = '''#target indesign
(function () {
''' + SERIALIZER + '''
var cfg = ''' + json.dumps(config, ensure_ascii=True) + ''';
var statusFile = File(cfg.statusFile);
function writeStatus(state, error) {
    statusFile.encoding='UTF-8';
    if(!statusFile.open('w')) throw Error('Cannot write job status');
    statusFile.write(encode({jobId:cfg.jobId,state:state,error:error || null,time:String(new Date())}));
    statusFile.close();
}
// A previous RUNNING, ERROR or COMPLETE is not permission to rerun a mutation.
if(statusFile.exists) return;
var oldUnit=app.scriptPreferences.measurementUnit;
var oldInteraction=app.scriptPreferences.userInteractionLevel;
try {
    writeStatus('RUNNING');
    if(app.documents.length===0) throw Error('No open document');
    // Match the open document by its saved full path; it need not be the active window.
    var doc=null, wanted=File(cfg.expectedDocument).fsName, n;
    for(n=0;n<app.documents.length;n++) {
        var d=app.documents[n];
        if(d.saved && File(d.fullName).fsName===wanted) { doc=d; break; }
    }
    if(!doc) throw Error('Expected document is not open (or not saved at that path)');
    app.scriptPreferences.measurementUnit=MeasurementUnits.POINTS;
    // Suppress modal dialogs so a job cannot sit blocked on an alert; restored in finally.
    app.scriptPreferences.userInteractionLevel=UserInteractionLevels.NEVER_INTERACT;
    // Payload is an expression evaluating to function(doc, job, helpers).
    // It must not save, close or export unless the current user task authorizes it.
    var run=$.evalFile(File(cfg.payload));
    if(typeof run!=='function') throw Error('Payload must evaluate to a function');
    var result=run(doc,cfg,{encode:encode});
    var f=File(cfg.resultFile); f.encoding='UTF-8';
    if(!f.open('w')) throw Error('Cannot write result');
    f.write(encode(result)); f.close();
    writeStatus('COMPLETE');
} catch(e) {
    writeStatus('ERROR',String(e)+'; line='+e.line);
} finally {
    app.scriptPreferences.measurementUnit=oldUnit;
    app.scriptPreferences.userInteractionLevel=oldInteraction;
}
})();
'''
    (job / 'run.jsx').write_text(wrapper, encoding='ascii')
    launcher = job / 'Run_InDesign_Job.jsx'
    launcher.write_text('#target indesign\n$.evalFile(File('+literal(job/'run.jsx')+'));\n', encoding='ascii')
    return {**config, 'runScript': str(job/'run.jsx'), 'panelLauncher': str(launcher)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--payload',required=True)
    parser.add_argument('--document',required=True)
    parser.add_argument('--job-root',required=True,help='Workspace work/ directory; no shared mutable current.jsx')
    args=parser.parse_args()
    print(json.dumps(prepare(args.payload,args.document,args.job_root),indent=2))

if __name__=='__main__':
    main()

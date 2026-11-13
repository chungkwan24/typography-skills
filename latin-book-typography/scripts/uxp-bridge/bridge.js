/* Native InDesign UXP helpers. No typography policy, implicit save or export. */
(() => {
  'use strict';
  let busy = false;
  const app = () => require('indesign').app;
  const guarded = expected => {
    if (!expected || !Number.isInteger(expected.id) || typeof expected.name !== 'string') {
      throw Error('Supply the document id and name returned by inspect().');
    }
    const a = app();
    if (!a.documents.length) throw Error('No open document.');
    const d = a.activeDocument;
    if (d.id !== expected.id || d.name !== expected.name) throw Error('Active document identity changed.');
    return d;
  };
  async function exclusive(fn) {
    if (busy) throw Error('Another bridge operation is running; do not queue retries.');
    busy = true;
    try { return await fn(); } finally { busy = false; }
  }
  function inspect({details = false} = {}) {
    const a = app();
    if (!a || !a.documents.length) throw Error('No open document.');
    const d = a.activeDocument;
    const r = {engine:'UXP', hostVersion:a.version, id:d.id, name:d.name,
      modified:d.modified, pages:d.pages.length, facingPages:d.documentPreferences.facingPages,
      fonts:[]};
    for (let i=0;i<d.fonts.length;i++) {
      const f=d.fonts.item(i);
      r.fonts.push({name:f.name,status:String(f.status)});
    }
    if (details) {
      r.pageOrder=[]; r.sections=[]; r.oversetStoryIds=[];
      for(let i=0;i<d.pages.length;i++) {
        const p=d.pages.item(i);
        r.pageOrder.push({physical:i+1,label:p.name,side:String(p.side)});
      }
      for(let i=0;i<d.sections.length;i++) {
        const s=d.sections.item(i);
        r.sections.push({physical:s.pageStart.documentOffset+1,start:s.pageNumberStart,
          style:String(s.pageNumberStyle),continueNumbering:s.continueNumbering});
      }
      for(let i=0;i<d.stories.length;i++) {
        const s=d.stories.item(i); if(s.overflows) r.oversetStoryIds.push(s.id);
      }
    }
    return r;
  }
  function closeSaved(expected) {
    return exclusive(async()=>{
      const d=guarded(expected);
      if(d.modified) throw Error('Document has unsaved changes; save or resolve them explicitly first.');
      const name=d.name;
      await d.close(require('indesign').SaveOptions.NO);
      return {closed:name,openDocuments:app().documents.length};
    });
  }
  function openPath(path) {
    return exclusive(async()=>{
      if(typeof path!=='string' || !(/^(\/|[A-Za-z]:[\\/])/.test(path)) || !/\.indd$/i.test(path)) {
        throw Error('Supply an authorized absolute INDD filesystem path.');
      }
      if(app().documents.length) throw Error('For this controlled recipe, close the saved target in a separate invocation first.');
      const d=await app().open(path);
      return {id:d.id,name:d.name,pages:d.pages.length,modified:d.modified,openedPath:path};
    });
  }
  const api={inspect,closeSaved,openPath};
  globalThis.bookUXP=api;
  if(typeof module!=='undefined') module.exports=api;
})();

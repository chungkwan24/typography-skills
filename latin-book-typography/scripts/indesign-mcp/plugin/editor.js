/* Host mechanics only. Typography decisions belong to SKILL.md and the task. */
(() => {
 function createEditor(app, write, session, read) {
  const plans=new Map(), records=new Map();
  function doc(args) {
   if(!Number.isInteger(args.document_id)||args.document_id<=0||typeof args.expected_name!=='string')throw Error('Invalid document identity');
   const d=app().documents.itemByID(args.document_id);
   if(!d||!d.isValid||d.name!==args.expected_name)throw Error('Document identity mismatch');
   return d;
  }
  function story(d,id) {
   const s=d.stories.itemByID(id);
   if(!Number.isInteger(id)||!s||!s.isValid)throw Error('Story identity mismatch');
   return s;
  }
  function text(s) {
   // Read once; never walk whole-story characters or textStyleRanges.
   if(s.characters.length>250000)throw Error('Story exceeds prototype inspection limit');
   const value=s.contents;
   if(typeof value!=='string')throw Error('Unsupported story contents');
   return value;
  }
  function snapshot(d,s,start,length) {
   if(!Number.isInteger(start)||!Number.isInteger(length)||start<0||length<1||length>128||start+length>s.characters.length)throw Error('Range must contain 1–128 existing characters');
   const tracking=[], characters=[];
   for(let i=start;i<start+length;i++) {
    const character=s.characters.item(i),value=character.tracking;
    if(typeof character.contents!=='string')throw Error('Unsupported character contents');
    characters.push(character.contents);
    if(typeof value!=='number'||!Number.isFinite(value))throw Error('Unsupported tracking value');
    tracking.push(value);
   }
   return {storyText:text(s),rangeText:characters.join(''),tracking};
  }
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function verify(actual, baseline, values) {
   if(actual.storyText!==baseline.storyText||actual.rangeText!==baseline.rangeText||!same(actual.tracking,values))throw Error('Stale edit: text or tracking changed; inspect and prepare again');
  }
  function target(p) {
   const d=doc(p),s=story(d,p.story_id);return {d,s};
  }
  function assign(s,start,values) {
   // Group contiguous equal values for bounded restoration; do not touch other properties.
   for(let i=0;i<values.length;) {
    let j=i+1;while(j<values.length&&values[j]===values[i])j++;
    s.characters.itemByRange(start+i,start+j-1).tracking=values[i];i=j;
   }
  }
  function publicRecord(r) {
   return {transaction_id:r.id,session:r.session,document_id:r.document_id,expected_name:r.expected_name,
    story_id:r.story_id,start:r.start,length:r.length,state:r.state,
    before_tracking:r.before,after_tracking:r.after,error:r.error||null};
  }
  async function guardMutations() {
   const last=await read('mutation-state.json');
   if(last&&['applying','restoring','unknown'].includes(last.state))throw Error('Unresolved edit '+last.transaction_id+'; inspect durable journal before further mutation');
  }
  async function persist(r) {
   // Do not persist the full story: keep the exact range and reversible values only.
   await write('transaction-'+r.id+'.json',{...publicRecord(r),range_text:r.baseline.rangeText});
   if(r.state!=='prepared')await write('mutation-state.json',publicRecord(r));
  }
  return {
   async execute(job) {
    const args=job.arguments||{};
    if(job.operation==='list_text_frames') {
     const d=doc(args);
     if(!Number.isInteger(args.physical_page)||args.physical_page<1||args.physical_page>d.pages.length)throw Error('Invalid physical page');
     const page=d.pages.item(args.physical_page-1),frames=[];
     if(page.textFrames.length>100)throw Error('Page exceeds frame inspection limit');
     for(let i=0;i<page.textFrames.length;i++) {
      const f=page.textFrames.item(i),s=f.parentStory;
      frames.push({frame_id:f.id,story_id:s.id,story_length:s.characters.length,
       start:f.insertionPoints.item(0).index,length:f.characters.length,preview:String(f.contents).slice(0,80)});
     }
     return {document_id:d.id,name:d.name,physical_page:args.physical_page,frames};
    }
    if(job.operation==='prepare_tracking_edit') {
     const d=doc(args),s=story(d,args.story_id);
     if(!Number.isInteger(args.tracking)||Math.abs(args.tracking)>1000)throw Error('Tracking must be an integer in the DOM-supported prototype range -1000…1000');
     const baseline=snapshot(d,s,args.start,args.length);
     if(typeof args.expected_text!=='string'||baseline.rangeText!==args.expected_text)throw Error('Expected text mismatch');
     if(baseline.tracking.every(v=>v===args.tracking))throw Error('No-op edit');
     if(plans.size>=20)throw Error('Plan limit reached; reload plugin after resolving edits');
     const p={...args,id:job.id,baseline,expires:Date.now()+300000};plans.set(p.id,p);
     return {plan_id:p.id,document_id:d.id,name:d.name,story_id:s.id,start:p.start,length:p.length,
      text:baseline.rangeText,before_tracking:baseline.tracking,after_tracking:args.tracking,expires_in_seconds:300,
      scope:'Tracking only. No typography compliance or pagination approval implied.'};
    }
    if(job.operation==='apply_prepared_edit') {
     await guardMutations();
     const p=plans.get(args.plan_id);
     if(!p||Date.now()>p.expires)throw Error('Unknown or expired plan; prepare again');
     const {d,s}=target(p);verify(snapshot(d,s,p.start,p.length),p.baseline,p.baseline.tracking);
     const r={...p,id:job.id,session,state:'prepared',before:p.baseline.tracking,after:Array(p.length).fill(p.tracking)};
     records.set(r.id,r);
     await persist(r); // Write-ahead record must succeed before any mutation.
     // Recheck after asynchronous I/O; the user may have edited the range.
     verify(snapshot(d,s,p.start,p.length),p.baseline,r.before);
     plans.delete(p.id);r.state='applying';await persist(r);
     verify(snapshot(d,s,p.start,p.length),p.baseline,r.before);
     try {
      assign(s,p.start,r.after);d.recompose();
      verify(snapshot(d,s,p.start,p.length),p.baseline,r.after);
      r.state='applied';await persist(r);
     } catch(e) {
      r.state='unknown';r.error=String(e);
      try{await persist(r);}catch(_){}
      throw Error('Edit '+r.id+' unresolved; inspect record before any further edit: '+e);
     }
     return publicRecord(r);
    }
    if(job.operation==='restore_edit') {
     await guardMutations();
     const r=records.get(args.transaction_id);
     if(!r||r.session!==session||r.document_id!==args.document_id||r.expected_name!==args.expected_name)throw Error('Unknown edit or document/session mismatch');
     if(r.state!=='applied')throw Error('Only a verified applied edit can be restored');
     const {d,s}=target(r);verify(snapshot(d,s,r.start,r.length),r.baseline,r.after);
     r.state='restoring';await persist(r);
     // Refuse to overwrite user edits that happened while the receipt was written.
     try {
      verify(snapshot(d,s,r.start,r.length),r.baseline,r.after);
      assign(s,r.start,r.before);d.recompose();
      verify(snapshot(d,s,r.start,r.length),r.baseline,r.before);
      r.state='restored';await persist(r);
     }catch(e){r.state='unknown';r.error=String(e);try{await persist(r);}catch(_){}throw e;}
     return publicRecord(r);
    }
    if(job.operation==='get_edit_record') {
     const r=records.get(args.transaction_id);
     if(!r)throw Error('Unknown edit in this plugin session');
     return publicRecord(r);
    }
    if(job.operation==='save_document') {
     await guardMutations();
     const d=doc(args);
     if(!d.saved)throw Error('Save As is not supported; save the document to an authorized path first');
     if(typeof args.expected_modified!=='boolean'||d.modified!==args.expected_modified)throw Error('Modified state changed; inspect before saving');
     if([...records.values()].some(r=>r.document_id===d.id&&['applying','restoring','unknown'].includes(r.state)))throw Error('Resolve uncertain edits before saving');
     // Existing file only: no caller-supplied path, Save As, export or version suffix.
     await d.save();
     if(d.modified)throw Error('Save returned but document remains modified; inspect before retrying');
     return {document_id:d.id,name:d.name,saved:d.saved,modified:d.modified,scope:'Saved all current changes in the existing file'};
    }
    throw Error('Unsupported controlled operation');
   }
  };
 }
 globalThis.createBookMCPEditor=createEditor;
})();

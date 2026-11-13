/* Allowlisted native operations only. Never evaluate request code. */
(() => {
 const config=globalThis.BOOK_MCP_CONFIG;
 const session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 let stopped=false,timer;
 const state=globalThis.bookMCP={session,mailboxReady:false,lastError:null,stop(){stopped=true;clearTimeout(timer);}};
 const app=()=>require('indesign').app;
 async function execute(job){
   const a=app();
   if(!a)throw Error('InDesign DOM not ready');
   if(job.operation==='list_documents'){
     const result=[];
     for(let i=0;i<a.documents.length;i++){const d=a.documents.item(i);result.push({id:d.id,name:d.name,pages:d.pages.length,modified:d.modified});}
     return {documents:result};
   }
   if(job.operation!=='inspect_document')return editor.execute(job);
   const args=job.arguments||{};
   if(!Number.isInteger(args.document_id)||typeof args.expected_name!=='string')throw Error('Invalid document identity');
   const d=a.documents.itemByID(args.document_id);
   if(!d||!d.isValid||d.name!==args.expected_name)throw Error('Document identity mismatch');
   if(d.pages.length>2000||d.stories.length>5000)throw Error('Inspection exceeds prototype limits');
   const r={id:d.id,name:d.name,pages:d.pages.length,modified:d.modified,facingPages:d.documentPreferences.facingPages,fonts:[],pageOrder:[],sections:[],oversetStoryIds:[]};
   for(let i=0;i<d.fonts.length;i++){const f=d.fonts.item(i);r.fonts.push({name:f.name,status:String(f.status)});}
   for(let i=0;i<d.pages.length;i++){const p=d.pages.item(i);r.pageOrder.push({physical:i+1,label:p.name,side:String(p.side)});}
   for(let i=0;i<d.sections.length;i++){const s=d.sections.item(i);r.sections.push({physical:s.pageStart.documentOffset+1,start:s.pageNumberStart,style:String(s.pageNumberStyle)});}
   for(let i=0;i<d.stories.length;i++){const s=d.stories.item(i);if(s.overflows)r.oversetStoryIds.push(s.id);}
   r.scope='Page order, numbering sections, font statuses and story overflow only; not a complete print preflight.';
   return r;
 }
 let folder,lastId=null,pendingReceipt=null;
 const editor=globalThis.createBookMCPEditor(app,write,session,async name=>{
  const entries=await folder.getEntries(),file=entries.find(entry=>entry.name===name);
  return file?JSON.parse(await file.read()):null;
 });
 async function write(name,value){
   const file=await folder.createFile(name,{overwrite:true});
   await file.write(JSON.stringify(value));
 }
 async function tick(){
   if(stopped)return;
   try{
     if(!folder)folder=await require('uxp').storage.localFileSystem.getDataFolder();
     const a=app();
     await write('heartbeat.json',{token:config.token,session,timestamp:Date.now()/1000,host:{application:'InDesign',version:a?a.version:null}});
     state.mailboxReady=true;state.lastError=null;
     let request;
     try{request=JSON.parse(await (await folder.getEntry('request.json')).read());}catch(e){request=null;}
     if(pendingReceipt){await write('result.json',pendingReceipt);pendingReceipt=null;}
     if(request&&request.token===config.token&&request.session===session&&request.job&&request.job.id!==lastId){
       const job=request.job;lastId=job.id;
       let result,error;try{result=await execute(job);}catch(e){error=String(e);}
       // Keep a completion receipt; never execute the same ID again.
       pendingReceipt={token:config.token,id:job.id,session,result,error};
       await write('result.json',pendingReceipt);pendingReceipt=null;
     }
   }catch(e){state.mailboxReady=false;state.lastError=String(e);}
   if(!stopped)timer=setTimeout(tick,1000);
 }
 require('uxp').entrypoints.setup({commands:{bridgeStatus(){console.log(JSON.stringify({mailboxReady:state.mailboxReady,lastError:state.lastError}));}}});
 tick();
})();

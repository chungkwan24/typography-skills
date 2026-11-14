const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync(require('path').join(__dirname,'../plugin/editor.js'),'utf8');
async function run(){
 let passed=0;
 function fixture({failWrite=false,onWrite=null}={}){
  const values=[0,1,2,3,0],content={value:'Hello'},files=new Map();
  const story={id:9,isValid:true,get contents(){return content.value;},characters:{get length(){return content.value.length;},
   item(i){return {get contents(){return content.value[i];},get tracking(){return values[i];}};},itemByRange(a,b){return {get contents(){return content.value.slice(a,b+1);},set tracking(n){for(let i=a;i<=b;i++)values[i]=n;}};}}};
  const d={id:2,isValid:true,name:'Fixture.indd',saved:true,modified:true,stories:{itemByID(id){return id===9?story:null;}},recompose(){},async save(){this.modified=false;}};
  const app={documents:{itemByID(id){return id===2?d:null;}}};
  const context={};vm.createContext(context);vm.runInContext(code,context);
  const writer=async(n,v)=>{if(failWrite)throw Error('Disk unavailable');files.set(n,JSON.parse(JSON.stringify(v)));if(onWrite)onWrite(n,v,content,values);};
  const make=()=>context.createBookMCPEditor(()=>app,writer,'session-1',async n=>files.get(n)||null);
  let editor=make(),counter=0;
  return {values,content,files,d,reload(){editor=make();},call(operation,args={}){return editor.execute({id:'request-'+(++counter),operation,arguments:{document_id:2,expected_name:'Fixture.indd',...args}});}};
 }
 async function plan(f,args={}){return f.call('prepare_tracking_edit',{story_id:9,start:0,length:5,expected_text:'Hello',tracking:-5,...args});}
 async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
 await check('apply and restore mixed tracking exactly',async()=>{
  const f=fixture(),p=await plan(f),r=await f.call('apply_prepared_edit',{plan_id:p.plan_id});
  assert.deepEqual(f.values,[-5,-5,-5,-5,-5]);assert.equal(r.state,'applied');
  await f.call('restore_edit',{transaction_id:r.transaction_id});assert.deepEqual(f.values,[0,1,2,3,0]);assert.equal(f.content.value,'Hello');
  await assert.rejects(f.call('restore_edit',{transaction_id:r.transaction_id}));
 });
 await check('wrong document and wrong expected text rejected',async()=>{const f=fixture();await assert.rejects(plan(f,{document_id:99}));await assert.rejects(plan(f,{expected_text:'Other'}));});
 await check('stale text plan refuses mutation',async()=>{const f=fixture(),p=await plan(f);f.content.value='Hallo';await assert.rejects(f.call('apply_prepared_edit',{plan_id:p.plan_id}));assert.deepEqual(f.values,[0,1,2,3,0]);});
 await check('stale tracking plan refuses mutation',async()=>{const f=fixture(),p=await plan(f);f.values[0]=44;await assert.rejects(f.call('apply_prepared_edit',{plan_id:p.plan_id}));assert.equal(f.values[0],44);});
 await check('cannot overwrite manual edits during restoration',async()=>{const f=fixture(),p=await plan(f),r=await f.call('apply_prepared_edit',{plan_id:p.plan_id});f.values[1]=12;await assert.rejects(f.call('restore_edit',{transaction_id:r.transaction_id}));assert.equal(f.values[1],12);});
 await check('write-ahead failure leaves document untouched',async()=>{const f=fixture({failWrite:true}),p=await plan(f);await assert.rejects(f.call('apply_prepared_edit',{plan_id:p.plan_id}));assert.deepEqual(f.values,[0,1,2,3,0]);});
 await check('consumed plan cannot execute twice',async()=>{const f=fixture(),p=await plan(f);await f.call('apply_prepared_edit',{plan_id:p.plan_id});await assert.rejects(f.call('apply_prepared_edit',{plan_id:p.plan_id}));});
 await check('unknown journal blocks mutations after plugin reload',async()=>{const f=fixture();f.files.set('mutation-state.json',{state:'unknown',transaction_id:'unresolved'});f.reload();const p=await plan(f);await assert.rejects(f.call('apply_prepared_edit',{plan_id:p.plan_id}));await assert.rejects(f.call('save_document',{expected_modified:true}));});
 await check('save refuses unsaved document and stale modified state',async()=>{const f=fixture();f.d.saved=false;await assert.rejects(f.call('save_document',{expected_modified:true}));f.d.saved=true;await assert.rejects(f.call('save_document',{expected_modified:false}));});
 await check('save existing document verifies clean state',async()=>{const f=fixture(),r=await f.call('save_document',{expected_modified:true});assert.equal(r.modified,false);});
 await check('bounded ranges and integral tracking',async()=>{const f=fixture();for(const args of [{length:129},{start:-1},{tracking:0.2},{tracking:1001}])await assert.rejects(plan(f,args));});
 await check('edit refused after applying receipt is aborted, not blocking',async()=>{
  // The user types while the applying receipt is written; nothing is mutated, so later saves stay allowed.
  const f=fixture({onWrite(n,v,content){if(v.state==='applying')content.value='Hallo';}}),p=await plan(f);
  await assert.rejects(f.call('apply_prepared_edit',{plan_id:p.plan_id}));
  assert.deepEqual(f.values,[0,1,2,3,0]);assert.equal(f.files.get('mutation-state.json').state,'aborted');
  await f.call('save_document',{expected_modified:true});
 });
 await check('restore refused after restoring receipt keeps edit applied, not blocking',async()=>{
  const f=fixture({onWrite(n,v,content,values){if(v.state==='restoring')values[2]=7;}}),p=await plan(f),r=await f.call('apply_prepared_edit',{plan_id:p.plan_id});
  await assert.rejects(f.call('restore_edit',{transaction_id:r.transaction_id}));
  assert.equal(f.values[2],7);assert.equal(f.files.get('mutation-state.json').state,'applied');
  await f.call('save_document',{expected_modified:true});
 });
 await check('reload invalidates prepared plans',async()=>{const f=fixture(),p=await plan(f);f.reload();await assert.rejects(f.call('apply_prepared_edit',{plan_id:p.plan_id}));});
 return {passed};
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});

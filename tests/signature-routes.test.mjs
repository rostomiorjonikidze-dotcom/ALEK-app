import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import * as bodyReader from '../app/lib/request-body.ts';
import * as validation from '../app/lib/signature-validation.ts';
const token='a'.repeat(64);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const snapshot={business_name:'Entreprise de test',document_number:'D-TEST',total_ttc:120,user_id:'private-owner'};
const stable=value=>JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])));
const pending=()=>({id:'request',status:'pending',document_snapshot:snapshot,snapshot_sha256:sha(stable(snapshot)),expires_at:'2099-01-01T00:00:00Z'});
function route(row, {updated=true,fail=false,user={id:'owner'},path='[token]/'}={}) {
 const calls=[];
 let writing=false;
 const query={};
 for(const method of ['select','eq','gt','order','limit','update','insert'])query[method]=(...args)=>{calls.push([method,...args]);if(method==='update')writing=true;return query;};
 query.maybeSingle=async()=>({data:writing?(updated?{id:'request'}:null):row,error:null});
 const exports={};
 runInNewContext(ts.transpileModule(readFileSync('app/api/signatures/'+path+'route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports,Buffer,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'mock-key'}},
  require(name){
   if(name==='node:crypto')return crypto;
   if(name==='next/server')return {NextResponse:Response};
   if(name.endsWith('/request-body'))return bodyReader;
   if(name.endsWith('/signature-validation'))return validation;
   if(name.endsWith('/site-url'))return {SITE_URL:'https://example.invalid'};
   if(name.endsWith('/_shared'))return {admin:()=>{if(fail)throw Error('private configuration');return {from(table){calls.push(['from',table]);return query;}};},userFrom:async()=>user};
   throw Error('Unexpected dependency: '+name);
  },
 });
 return {exports,calls};
}
const params={params:Promise.resolve({token})};
const request=(body)=>new Request('https://example.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const signature='data:image/png;base64,'+Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(500)]).toString('base64');
test('public signature view hashes token and excludes private snapshot fields',async()=>{
 const {exports,calls}=route(pending());const res=await exports.GET(null,params);
 assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
 const data=await res.json();assert.equal(data.doc.document_number,'D-TEST');assert.equal('user_id' in data.doc,false);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='token_hash'&&c[2]===sha(token)));
});
test('invalid, revoked, expired, tampered and unavailable signature links fail closed',async()=>{
 const cases=[[null,404],[{...pending(),status:'cancelled'},410],[{...pending(),expires_at:'invalid'},410],[{...pending(),snapshot_sha256:'tampered'},409]];
 for(const [row,status] of cases)assert.equal((await route(row).exports.GET(null,params)).status,status);
 assert.equal((await route(pending(),{fail:true}).exports.GET(null,params)).status,503);
 const invalid=route(pending());assert.equal((await invalid.exports.GET(null,{params:Promise.resolve({token:'not-a-token'})})).status,404);assert.equal(invalid.calls.length,0);
});
test('acceptance uses atomic status, expiry and snapshot guards; concurrent loss returns conflict',async()=>{
 const {exports,calls}=route(pending());const res=await exports.POST(request({name:'Client Test',accept:true,signature}),params);
 assert.equal(res.status,200);
 for(const [key,value] of [['status','pending'],['snapshot_sha256',pending().snapshot_sha256],['id','request']])assert.ok(calls.some(c=>c[0]==='eq'&&c[1]===key&&c[2]===value));
 assert.ok(calls.some(c=>c[0]==='gt'&&c[1]==='expires_at'));
 const raced=route(pending(),{updated:false});assert.equal((await raced.exports.POST(request({name:'Client Test',accept:true,signature}),params)).status,409);
});
test('signature rejects replay and nonboolean consent without writes',async()=>{
 for(const [row,accept,status] of [[pending(),'true',400],[{...pending(),status:'signed'},true,409]]){
  const r=route(row);assert.equal((await r.exports.POST(request({name:'Client Test',accept,signature}),params)).status,status);assert.ok(!r.calls.some(c=>c[0]==='update'));
 }
});
test('signature creation requires ownership and a persisted quote',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const r=route(null,{path:''});assert.equal((await r.exports.POST(request({documentId:id}))).status,404);
 assert.ok(r.calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner'));
 assert.ok(!r.calls.some(c=>c[0]==='insert'));
 assert.equal((await route(null,{path:'',user:null}).exports.POST(request({documentId:id}))).status,401);
});

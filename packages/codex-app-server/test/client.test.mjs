import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CodexAppServerClient } from "../dist/index.js";

test("generation handles early completion, provider errors, process exit and restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "review-codex-test-"));
  const originalPath = process.env.PATH;
  const client = new CodexAppServerClient();
  await writeFile(join(directory, "codex"), `#!${process.execPath}
const {createInterface}=require('node:readline');
const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');
createInterface({input:process.stdin}).on('line',(line)=>{
 const request=JSON.parse(line);
 if(!request.id)return;
 let result={};
 if(request.method==='model/list')result={data:[{model:'supported-model',isDefault:true}]};
 if(request.method==='thread/start')result={thread:{id:'thread-1'}};
 if(request.method==='turn/start'){
   const prompt=request.params.input[0].text;
   if(prompt==='exit')process.exit(1);
   send({method:'item/completed',params:{threadId:'thread-1',item:{type:'agentMessage',phase:'final_answer',text:'{"ok":true}'}}});
   send({method:'turn/completed',params:{threadId:'thread-1',turn:{status:prompt==='fail'?'failed':'completed',error:prompt==='fail'?{message:'Provider unavailable'}:null}}});
   result={turn:{id:'turn-1'}};
 }
 send({id:request.id,result});
});
`, { mode: 0o755 });
  process.env.PATH = `${directory}:${originalPath ?? ""}`;
  const input = { cwd: directory, instructions: "Return JSON.", outputSchema: { type: "object" } };
  try {
    assert.equal(await client.generateStructuredText({ ...input, prompt: "success" }), '{"ok":true}');
    await assert.rejects(client.generateStructuredText({ ...input, prompt: "fail" }), /Provider unavailable/);
    await assert.rejects(client.generateStructuredText({ ...input, prompt: "exit" }), /exited/);
    assert.equal(await client.generateStructuredText({ ...input, prompt: "success" }), '{"ok":true}');
  } finally {
    client.stop();
    process.env.PATH = originalPath;
    await rm(directory, { recursive: true, force: true });
  }
});

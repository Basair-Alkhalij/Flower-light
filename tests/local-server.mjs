import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..',process.env.FL_TEST_DIST==='1'?'dist':'.');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.sql':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://127.0.0.1:${port}`);
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/'||pathname==='')pathname='/index.html';
  const target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end('forbidden');return;}
  fs.stat(target,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(target).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(target).pipe(res);
  });
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`FLOWER_LIGHT_FINAL_TEST_SERVER ${port}\n`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));

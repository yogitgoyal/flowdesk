(async()=>{
  const base='http://localhost:3000';
  const email='test+'+Date.now()+'@example.com';
  console.log('email',email);
  const reg=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'pass1234',name:'Tester'})});
  console.log('register status',reg.status);
  const regBody=await reg.json().catch(()=>null);
  console.log('regBody',regBody);
  const setCookie=reg.headers.get('set-cookie');
  console.log('set-cookie header',setCookie);
  let cookies='';
  if(setCookie){
    const parts=setCookie.split(/, (?=[^ ;]+=)/);
    for(const p of parts){
      const kv=p.split(';')[0];
      cookies+=kv+'; ';
    }
  }
  if(regBody&&regBody.accessToken){cookies+='access_token='+regBody.accessToken+'; ';}
  console.log('cookies to send',cookies);

  // create workspace
  const wsRes=await fetch(base+'/api/workspaces',{method:'POST',headers:{'content-type':'application/json','cookie':cookies},body:JSON.stringify({name:'Test WS'})});
  console.log('workspace status',wsRes.status);
  const ws=await wsRes.json();
  console.log('workspace',ws);

  // create project
  const projRes=await fetch(base+`/api/workspaces/${ws.id}/projects`,{method:'POST',headers:{'content-type':'application/json','cookie':cookies},body:JSON.stringify({name:'Test Project'})});
  console.log('project status',projRes.status);
  const proj=await projRes.json();
  console.log('project',proj);

  // get project
  const projGet=await fetch(base+`/api/projects/${proj.id}`,{headers:{'cookie':cookies}});
  console.log('get project',projGet.status);
  const projDetails=await projGet.json();
  console.log('proj details columns count',projDetails.columns.length);
  const firstCol=projDetails.columns[0].id;
  const doneCol=projDetails.columns.find(c=>c.name.toLowerCase()==='done')?.id;
  console.log('firstCol, doneCol',firstCol,doneCol);

  // create a task
  const taskRes=await fetch(base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json','cookie':cookies},body:JSON.stringify({projectId:proj.id,columnId:firstCol,title:'Hello Task'})});
  console.log('create task',taskRes.status);
  const task=await taskRes.json();
  console.log('task',task.id,task.title);

  // list tasks
  const listRes=await fetch(base+`/api/tasks?projectId=${proj.id}`,{headers:{'cookie':cookies}});
  console.log('list status',listRes.status);
  const list=await listRes.json();
  console.log('list total',list.total);

  // move to done
  if(doneCol){
    const patchRes=await fetch(base+`/api/tasks/${task.id}`,{method:'PATCH',headers:{'content-type':'application/json','cookie':cookies},body:JSON.stringify({columnId:doneCol,expectedVersion:task.version})});
    console.log('patch status',patchRes.status);
    const patched=await patchRes.json();
    console.log('patched.completedAt',patched.completedAt);
  }else{console.log('no done column');}

  // analytics
  const anRes=await fetch(base+`/api/dashboard/analytics?projectId=${proj.id}`,{headers:{'cookie':cookies}});
  console.log('analytics status',anRes.status);
  const an=await anRes.json();
  console.log('analytics',an);

  // uploads
  const upRes=await fetch(base+'/api/uploads',{headers:{'cookie':cookies}});
  console.log('uploads status',upRes.status);
  const up=await upRes.json();
  console.log('uploads',up);

})();

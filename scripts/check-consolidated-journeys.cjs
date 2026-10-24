const {chromium,expect}=require('../apps/web/node_modules/@playwright/test');
async function main(){
 const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox']});
 try{
  for(const role of ['gerente','analista','cliente']){
   const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Fortaleza'}),page=await context.newPage(),base='http://127.0.0.1:8070',portal=role==='gerente'?'/gerencia':role==='analista'?'/analista':'/cliente';
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'/login',{waitUntil:'domcontentloaded'});
   await expect(async()=>{await page.getByRole('button',{name:role==='gerente'?/^Gerente/:role==='analista'?/^Analista · Anderson/:/^Cliente · Meganet/}).click();await expect(page.locator('#auth-password')).not.toHaveValue('');}).toPass({timeout:30000});
   const login=await context.request.post(base+'/api/public/auth/login',{headers:{origin:base},data:{identifier:await page.locator('#auth-identifier').inputValue(),password:await page.locator('#auth-password').inputValue()}});expect(login.status(),role).toBe(200);
   await page.goto(base+portal,{waitUntil:'domcontentloaded'});
   console.log(role+': painel carregado');
   if(role==='cliente'){
    const portalResponse=await context.request.get(base+'/api/erp/customer-portal');
    const portalData=await portalResponse.json();console.log(JSON.stringify({role,status:portalResponse.status(),total:portalData.total,orders:portalData.orders?.length,error:portalData.error}));
    await expect(page.getByRole('heading',{name:'Painel de ocorrências',exact:true})).toBeVisible();
    expect(portalResponse.ok()).toBe(true);
    if(portalData.orders?.length){await expect(page.getByRole('link',{name:'Ver detalhes',exact:true}).first()).toBeVisible();await page.getByRole('link',{name:'Ver detalhes',exact:true}).first().click();await expect(page.getByRole('link',{name:/Meus atendimentos/})).toBeVisible();}
    else await expect(page.getByText(/Nenhum atendimento compartilhado|Nenhuma O.S. neste filtro/)).toBeVisible();
    expect((await context.request.get(base+'/api/erp/knowledge/credentials')).status()).toBe(403);
    expect((await context.request.get(base+'/api/erp/service-processes/operational')).status()).toBe(403);
   }else{
    await expect(page.getByRole('heading',{name:role==='gerente'?'Evolução dos atendimentos':'Minhas O.S. · evolução',exact:true})).toBeVisible({timeout:60000});
    await expect(page.locator('.recharts-surface').first()).toBeVisible();
    await page.goto(base+portal+'/ordens',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('button',{name:'Novo atendimento',exact:true}).first()).toBeVisible();
    await expect(async()=>{
     if(!await page.getByRole('dialog').isVisible())await page.getByRole('button',{name:'Novo atendimento',exact:true}).first().click();
     await expect(page.getByRole('dialog')).toBeVisible();
    }).toPass({timeout:30000});await page.keyboard.press('Escape');
    await page.goto(base+portal+'/credenciais',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:/MEGANET.*→/}).click();
    await page.getByRole('button',{name:'Ver acesso',exact:true}).first().click();
    await page.getByRole('button',{name:'Editar',exact:true}).click();
    const editor=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Editar equipamento e acessos',exact:true})});
    await expect(editor.getByRole('button',{name:'Salvar alterações',exact:true})).toBeVisible();
    await expect(editor.getByText('Acessos cadastrados',{exact:true})).toBeVisible();
    await editor.getByRole('button',{name:'Cancelar',exact:true}).click();
    await expect(editor).not.toBeVisible();await page.keyboard.press('Escape');
   }
   await page.goto(base+portal,{waitUntil:'domcontentloaded'});await page.setViewportSize({width:390,height:844});
   await expect(page.locator('main')).toBeVisible();
   await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   const layout=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('main *')].filter(element=>element.getBoundingClientRect().right>window.innerWidth+1&&getComputedStyle(element).position!=='fixed').slice(0,8).map(element=>({tag:element.tagName,class:element.className,width:element.getBoundingClientRect().width}))}));
   if(layout.scroll>layout.width)console.log(JSON.stringify({role,layout}));
   expect(layout.scroll<=layout.width,role+' mobile overflow').toBe(true);
   await page.screenshot({path:`/tmp/ajust-consolidated-${role}-mobile.png`});
   expect(errors,role+' page errors').toEqual([]);console.log(role+': painel, navegação, formulário/detalhe e viewport móvel validados.');
   await context.close();
  }
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

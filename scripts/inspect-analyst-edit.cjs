const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
async function main() {
 const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox']});
 try {
  const context=await browser.newContext(),page=await context.newPage(),base='http://127.0.0.1:8070';
  await page.goto(base+'/login',{waitUntil:'domcontentloaded'});
  await expect(async()=>{await page.getByRole('button',{name:/^Analista · Anderson/}).click();await expect(page.locator('#auth-password')).not.toHaveValue('');}).toPass({timeout:30000});
  await context.request.post(base+'/api/public/auth/login',{headers:{origin:base},data:{identifier:await page.locator('#auth-identifier').inputValue(),password:await page.locator('#auth-password').inputValue()}});
  await page.goto(base+'/analista/ordens/'+process.argv[2],{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  console.log(JSON.stringify(await page.locator('form').evaluateAll(forms=>forms.map(form=>({invalid:[...form.querySelectorAll(':invalid')].map(e=>({name:e.name,type:e.type,value:e.value,message:e.validationMessage})),buttons:[...form.querySelectorAll('button[type=submit]')].map(b=>({text:b.textContent,disabled:b.disabled}))})))));
  await page.screenshot({path:'/tmp/analyst-edit-validation.png',fullPage:true});
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

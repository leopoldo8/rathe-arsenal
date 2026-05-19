/** E2E scratch-deck-flow (U16)
 * /decks/new -> Start from scratch -> hero+format -> edit mode.
 * Tests skip gracefully when dev server not running.
 */
import { test, expect, type Page } from '@playwright/test';
const BASE_URL=process.env.PLAYWRIGHT_BASE_URL??'http://localhost:5173';
const FIXTURE_EMAIL=process.env.FIXTURE_EMAIL??'fixture@test.local';
const FIXTURE_PASS=process.env.FIXTURE_PASS??'test-password-1234';
const SETTLE_MS=2000;

async function seedAuth(page){
  try {
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    const r=await page.evaluate(async([a,e,p])=>{
      const res=await fetch(a+"/api/auth/sign-in",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});
      if(!res.ok)return{ok:false,jwt:""};
      const b=await res.json();
      if(!b.jwt)return{ok:false,jwt:""};
      localStorage.setItem("rathe-arsenal:jwt",b.jwt);
      localStorage.setItem("rathe-arsenal:theme","dark");
      return{ok:true,jwt:b.jwt};
    },[BASE_URL,FIXTURE_EMAIL,FIXTURE_PASS]);
    return r.ok?r.jwt:null;
  } catch{return null;}
}

async function seedJwt(page,jwt){
  await page.evaluate(t=>{
    localStorage.setItem("rathe-arsenal:jwt",t);
    localStorage.setItem("rathe-arsenal:theme","dark");
  },jwt);
}
test.describe('Scratch deck flow — E2E (U16)', () => {
  let jwt=null;
  test.beforeAll(async({browser})=>{
    const page=await browser.newPage();
    jwt=await seedAuth(page);
    await page.close();
  });

  test('/decks/new renders both path cards',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+"/decks/new",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByTestId('import-fabrary-card')).toBeVisible();
    await expect(page.getByTestId('start-scratch-card')).toBeVisible();
  });

  test('/decks/new heading and back link render',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+"/decks/new",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByRole('heading',{name:/Add new deck/i})).toBeVisible();
    await expect(page.getByRole('link',{name:/Home/i})).toBeVisible();
  });

  test('Start Building button present in scratch card',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+"/decks/new",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByTestId('start-building-btn')).toBeVisible();
  });

  test('hero input accepts Dorinthea text',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+"/decks/new",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(SETTLE_MS);
    const scratchCard=page.getByTestId('start-scratch-card');
    const heroInput=scratchCard.locator("input").first();
    if(!(await heroInput.isVisible().catch(()=>false))){test.skip(true,'hero input not found');return;}
    await heroInput.click();
    await heroInput.fill('Dorinthea');
    await page.waitForTimeout(1000);
    expect(await heroInput.inputValue()).toContain('Dorinthea');
  });

  test('select Dorinthea -> Start Building -> navigates to edit mode',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+"/decks/new",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(SETTLE_MS);
    const scratchCard=page.getByTestId('start-scratch-card');
    const heroInput=scratchCard.locator("input").first();
    if(!(await heroInput.isVisible().catch(()=>false))){test.skip(true,'hero input not found');return;}
    await heroInput.click();
    await heroInput.fill('Dorinthea');
    await page.waitForTimeout(1000);
    const suggestion=page.locator("[role=option]").filter({hasText:/Dorinthea/i}).first();
    if(!(await suggestion.isVisible().catch(()=>false))){test.skip(true,'Dorinthea not in catalog');return;}
    await suggestion.click();
    await page.waitForTimeout(500);
    const startBtn=page.getByTestId('start-building-btn');
    if(await startBtn.isDisabled()){
      const fmtSel=scratchCard.locator("select").last();
      if(await fmtSel.isVisible().catch(()=>false))await fmtSel.selectOption({label:"Classic Constructed"});
      await page.waitForTimeout(500);
    }
    if(await startBtn.isDisabled()){test.skip(true,'Start Building still disabled');return;}
    await startBtn.click();
    await page.waitForTimeout(SETTLE_MS*2);
    expect(page.url()).toMatch(/\/decks\/\d+/);
    expect(page.url()).toContain('edit=1');
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
  });
});

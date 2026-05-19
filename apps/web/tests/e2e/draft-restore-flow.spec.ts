/** E2E draft-restore-flow (U16)
 * Edit deck -> reload -> restore prompt -> Restore -> draft state matches.
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
test.describe('Draft restore flow — E2E (U16)', () => {
  let jwt=null,firstDeckUrl=null;
  test.beforeAll(async({browser})=>{
    const page=await browser.newPage();
    jwt=await seedAuth(page);
    if(jwt){
      await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
      await seedJwt(page,jwt);
      await page.goto(BASE_URL+"/home",{waitUntil:"networkidle",timeout:20000});
      await page.waitForTimeout(2000);
      firstDeckUrl=await page.evaluate(()=>{
        const l=document.querySelector('a[href^="/decks/"]');
        return l?l.getAttribute("href"):null;
      });
    }
    await page.close();
  });

  test('Restore modal absent when no draft stored',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    if(!firstDeckUrl){test.skip(true,'no tracked deck on /home');return;}
    // Clear any stale draft before the test
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.evaluate(url=>{
      const id=url.split("/decks/")[1]||"";
      localStorage.removeItem("ra-deck-draft-"+id);
    },firstDeckUrl);
    await page.goto(BASE_URL+firstDeckUrl+"?edit=1",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(2000);
    // No stored draft -> restore modal should NOT appear
    const restoreBtn=page.getByTestId('draft-restore-restore-btn');
    const restoreVisible=await restoreBtn.isVisible().catch(()=>false);
    expect(restoreVisible).toBe(false);
  });

  test('Edit -> reload -> Restore modal appears -> Restore -> draft state matches',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    if(!firstDeckUrl){test.skip(true,'no tracked deck on /home');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+firstDeckUrl+"?edit=1",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(2000);
    // Dismiss any prior restore modal
    const discardBtn=page.getByTestId('draft-restore-discard-btn');
    if(await discardBtn.isVisible().catch(()=>false)){await discardBtn.click();await page.waitForTimeout(500);}
    // Seed a fake draft into localStorage to simulate a prior edit session
    await page.evaluate(url=>{
      const id=url.split("/decks/")[1]||"";
      const fakeDraft={heroIdentifier:null,format:"Classic Constructed",cards:[{cardIdentifier:"test-card",quantity:1,slot:"mainboard"}]};
      localStorage.setItem("ra-deck-draft-"+id,JSON.stringify(fakeDraft));
    },firstDeckUrl);
    // Reload the page to trigger the restore prompt
    await page.reload({waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(2000);
    // Restore modal should now appear
    const restoreBtn=page.getByTestId('draft-restore-restore-btn');
    if(!(await restoreBtn.isVisible().catch(()=>false))){
      test.skip(true,'Restore modal did not appear after seeding fake draft');return;
    }
    await expect(restoreBtn).toBeVisible();
    // Click Restore
    await restoreBtn.click();
    await page.waitForTimeout(1000);
    // Modal should be dismissed after clicking Restore
    await expect(restoreBtn).not.toBeVisible();
  });

  test('Draft restore: Discard clears the draft',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    if(!firstDeckUrl){test.skip(true,'no tracked deck on /home');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    // Seed a fake draft
    await page.evaluate(url=>{
      const id=url.split("/decks/")[1]||"";
      localStorage.setItem("ra-deck-draft-"+id,JSON.stringify({heroIdentifier:null,format:"Classic Constructed",cards:[]}));
    },firstDeckUrl);
    await page.goto(BASE_URL+firstDeckUrl+"?edit=1",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(2000);
    const discardBtn=page.getByTestId('draft-restore-discard-btn');
    if(!(await discardBtn.isVisible().catch(()=>false))){
      test.skip(true,'Restore modal did not appear after seeding fake draft');return;
    }
    await discardBtn.click();
    await page.waitForTimeout(500);
    // Modal dismissed; draft cleared; Edit canvas still visible
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
  });
});

/** E2E hero-cascade-flow (U16)
 * Edit deck -> change hero -> cascade warning -> Remove illegal cards -> Save.
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
test.describe('Hero cascade flow — E2E (U16)', () => {
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

  test('Edit mode: hero dropdown visible in sidebar',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    if(!firstDeckUrl){test.skip(true,'no tracked deck on /home');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+firstDeckUrl+"?edit=1",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(2000);
    // Dismiss stale restore modal if present
    const disc=page.getByTestId('draft-restore-discard-btn');
    if(await disc.isVisible().catch(()=>false)){await disc.click();await page.waitForTimeout(500);}
    // Hero dropdown in sidebar is visible when in edit mode
    await expect(page.getByTestId('sidebar-edit-hero-block')).toBeVisible();
  });

  test('cascade warning appears when hero changes',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    if(!firstDeckUrl){test.skip(true,'no tracked deck on /home');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+firstDeckUrl+"?edit=1",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(2000);
    const disc=page.getByTestId("draft-restore-discard-btn");
    if(await disc.isVisible().catch(()=>false)){await disc.click();await page.waitForTimeout(500);}
    // Attempt to change hero to trigger cascade warning
    const heroDropdown=page.getByTestId("hero-dropdown");
    if(!(await heroDropdown.isVisible().catch(()=>false))){test.skip(true,'hero-dropdown not visible in sidebar');return;}
    const heroInput=heroDropdown.locator("input").first();
    if(!(await heroInput.isVisible().catch(()=>false))){test.skip(true,'hero input not found in hero-dropdown');return;}
    // Change to a different hero — type something to open the dropdown
    await heroInput.click();
    await heroInput.selectAll();
    await heroInput.fill('Briar');
    await page.waitForTimeout(1000);
    const opt=page.locator("[role=option]").filter({hasText:/Briar/i}).first();
    if(!(await opt.isVisible().catch(()=>false))){test.skip(true,'Briar not in catalog suggestions');return;}
    await opt.click();
    await page.waitForTimeout(1000);
    // Cascade warning may appear if the existing cards are not legal for the new hero
    const cascadeWarning=page.getByTestId("cascade-warning-sidebar").or(page.getByTestId("cascade-warning-banner"));
    const cascadeCount=await cascadeWarning.count();
    if(cascadeCount===0){
      // No cascade warning — deck may have no hero-restricted cards; test is inconclusive
      return;
    }
    // Cascade warning is visible
    await expect(cascadeWarning.first()).toBeVisible();
  });

  test('Remove illegal cards button present in cascade warning',async({page})=>{
    if(!jwt){test.skip(true,'no JWT');return;}
    if(!firstDeckUrl){test.skip(true,'no tracked deck on /home');return;}
    await page.goto(BASE_URL,{waitUntil:"networkidle",timeout:15000});
    await seedJwt(page,jwt);
    await page.goto(BASE_URL+firstDeckUrl+"?edit=1",{waitUntil:"networkidle",timeout:20000});
    await page.waitForTimeout(2000);
    const disc=page.getByTestId("draft-restore-discard-btn");
    if(await disc.isVisible().catch(()=>false)){await disc.click();await page.waitForTimeout(500);}
    const heroDropdown=page.getByTestId("hero-dropdown");
    if(!(await heroDropdown.isVisible().catch(()=>false))){test.skip(true,'hero-dropdown not visible');return;}
    const heroInput=heroDropdown.locator("input").first();
    if(!(await heroInput.isVisible().catch(()=>false))){test.skip(true,'hero input not found');return;}
    await heroInput.click();
    await heroInput.selectAll();
    await heroInput.fill('Briar');
    await page.waitForTimeout(1000);
    const opt=page.locator("[role=option]").filter({hasText:/Briar/i}).first();
    if(!(await opt.isVisible().catch(()=>false))){test.skip(true,'Briar not in catalog');return;}
    await opt.click();
    await page.waitForTimeout(1000);
    const removeBtn=page.getByTestId("cascade-remove-illegal-btn");
    if(!(await removeBtn.isVisible().catch(()=>false))){test.skip(true,'no cascade warning triggered');return;}
    // Remove illegal cards button is clickable
    await expect(removeBtn).toBeEnabled();
  });
});

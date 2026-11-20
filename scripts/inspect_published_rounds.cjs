const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.goto('https://filigor123.github.io/TV-Quiz/');
  await page.locator('.catalog-card:not(:disabled)').first().waitFor();
  const cards=await page.locator('.catalog-card:not(:disabled)').count();
  await page.locator('.catalog-card:not(:disabled)').first().click();
  await page.locator('#joinLink').waitFor();
  console.log(JSON.stringify(await page.evaluate(()=>({title:config.category,count:deck.length,rounds:[...new Set(deck.map(q=>q.roundIndex))],oasis:window.QUIZ_QUESTIONS.find(q=>q.text==='В каком городе образовалась группа Oasis?')})),null,2));
  console.log('Published playable cards:',cards);
  await page.screenshot({path:path.join(process.env.TEMP,'tvquiz-published-lobby.png')});
  await page.evaluate(()=>peer.destroy());
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

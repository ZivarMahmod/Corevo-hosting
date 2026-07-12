import { chromium } from 'playwright'
const b=await chromium.launch();const p=await(await b.newContext({viewport:{width:1280,height:900}})).newPage()
await p.goto('http://florist.localhost:3111/shop')
await p.waitForTimeout(800)
const btns=await p.locator('button:has-text("Lägg i varukorg"), button:has-text("Köp")').count()
console.log('buy buttons',btns)
if(btns){await p.locator('button:has-text("Lägg i varukorg"), button:has-text("Köp")').first().click();await p.waitForTimeout(500)}
console.log('cart LS',await p.evaluate(()=>localStorage.getItem('corevo-shop-cart')))
await p.goto('http://florist.localhost:3111/varukorg');await p.waitForTimeout(1200)
const out=await p.evaluate(()=>{
 const box=e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}}
 const q=s=>[...document.querySelectorAll(s)]
 const small=q('main a,main button').filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<44||r.width<44)}).map(e=>({t:e.tagName,x:(e.innerText||'').slice(0,18),...box(e)}))
 return{empty:!!q('[class*="empty"]').length,row:q('[class*="cart_row"]').map(box),panel:q('[class*="panel"]').map(box),thumb:q('[class*="thumb"]').map(box),small}
})
console.log(JSON.stringify(out,null,1))
await p.screenshot({path:'_cart.png',fullPage:true})
await b.close()

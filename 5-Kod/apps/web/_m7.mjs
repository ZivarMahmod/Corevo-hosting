import { chromium } from 'playwright'
const L=[{variantId:'v1',productId:'p1',productName:'Vårbukett',variantName:'Mellan',priceCents:49900,currency:'SEK',quantity:2,imageUrl:null,maxQty:5}]
const b=await chromium.launch();const p=await(await b.newContext()).newPage()
p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('['+m.type()+']',m.text().slice(0,180))})
p.on('pageerror',e=>console.log('[pageerror]',String(e).slice(0,200)))
await p.goto('http://florist.localhost:3111/varukorg')
await p.evaluate(l=>localStorage.setItem('corevo-shop-cart',JSON.stringify(l)),L)
await p.reload();await p.waitForTimeout(3000)
console.log('empty?',await p.evaluate(()=>!!document.querySelector('[class*="empty"]')))
await b.close()

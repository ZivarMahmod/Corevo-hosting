import { chromium } from 'playwright'
const L=[{variantId:'v1',productId:'p1',productName:'Vårbukett',variantName:'Mellan',priceCents:49900,currency:'SEK',quantity:2,imageUrl:null,maxQty:5}]
const b=await chromium.launch();const p=await(await b.newContext()).newPage()
await p.goto('http://florist.localhost:3111/varukorg')
await p.evaluate(l=>localStorage.setItem('corevo-shop-cart',JSON.stringify(l)),L)
console.log('before reload:',await p.evaluate(()=>localStorage.getItem('corevo-shop-cart')))
await p.reload();await p.waitForTimeout(1500)
console.log('after reload:',await p.evaluate(()=>localStorage.getItem('corevo-shop-cart')))
console.log('empty?',await p.evaluate(()=>!!document.querySelector('[class*="empty"]')))
await b.close()

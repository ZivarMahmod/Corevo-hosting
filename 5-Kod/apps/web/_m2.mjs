import { chromium } from 'playwright'
const LINES=[{variantId:'v1',productId:'p1',productName:'Vårbukett Lilja',variantName:'Mellan',priceCents:49900,currency:'SEK',quantity:2,imageUrl:'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400',maxQty:5},{variantId:'v2',productId:'p2',productName:'Krukväxt Monstera',variantName:'Standard',priceCents:29900,currency:'SEK',quantity:1,imageUrl:null,maxQty:3}]
const b=await chromium.launch();const p=await(await b.newContext({viewport:{width:1280,height:900}})).newPage()
await p.goto('http://florist.localhost:3111/varukorg')
await p.evaluate(l=>localStorage.setItem('corevo-shop-cart',JSON.stringify(l)),LINES)
await p.reload();await p.waitForTimeout(1500)
console.log(JSON.stringify(await p.evaluate(()=>({
  scrollW:document.documentElement.scrollWidth,
  bodyText:document.body.innerText.slice(0,220),
  classes:[...new Set([...document.querySelectorAll('main *')].map(e=>e.className).filter(c=>typeof c==='string'&&c))].slice(0,25)
})),null,1))
await b.close()

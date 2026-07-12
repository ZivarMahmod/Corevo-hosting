import { chromium } from 'playwright'
const L=[{variantId:'v1',productId:'p1',productName:'Vårbukett Lilja',variantName:'Mellan',priceCents:49900,currency:'SEK',quantity:2,imageUrl:'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400',maxQty:5}]
const b=await chromium.launch();const p=await(await b.newContext({viewport:{width:1280,height:900}})).newPage()
await p.goto('http://florist.localhost:3111/varukorg')
await p.evaluate(l=>{localStorage.setItem('corevo-shop-token','tok-test');localStorage.setItem('corevo-shop-cart',JSON.stringify(l))},L)
await p.reload();await p.waitForTimeout(1500)
console.log(await p.evaluate(()=>localStorage.getItem('corevo-shop-cart')?.slice(0,60)))
console.log(await p.evaluate(()=>document.body.innerText.slice(120,300)))
await b.close()

import { chromium } from 'playwright'
const L=[
 {variantId:'v1',productId:'p1',productName:'Vårbukett Lilja',variantName:'Mellan',priceCents:49900,currency:'SEK',quantity:2,imageUrl:'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400',maxQty:5},
 {variantId:'v2',productId:'p2',productName:'Krukväxt Monstera',variantName:'Standard',priceCents:29900,currency:'SEK',quantity:1,imageUrl:null,maxQty:3}]
const b=await chromium.launch();const p=await(await b.newContext({viewport:{width:1280,height:900}})).newPage()
await p.goto('http://florist.localhost:3111/varukorg')
await p.evaluate(l=>localStorage.setItem('corevo-shop-cart',JSON.stringify(l)),L)
await p.reload();await p.waitForTimeout(2500)
const out=await p.evaluate(()=>{
 const box=e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}}
 const q=s=>[...document.querySelectorAll(s)]
 const small=q('main a,main button').filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<44||r.width<44)}).map(e=>({t:e.tagName,txt:(e.innerText||'').slice(0,16),...box(e)}))
 const foot=q('footer a').filter(e=>e.getBoundingClientRect().height<44).length
 return{scrollW:document.documentElement.scrollWidth,
  wrap:q('[class*="cart_wrap"]').map(box),rows:q('[class*="cart_row"]').map(box),
  thumbs:q('[class*="thumb"]').map(box),panel:q('[class*="cart_panel"]').map(box),
  small,footSmall:foot}
})
console.log(JSON.stringify(out,null,1))
await p.screenshot({path:'_cart.png',fullPage:true})
await b.close()

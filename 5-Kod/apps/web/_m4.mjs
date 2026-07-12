import { chromium } from 'playwright'
const b=await chromium.launch();const p=await(await b.newContext()).newPage()
await p.goto('http://florist.localhost:3111/varukorg')
console.log('url',p.url())
console.log('set-then-read',await p.evaluate(()=>{localStorage.setItem('x','1');return localStorage.getItem('x')}))
await p.reload()
console.log('after-reload',await p.evaluate(()=>localStorage.getItem('x')),p.url())
await b.close()

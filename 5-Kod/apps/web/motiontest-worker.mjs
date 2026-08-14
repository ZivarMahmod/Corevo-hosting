import openNextWorker from './motiontest-opennext-worker.mjs'
import { createMotiontestWorker } from './lib/storefront/motiontest-worker-runtime.mjs'

export default createMotiontestWorker(openNextWorker)

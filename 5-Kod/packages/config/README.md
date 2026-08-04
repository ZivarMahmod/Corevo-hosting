# @corevo/config

Shared build configuration. Change the existing owner here when the shared build
contract changes; do not add a second preset beside it.

| Concern    | Source                                   |
| ---------- | ---------------------------------------- |
| ESLint     | `eslint.config.mjs` (`@corevo/config/eslint`) |
| TypeScript | root `tsconfig.base.json` (extended by every package) |
| Tailwind   | v4 via `@tailwindcss/postcss`; tokens live in `@corevo/ui` (`tokens.css`) |
| Prettier   | root `.prettierrc.json`                  |

Apps/packages import the ESLint preset:

```js
// eslint.config.mjs
import config from '@corevo/config/eslint'
export default config
```

/// <reference types="vite/client" />

import { BakeryDesktopApi } from '@bakery/contracts';

declare global {
  interface Window {
    bakery: BakeryDesktopApi;
  }
}

/// <reference types="vite/client" />

import { BakeryDesktopApi } from '@rz-crm/contracts';

declare global {
  interface Window {
    bakery: BakeryDesktopApi;
  }
}

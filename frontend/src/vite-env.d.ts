/// <reference types="vite/client" />
import type { ApiPuenteMA2 } from './tipos/ipc';

declare global {
  interface Window {
    api?: ApiPuenteMA2;
  }
}

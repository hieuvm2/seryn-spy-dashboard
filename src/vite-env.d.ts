/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Apps Script Web App URL trả JSON 5 bảng từ Google Sheets.
   *  Cấu hình trên Vercel → Settings → Environment Variables. KHÔNG hardcode. */
  readonly VITE_GOOGLE_SHEETS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

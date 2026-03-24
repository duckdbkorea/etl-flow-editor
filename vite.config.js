// vite.config.js — 전체 파일 교체
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // /api/* 요청을 모두 Hop 서버로 전달
      "/api": {
        target:      "http://localhost:8080",
        changeOrigin: true,
        // /api/hop/run → Hop 실제 엔드포인트로 경로 재작성
        // Hop 서버 설정에 따라 rewrite 경로 조정 필요
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
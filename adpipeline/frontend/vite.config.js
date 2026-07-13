import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    assetsDir: "_assets",
  },
  server: {
    port: 5173,
    proxy: {
      // proxy API + asset routes to the FastAPI backend
      "/campaigns": "http://localhost:8000",
      "/creative": "http://localhost:8000",  // also matches /creative/stream + /creative/render/*
      "/solo": "http://localhost:8000",      // solo agents + /solo/creative/stream
      "/placement": "http://localhost:8000",
      "/publish": "http://localhost:8000",
      "/assets": "http://localhost:8000",
      "/cost": "http://localhost:8000",
      "/health": "http://localhost:8000",
      "/library": "http://localhost:8000",
      "/skills": "http://localhost:8000",
      "/prompts": "http://localhost:8000",
      "/video": "http://localhost:8000",      // also matches /videos/*
      "/reference": "http://localhost:8000",  // also matches /references/*
    },
  },
});

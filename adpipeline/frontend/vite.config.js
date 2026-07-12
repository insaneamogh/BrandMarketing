import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // proxy API + asset routes to the FastAPI backend
      "/runs": "http://localhost:8000",
      "/briefs": "http://localhost:8000",
      "/creative": "http://localhost:8000",
      "/placement": "http://localhost:8000",
      "/assets": "http://localhost:8000",
      "/cost": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});

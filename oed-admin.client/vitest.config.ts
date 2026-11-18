import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import plugin from '@vitejs/plugin-react';

// Separate from vite.config.ts, which exports a dev certificate (and may spawn `dotnet dev-certs`) when it loads.
export default defineConfig({
    plugins: [plugin()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
        restoreMocks: true,
    }
})

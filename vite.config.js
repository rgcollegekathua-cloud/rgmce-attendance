import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
            manifest: {
                name: 'RGMCE Teacher Attendance',
                short_name: 'RGMCE Attendance',
                description: 'Teacher attendance system for Rajiv Gandhi Memorial College of Education, Kathua.',
                theme_color: '#14532d',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: '/icons/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-maskable-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
                navigateFallback: '/index.html',
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
                        handler: 'NetworkOnly'
                    },
                    {
                        urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/,
                        handler: 'NetworkOnly'
                    },
                    {
                        urlPattern: /^https:\/\/securetoken\.googleapis\.com\/.*/,
                        handler: 'NetworkOnly'
                    }
                ]
            },
            devOptions: {
                enabled: false
            }
        })
    ],
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
    }
});

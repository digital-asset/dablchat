import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import damlhubMock, {httpJsonApi }from './mocklogin/vite-plugin.ts';

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
    define: {
        global: {},
    },
    plugins: [react(), damlhubMock()],
    server: {
        port: 3000,
        proxy: {
            '/v1': {
                target: httpJsonApi
            }
        }
    },
    build: {
        outDir: '../dist/web',
        emptyOutDir: true,
        sourcemap: true,
        commonjsOptions: {
            transformMixedEsModules: true,
        }
    },
    resolve: {
        preserveSymlinks: true,
    }
});

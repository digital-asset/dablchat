/** @type {import('vite').UserConfig} */
export default {
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
}

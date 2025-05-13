import { defineConfig } from 'vite';
import VueMacros from 'unplugin-vue-macros/vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// https://vite.dev/config/
export default defineConfig({
    plugins: [
        VueMacros({
            plugins: {
                vue: vue(),
                vueJsx: vueJsx(),
            }
        }),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    },
    server: {
        proxy: {
            '/moduleknowledge': {
                target: 'http://localhost:6060',
                changeOrigin: true,
                rewrite: (path) => path // vite默认会添加/moduleknowledge前缀
            },
            '/modulechat': {
                target: 'http://localhost:6060',
                changeOrigin: true,
                rewrite: (path) => path // vite默认会添加/modulechat前缀
            },
            '/moduleauth': {
                target: 'http://localhost:6060',
                changeOrigin: true,
                rewrite: (path) => path // vite默认会添加/moduleauth前缀
            }
        }
    }
});

import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const production = process.env.NODE_ENV === 'production'

export default {
	input: ['src/components/Tooltip.svelte'],
	output: [
		{
			format: 'es',
			entryFileNames: '[name].js',
			dir: 'dist',
			sourcemap: true,
		},
		{
			format: 'es',
			entryFileNames: '[name].js',
			dir: 'public/module',
			sourcemap: true,
		}
	],
	plugins: [
		svelte({
			emitCss: true,
			compilerOptions: {
				customElement: true,
				dev: !production,
			},
		}),
		resolve({browser: true}),
		commonjs()
	],
	watch: {
		clearScreen: false,
	}
}
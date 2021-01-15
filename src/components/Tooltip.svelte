<svelte:options tag="tadashi-tooltip" />

<script>
	// import {tick} from 'svelte'

	export let right = false
	export let size = false

	let show = false

	let _top = 0
	let _left = 0

	let _bw
	let _bh
	let _w
	let _h

	let btn
	let box

	let _style = ''

	if (size !== false) {
		_style = `--width: ${size}px;`
	}

	// async function position() {
	// 	await tick()
	// 	console.log('_bw, _bh', _bw, _bh)
	// 	console.log('_w, _h', _w, _h)
	// 	console.log('btn', btn.getBoundingClientRect())
	// 	console.log('globalThis.visualViewport', globalThis.visualViewport)
	// 	if (box) {
	// 		console.log('box', box.getBoundingClientRect())
	// 	}
	// }

	async function toggle() {
		show = !show
		// await position()
	}
</script>

<svg width="0" height="0" display="none" version="1.1" aria-hidden="true" focusable="false">
	<symbol id="live_help" viewBox="0 0 24 24">
		<path d="M15.047 10.266c0.563-0.563 0.938-1.359 0.938-2.25 0-2.203-1.781-4.031-3.984-4.031s-3.984 1.828-3.984 4.031h1.969c0-1.078 0.938-2.016 2.016-2.016s2.016 0.938 2.016 2.016c0 0.563-0.234 1.031-0.609 1.406l-1.219 1.266c-0.703 0.75-1.172 1.734-1.172 2.813v0.516h1.969c0-1.5 0.469-2.109 1.172-2.859zM12.984 18v-2.016h-1.969v2.016h1.969zM18.984 2.016c1.078 0 2.016 0.891 2.016 1.969v14.016c0 1.078-0.938 2.016-2.016 2.016h-3.984l-3 3-3-3h-3.984c-1.125 0-2.016-0.938-2.016-2.016v-14.016c0-1.078 0.891-1.969 2.016-1.969h13.969z"></path>
	</symbol>
</svg>

<div class="__tooltip">
	<button
		type="button"
		class="__tooltip_trigger"
		bind:this={btn}
		bind:clientWidth={_bw}
		bind:clientHeight={_bh}
		on:click={toggle}
	>
		<svg class="__tooltip_ballon">
			<use xlink:href="#live_help" />
		</svg>
	</button>

	{#if show}
		<div
			class="__tooltip_message"
			style="top: {_top}px; left: {_left}px; {_style}"
			class:__tooltip_message--right={right}
			bind:this={box}
			bind:clientWidth={_w} bind:clientHeight={_h}
		><slot /></div>
	{/if}
</div>

<style>
	:host {
		--width: auto;
		--fillColor: hsla(0, 50%, 50%, 1);
		--bgColorBox: hsla(0, 0%, 0%, 0.7);
		--txtColorBox: hsla(0, 100%, 100%, 1);
		--gap: 30px;
		--zindex: 999;
	}

	.__tooltip {
		position: relative;
	}

	.__tooltip_trigger {
		width: 30px;
		height: 30px;
		padding: 0;
		margin: 0;
		border: 0;
		outline: 0;
		overflow: hidden;
		position: relative;
		cursor: pointer;
		background: none
	}

	.__tooltip_ballon {
		width: 1.5em;
		height: 1.5em;
		cursor: pointer;
		fill: var(--fillColor);
	}

	.__tooltip_message {
		position: absolute;
		top: 0;
		left: 0;
		bottom: auto;
		right: auto;
		color: var(--txtColorBox);
		background-color: var(--bgColorBox);
		padding: 1em;
		width: var(--width);
		height: auto;
		border-radius: 5px;
		pointer-events: none;
		box-sizing: border-box;
		transform: translate(calc(-100% + var(--gap)), var(--gap));
		z-index: var(--zindex);
		overflow: auto;
	}

	.__tooltip_message--right {
		transform: translate(0px, var(--gap));
	}
</style>

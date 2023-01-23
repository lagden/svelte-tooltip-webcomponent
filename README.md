# tooltip-webcomponent

[![NPM version][npm-img]][npm]


[npm-img]:         https://img.shields.io/npm/v/@tadashi/tooltip-webcomponent.svg
[npm]:             https://www.npmjs.com/package/@tadashi/tooltip-webcomponent

---

Svelte component

## Install

```
$ npm i -S @tadashi/tooltip-webcomponent
```


## Usage

```html
<script
	type="module"
	src="https://unpkg.com/@tadashi/tooltip-webcomponent@{version}/dist/Tooltip.js"
></script>

<style>
	.custom {
		--width: 200px;
		--fillColor: hsl(0deg 100% 100%);
	}
</style>

<tadashi-tooltip right="true" class="custom">Ajuda aqui</tadashi-tooltip>
```


## License

MIT © [Thiago Lagden](https://github.com/lagden)

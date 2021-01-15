function noop() { }
function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
        loc: { file, line, column, char }
    };
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function xlink_attr(node, attribute, value) {
    node.setAttributeNS('http://www.w3.org/1999/xlink', attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
// unfortunately this can't be a constant as that wouldn't be tree-shakeable
// so we cache the result instead
let crossorigin;
function is_crossorigin() {
    if (crossorigin === undefined) {
        crossorigin = false;
        try {
            if (typeof window !== 'undefined' && window.parent) {
                void window.parent.document;
            }
        }
        catch (error) {
            crossorigin = true;
        }
    }
    return crossorigin;
}
function add_resize_listener(node, fn) {
    const computed_style = getComputedStyle(node);
    const z_index = (parseInt(computed_style.zIndex) || 0) - 1;
    if (computed_style.position === 'static') {
        node.style.position = 'relative';
    }
    const iframe = element('iframe');
    iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
        `overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: ${z_index};`);
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    const crossorigin = is_crossorigin();
    let unsubscribe;
    if (crossorigin) {
        iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
        unsubscribe = listen(window, 'message', (event) => {
            if (event.source === iframe.contentWindow)
                fn();
        });
    }
    else {
        iframe.src = 'about:blank';
        iframe.onload = () => {
            unsubscribe = listen(iframe.contentWindow, 'resize', fn);
        };
    }
    append(node, iframe);
    return () => {
        if (crossorigin) {
            unsubscribe();
        }
        else if (unsubscribe && iframe.contentWindow) {
            unsubscribe();
        }
        detach(iframe);
    };
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}
function attribute_to_object(attributes) {
    const result = {};
    for (const attribute of attributes) {
        result[attribute.name] = attribute.value;
    }
    return result;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
            on_destroy.push(...new_on_destroy);
        }
        else {
            // Edge case - component was destroyed immediately,
            // most likely as a result of a binding initialising
            run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const prop_values = options.props || {};
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, prop_values, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor);
        flush();
    }
    set_current_component(parent_component);
}
let SvelteElement;
if (typeof HTMLElement === 'function') {
    SvelteElement = class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }
        connectedCallback() {
            // @ts-ignore todo: improve typings
            for (const key in this.$$.slotted) {
                // @ts-ignore todo: improve typings
                this.appendChild(this.$$.slotted[key]);
            }
        }
        attributeChangedCallback(attr, _oldValue, newValue) {
            this[attr] = newValue;
        }
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            // TODO should this delegate to addEventListener?
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    };
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.0' }, detail)));
}
function append_dev(target, node) {
    dispatch_dev('SvelteDOMInsert', { target, node });
    append(target, node);
}
function insert_dev(target, node, anchor) {
    dispatch_dev('SvelteDOMInsert', { target, node, anchor });
    insert(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev('SvelteDOMRemove', { node });
    detach(node);
}
function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
    const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
    if (has_prevent_default)
        modifiers.push('preventDefault');
    if (has_stop_propagation)
        modifiers.push('stopPropagation');
    dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
    const dispose = listen(node, event, handler, options);
    return () => {
        dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
        dispose();
    };
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
    else
        dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
}
function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
        if (!~keys.indexOf(slot_key)) {
            console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
        }
    }
}

/* src/components/Tooltip.svelte generated by Svelte v3.31.0 */

const file = "src/components/Tooltip.svelte";

// (65:1) {#if show}
function create_if_block(ctx) {
	let div;
	let slot;
	let div_style_value;
	let div_resize_listener;

	const block = {
		c: function create() {
			div = element("div");
			slot = element("slot");
			add_location(slot, file, 71, 3, 1894);
			attr_dev(div, "class", "__tooltip_message");
			attr_dev(div, "style", div_style_value = "top: " + /*_top*/ ctx[9] + "px; left: " + /*_left*/ ctx[10] + "px; " + /*_style*/ ctx[8]);
			add_render_callback(() => /*div_elementresize_handler*/ ctx[16].call(div));
			toggle_class(div, "__tooltip_message--right", /*right*/ ctx[0]);
			add_location(div, file, 65, 2, 1696);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			append_dev(div, slot);
			/*div_binding*/ ctx[15](div);
			div_resize_listener = add_resize_listener(div, /*div_elementresize_handler*/ ctx[16].bind(div));
		},
		p: function update(ctx, dirty) {
			if (dirty & /*_style*/ 256 && div_style_value !== (div_style_value = "top: " + /*_top*/ ctx[9] + "px; left: " + /*_left*/ ctx[10] + "px; " + /*_style*/ ctx[8])) {
				attr_dev(div, "style", div_style_value);
			}

			if (dirty & /*right*/ 1) {
				toggle_class(div, "__tooltip_message--right", /*right*/ ctx[0]);
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			/*div_binding*/ ctx[15](null);
			div_resize_listener();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(65:1) {#if show}",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let svg0;
	let symbol;
	let path;
	let t0;
	let div;
	let button;
	let svg1;
	let use;
	let button_resize_listener;
	let t1;
	let mounted;
	let dispose;
	let if_block = /*show*/ ctx[1] && create_if_block(ctx);

	const block = {
		c: function create() {
			svg0 = svg_element("svg");
			symbol = svg_element("symbol");
			path = svg_element("path");
			t0 = space();
			div = element("div");
			button = element("button");
			svg1 = svg_element("svg");
			use = svg_element("use");
			t1 = space();
			if (if_block) if_block.c();
			this.c = noop;
			attr_dev(path, "d", "M15.047 10.266c0.563-0.563 0.938-1.359 0.938-2.25 0-2.203-1.781-4.031-3.984-4.031s-3.984 1.828-3.984 4.031h1.969c0-1.078 0.938-2.016 2.016-2.016s2.016 0.938 2.016 2.016c0 0.563-0.234 1.031-0.609 1.406l-1.219 1.266c-0.703 0.75-1.172 1.734-1.172 2.813v0.516h1.969c0-1.5 0.469-2.109 1.172-2.859zM12.984 18v-2.016h-1.969v2.016h1.969zM18.984 2.016c1.078 0 2.016 0.891 2.016 1.969v14.016c0 1.078-0.938 2.016-2.016 2.016h-3.984l-3 3-3-3h-3.984c-1.125 0-2.016-0.938-2.016-2.016v-14.016c0-1.078 0.891-1.969 2.016-1.969h13.969z");
			add_location(path, file, 46, 2, 869);
			attr_dev(symbol, "id", "live_help");
			attr_dev(symbol, "viewBox", "0 0 24 24");
			add_location(symbol, file, 45, 1, 823);
			attr_dev(svg0, "width", "0");
			attr_dev(svg0, "height", "0");
			attr_dev(svg0, "display", "none");
			attr_dev(svg0, "version", "1.1");
			attr_dev(svg0, "aria-hidden", "true");
			attr_dev(svg0, "focusable", "false");
			add_location(svg0, file, 44, 0, 729);
			xlink_attr(use, "xlink:href", "#live_help");
			add_location(use, file, 60, 3, 1629);
			attr_dev(svg1, "class", "__tooltip_ballon");
			add_location(svg1, file, 59, 2, 1595);
			attr_dev(button, "type", "button");
			attr_dev(button, "class", "__tooltip_trigger");
			add_render_callback(() => /*button_elementresize_handler*/ ctx[14].call(button));
			add_location(button, file, 51, 1, 1449);
			attr_dev(div, "class", "__tooltip");
			add_location(div, file, 50, 0, 1424);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, svg0, anchor);
			append_dev(svg0, symbol);
			append_dev(symbol, path);
			insert_dev(target, t0, anchor);
			insert_dev(target, div, anchor);
			append_dev(div, button);
			append_dev(button, svg1);
			append_dev(svg1, use);
			/*button_binding*/ ctx[13](button);
			button_resize_listener = add_resize_listener(button, /*button_elementresize_handler*/ ctx[14].bind(button));
			append_dev(div, t1);
			if (if_block) if_block.m(div, null);

			if (!mounted) {
				dispose = listen_dev(button, "click", /*toggle*/ ctx[11], false, false, false);
				mounted = true;
			}
		},
		p: function update(ctx, [dirty]) {
			if (/*show*/ ctx[1]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg0);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(div);
			/*button_binding*/ ctx[13](null);
			button_resize_listener();
			if (if_block) if_block.d();
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("tadashi-tooltip", slots, []);
	let { right = false } = $$props;
	let { size = false } = $$props;
	let show = false;
	let _top = 0;
	let _left = 0;
	let _bw;
	let _bh;
	let _w;
	let _h;
	let btn;
	let box;
	let _style = "";

	if (size !== false) {
		_style = `--width: ${size}px;`;
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
		$$invalidate(1, show = !show);
	} // await position()

	const writable_props = ["right", "size"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<tadashi-tooltip> was created with unknown prop '${key}'`);
	});

	function button_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			btn = $$value;
			$$invalidate(6, btn);
		});
	}

	function button_elementresize_handler() {
		_bw = this.clientWidth;
		_bh = this.clientHeight;
		$$invalidate(2, _bw);
		$$invalidate(3, _bh);
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			box = $$value;
			$$invalidate(7, box);
		});
	}

	function div_elementresize_handler() {
		_w = this.clientWidth;
		_h = this.clientHeight;
		$$invalidate(4, _w);
		$$invalidate(5, _h);
	}

	$$self.$$set = $$props => {
		if ("right" in $$props) $$invalidate(0, right = $$props.right);
		if ("size" in $$props) $$invalidate(12, size = $$props.size);
	};

	$$self.$capture_state = () => ({
		right,
		size,
		show,
		_top,
		_left,
		_bw,
		_bh,
		_w,
		_h,
		btn,
		box,
		_style,
		toggle
	});

	$$self.$inject_state = $$props => {
		if ("right" in $$props) $$invalidate(0, right = $$props.right);
		if ("size" in $$props) $$invalidate(12, size = $$props.size);
		if ("show" in $$props) $$invalidate(1, show = $$props.show);
		if ("_top" in $$props) $$invalidate(9, _top = $$props._top);
		if ("_left" in $$props) $$invalidate(10, _left = $$props._left);
		if ("_bw" in $$props) $$invalidate(2, _bw = $$props._bw);
		if ("_bh" in $$props) $$invalidate(3, _bh = $$props._bh);
		if ("_w" in $$props) $$invalidate(4, _w = $$props._w);
		if ("_h" in $$props) $$invalidate(5, _h = $$props._h);
		if ("btn" in $$props) $$invalidate(6, btn = $$props.btn);
		if ("box" in $$props) $$invalidate(7, box = $$props.box);
		if ("_style" in $$props) $$invalidate(8, _style = $$props._style);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		right,
		show,
		_bw,
		_bh,
		_w,
		_h,
		btn,
		box,
		_style,
		_top,
		_left,
		toggle,
		size,
		button_binding,
		button_elementresize_handler,
		div_binding,
		div_elementresize_handler
	];
}

class Tooltip extends SvelteElement {
	constructor(options) {
		super();

		this.shadowRoot.innerHTML = `<style>:host{--width:auto;--fillColor:hsla(0, 50%, 50%, 1);--bgColorBox:hsla(0, 0%, 0%, 0.7);--txtColorBox:hsla(0, 100%, 100%, 1);--gap:30px;--zindex:999}.__tooltip{position:relative}.__tooltip_trigger{width:30px;height:30px;padding:0;margin:0;border:0;outline:0;overflow:hidden;position:relative;cursor:pointer;background:none
	}.__tooltip_ballon{width:1.5em;height:1.5em;cursor:pointer;fill:var(--fillColor)}.__tooltip_message{position:absolute;top:0;left:0;bottom:auto;right:auto;color:var(--txtColorBox);background-color:var(--bgColorBox);padding:1em;width:var(--width);height:auto;border-radius:5px;pointer-events:none;box-sizing:border-box;transform:translate(calc(-100% + var(--gap)), var(--gap));z-index:var(--zindex);overflow:auto}.__tooltip_message--right{transform:translate(0px, var(--gap))}</style>`;

		init(
			this,
			{
				target: this.shadowRoot,
				props: attribute_to_object(this.attributes)
			},
			instance,
			create_fragment,
			safe_not_equal,
			{ right: 0, size: 12 }
		);

		if (options) {
			if (options.target) {
				insert_dev(options.target, this, options.anchor);
			}

			if (options.props) {
				this.$set(options.props);
				flush();
			}
		}
	}

	static get observedAttributes() {
		return ["right", "size"];
	}

	get right() {
		return this.$$.ctx[0];
	}

	set right(right) {
		this.$set({ right });
		flush();
	}

	get size() {
		return this.$$.ctx[12];
	}

	set size(size) {
		this.$set({ size });
		flush();
	}
}

customElements.define("tadashi-tooltip", Tooltip);

export default Tooltip;
//# sourceMappingURL=Tooltip.js.map

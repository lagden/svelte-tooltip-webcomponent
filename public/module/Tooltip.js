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
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
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
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, cancelable, detail);
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
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
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
    seen_callbacks.clear();
    set_current_component(saved_component);
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
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
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
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
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
        mount_component(component, options.target, options.anchor, options.customElement);
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
            const { on_mount } = this.$$;
            this.$$.on_disconnect = on_mount.map(run).filter(is_function);
            // @ts-ignore todo: improve typings
            for (const key in this.$$.slotted) {
                // @ts-ignore todo: improve typings
                this.appendChild(this.$$.slotted[key]);
            }
        }
        attributeChangedCallback(attr, _oldValue, newValue) {
            this[attr] = newValue;
        }
        disconnectedCallback() {
            run_all(this.$$.on_disconnect);
        }
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            // TODO should this delegate to addEventListener?
            if (!is_function(callback)) {
                return noop;
            }
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
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.1' }, detail), { bubbles: true }));
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

/* src/components/Tooltip.svelte generated by Svelte v3.55.1 */

const file = "src/components/Tooltip.svelte";

// (39:1) {#if show}
function create_if_block(ctx) {
	let div;
	let slot;

	const block = {
		c: function create() {
			div = element("div");
			slot = element("slot");
			add_location(slot, file, 43, 3, 1395);
			attr_dev(div, "class", "__tooltip_message");
			toggle_class(div, "__tooltip_message--right", /*_right*/ ctx[4]);
			add_location(div, file, 39, 2, 1296);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			append_dev(div, slot);
			/*div_binding*/ ctx[8](div);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*_right*/ 16) {
				toggle_class(div, "__tooltip_message--right", /*_right*/ ctx[4]);
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			/*div_binding*/ ctx[8](null);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(39:1) {#if show}",
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
	let t1;
	let div_class_value;
	let mounted;
	let dispose;
	let if_block = /*show*/ ctx[3] && create_if_block(ctx);

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
			add_location(path, file, 22, 2, 508);
			attr_dev(symbol, "id", "live_help");
			attr_dev(symbol, "viewBox", "0 0 24 24");
			add_location(symbol, file, 21, 1, 462);
			attr_dev(svg0, "width", "0");
			attr_dev(svg0, "height", "0");
			attr_dev(svg0, "display", "none");
			attr_dev(svg0, "version", "1.1");
			attr_dev(svg0, "aria-hidden", "true");
			attr_dev(svg0, "focusable", "false");
			add_location(svg0, file, 20, 0, 368);
			xlink_attr(use, "xlink:href", "#live_help");
			add_location(use, file, 34, 3, 1229);
			attr_dev(svg1, "class", "__tooltip_ballon");
			add_location(svg1, file, 33, 2, 1195);
			attr_dev(button, "type", "button");
			attr_dev(button, "class", "__tooltip_trigger");
			add_location(button, file, 27, 1, 1100);
			attr_dev(div, "class", div_class_value = "__tooltip " + /*className*/ ctx[0]);
			add_location(div, file, 26, 0, 1063);
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
			/*button_binding*/ ctx[7](button);
			append_dev(div, t1);
			if (if_block) if_block.m(div, null);

			if (!mounted) {
				dispose = listen_dev(button, "click", /*toggle*/ ctx[5], false, false, false);
				mounted = true;
			}
		},
		p: function update(ctx, [dirty]) {
			if (/*show*/ ctx[3]) {
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

			if (dirty & /*className*/ 1 && div_class_value !== (div_class_value = "__tooltip " + /*className*/ ctx[0])) {
				attr_dev(div, "class", div_class_value);
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg0);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(div);
			/*button_binding*/ ctx[7](null);
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

const boolRegex = /^(?:true|false|1|0)$/i;

function instance($$self, $$props, $$invalidate) {
	let _right;
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('tadashi-tooltip', slots, []);
	let { right = false } = $$props;
	let { class: className = '' } = $$props;
	let btn;
	let box;
	let show = false;

	function toggle() {
		$$invalidate(3, show = !show);
	}

	const writable_props = ['right', 'class'];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<tadashi-tooltip> was created with unknown prop '${key}'`);
	});

	function button_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			btn = $$value;
			$$invalidate(1, btn);
		});
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			box = $$value;
			$$invalidate(2, box);
		});
	}

	$$self.$$set = $$props => {
		if ('right' in $$props) $$invalidate(6, right = $$props.right);
		if ('class' in $$props) $$invalidate(0, className = $$props.class);
	};

	$$self.$capture_state = () => ({
		right,
		className,
		btn,
		box,
		show,
		boolRegex,
		toggle,
		_right
	});

	$$self.$inject_state = $$props => {
		if ('right' in $$props) $$invalidate(6, right = $$props.right);
		if ('className' in $$props) $$invalidate(0, className = $$props.className);
		if ('btn' in $$props) $$invalidate(1, btn = $$props.btn);
		if ('box' in $$props) $$invalidate(2, box = $$props.box);
		if ('show' in $$props) $$invalidate(3, show = $$props.show);
		if ('_right' in $$props) $$invalidate(4, _right = $$props._right);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*right*/ 64) {
			$$invalidate(4, _right = boolRegex.test(String(right))
			? String(right).toLowerCase() === 'true' || right === '1'
			: false);
		}
	};

	return [className, btn, box, show, _right, toggle, right, button_binding, div_binding];
}

class Tooltip extends SvelteElement {
	constructor(options) {
		super();

		this.shadowRoot.innerHTML = `<style>:host{--top:0;--left:0;--width:auto;--fillColor:hsla(0, 50%, 50%, 1);--bgColorBox:hsla(0, 0%, 0%, 0.7);--txtColorBox:hsla(0, 100%, 100%, 1);--gap:30px;--zindex:999}.__tooltip{position:relative}.__tooltip_trigger{width:30px;height:30px;padding:0;margin:0;border:0;outline:0;overflow:hidden;position:relative;cursor:pointer;background:none
	}.__tooltip_ballon{width:1.5em;height:1.5em;cursor:pointer;fill:var(--fillColor)}.__tooltip_message{position:absolute;top:var(--top);left:var(--left);bottom:auto;right:auto;color:var(--txtColorBox);background-color:var(--bgColorBox);padding:1em;width:var(--width);height:auto;border-radius:5px;pointer-events:none;box-sizing:border-box;transform:translate(calc(-100% + var(--gap)), var(--gap));z-index:var(--zindex);overflow:auto}.__tooltip_message--right{transform:translate(0px, var(--gap))}</style>`;

		init(
			this,
			{
				target: this.shadowRoot,
				props: attribute_to_object(this.attributes),
				customElement: true
			},
			instance,
			create_fragment,
			safe_not_equal,
			{ right: 6, class: 0 },
			null
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
		return ["right", "class"];
	}

	get right() {
		return this.$$.ctx[6];
	}

	set right(right) {
		this.$$set({ right });
		flush();
	}

	get class() {
		return this.$$.ctx[0];
	}

	set class(className) {
		this.$$set({ class: className });
		flush();
	}
}

customElements.define("tadashi-tooltip", Tooltip);

export { Tooltip as default };
//# sourceMappingURL=Tooltip.js.map

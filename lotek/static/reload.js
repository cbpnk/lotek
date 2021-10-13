function start_reload(vnode) {
    if (vnode.state.fire_reload === false) {
        vnode.state.wait = new Promise(
            function(resolve, reject) {
                vnode.state.fire_reload = resolve;
            }
        );
    }
    return vnode.state.wait;
}

async function start_load(vnode, spec) {
    if ((typeof spec) === 'function') {
        while (true) {
            try {
                return await spec();
            } catch (e) {
                console.log(e);
                await start_reload(vnode);
            }
        }
    } else {
        let data = {};
        for (let [key, promise] of Object.entries(spec).map(([key, value]) => [key, start_load(vnode, value)])) {
            data[key] = await promise;
        }
        return data;
    }
}

export class Reload {
    oninit(vnode) {
        vnode.state.fire_reload = false;
        start_load(vnode, this.load(vnode)).then(
            (data) => {vnode.state.data = data},
            (error) => {console.log(error)});
    }

    view(vnode) {
        if (vnode.state.data !== undefined) {
            return this.render(vnode.state.data, vnode);
        }

        if (!vnode.state.fire_reload) {
            return html`<div class="loading loading-lg"></div>`;
        }
        return html`
<button class="btn btn-error float-right" onclick=${ vnode.state.fire_reload }>
  <i class="icon icon-refresh"></i>
</button>
<div class="toast toast-error">load failed</div>`;
    }
}

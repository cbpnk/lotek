async function start_load(vnode, spec) {
    if ((typeof spec) === 'function') {
        return await spec();
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
        start_load(vnode, this.load(vnode)).then(
            (data) => {vnode.state.data = data; m.redraw();},
            (error) => {console.log(error)});
    }

    view(vnode) {
        if (vnode.state.data !== undefined) {
            return this.render(vnode.state.data, vnode);
        }

        return m(CUI.Spinner,
                 {fill: true,
                  size: "xl"});
    }
}

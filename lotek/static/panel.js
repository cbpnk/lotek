export const Panel = {
    view: function(vnode) {
        return m("div.panel.s-rounded.my-2.column",
                 m("div.panel-header",
                   m("div.panel-title",
                     vnode.attrs.name,
                     vnode.attrs.ondelete?
                     m("btn.btn.btn-clear.float-right", {onclick: vnode.attrs.ondelete})
                     :null
                    )),
                 m("div.panel-body", vnode.children));
    }
};

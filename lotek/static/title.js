const Title = {
    view: function(vnode) {
        return m(
            "h2",
            (vnode.attrs.doc.title_t || ["Untitled"])[0],
            (vnode.attrs.edit)?
                m("button.btn.btn-link",
                  {onclick: vnode.attrs.edit},
                  m("i.icon.icon-edit"))
                :null);
    }
};

export const top_widgets = [Title];

const Title = {
    view: function(vnode) {
        return m(
            "h2",
            (vnode.attrs.doc.title_t || ["Untitled"])[0],
            (vnode.attrs.edit)?
                m(CUI.Button,
                  {basic: true,
                   intent: "primary",
                   label: m(CUI.Icon, {name: CUI.Icons.EDIT}),
                   onclick: vnode.attrs.edit}
                 )
                :null);
    }
};

export const top_widgets = [Title];

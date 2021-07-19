const Widget = {
    view: function(vnode) {

        function onclick(event) {
            if (vnode.attrs.edit) {
                vnode.attrs.save();
            } else {
                m.route.set(m.buildPathname("/edit/:path...", {path: vnode.attrs.path}));
            }
        }
        return [
            (vnode.attrs.edit)?null:m("div.divider", {"data-content": "Feishu"}),
            m("div.form-horizontal",
              m("div.form-group",
                m("div.column.col-3", m("label.form-label", "Revision")),
                m("div.column", m("label.form-label", vnode.attrs.doc)),
                   m("div",
                     m("label.form-switch",
                       m("input[type=checkbox][disabled=disabled]", {"checked": vnode.attrs.edit?"checked":"", oninput}),
                       m("button.form-icon", {onclick}),
                       "Edit")
                    )
               ),
             )
        ];
    }
};

const Editor = {
    view: function(vnode) {
        return [
            m("aside.top",
              m(Widget, {doc: vnode.attrs.doc, path: vnode.attrs.path, edit: vnode.attrs.edit, save: vnode.attrs.save})),
            m("main",
              m("iframe",
                {style: "margin: 0 auto; width: 100%; height: 100%;",
                 src: EDITOR_URL + m.buildPathname("/docs/:token", {token: vnode.attrs.doc.feishu_token_i[0]})})
             )
        ];
    }
}


export const editor_widgets = [Editor];
export const top_widgets = [Widget];

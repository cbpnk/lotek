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
            (vnode.attrs.edit)?null:m("div.divider", {"data-content": "Etherpad"}),
            m("div.form-horizontal",
              m("div.form-group",
                m("div.column.col-3", m("label.form-label", "Revision")),
                m("div.column", m("label.form-label", vnode.attrs.doc.revision_n[0])),
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
        return m("iframe",
          {style: "margin: 0 auto; width: 100%; height: 100%;",
           src: EDITOR_URL + m.buildPathname("/p/:id", {id: vnode.attrs.path.slice(0, -3).replaceAll("/", "-")})});
    }
}


export const editor_widgets = [Editor];
export const top_widgets = [Widget];
